import type { Scenario } from './scenario';
import type { ProgressPhase, WorkerRequest, WorkerResponse, WorkerResult } from './protocol';
import type { PlanView } from './plan';

type Pending = {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: (phase: ProgressPhase, k: number, of: number) => void;
};

type Req = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never;

/** Thin promise wrapper around the routing worker. Created lazily on first use. */
class RoutingClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  private get w(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const m = e.data;
        const p = this.pending.get(m.id);
        if (!p) return;
        if (m.type === 'progress') {
          p.onProgress?.(m.phase, m.k, m.of);
          return;
        }
        this.pending.delete(m.id);
        if (m.type === 'error') p.reject(new Error(m.message));
        else p.resolve(m.result);
      };
      this.worker.onerror = (e) => {
        for (const p of this.pending.values()) p.reject(new Error(e.message || 'Routing worker failed'));
        this.pending.clear();
      };
    }
    return this.worker;
  }

  private send<K extends keyof WorkerResult>(req: Req & { type: K }, onProgress?: Pending['onProgress']): Promise<WorkerResult[K]> {
    const id = ++this.seq;
    return new Promise<WorkerResult[K]>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, onProgress });
      this.w.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  baseline(scenario: Scenario) {
    return this.send({ type: 'baseline', scenario });
  }
  plan(scenario: Scenario, onProgress?: Pending['onProgress']) {
    return this.send({ type: 'plan', scenario }, onProgress);
  }
  disrupt(scenario: Scenario, planned: PlanView, closedEdge: number) {
    return this.send({ type: 'disrupt', scenario, planned, closedEdge });
  }
  evaluate(scenario: Scenario, routes: number[][]) {
    return this.send({ type: 'evaluate', scenario, routes });
  }
  insertOptions(scenario: Scenario, routes: number[][], order: number, frozen: number[]) {
    return this.send({ type: 'insertOptions', scenario, routes, order, frozen });
  }
  move(scenario: Scenario, routes: number[][], order: number, toVan: number, frozen: number[]) {
    return this.send({ type: 'move', scenario, routes, order, toVan, frozen });
  }
  breakdown(scenario: Scenario, routes: number[][], van: number, frozen: number[]) {
    return this.send({ type: 'breakdown', scenario, routes, van, frozen });
  }
}

export const routing = new RoutingClient();
