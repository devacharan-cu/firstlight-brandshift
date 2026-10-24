import type { City } from './city';

export interface ShortestPathTree {
  source: number;
  dist: Float64Array;
  pred: Int32Array;
}

/**
 * Dijkstra over the city's CSR adjacency with a binary heap on typed arrays.
 * `closed` marks edges that cannot be used (e.g. a closed bridge).
 */
export function dijkstra(city: City, source: number, closed?: Uint8Array): ShortestPathTree {
  const n = city.nodeCount;
  const dist = new Float64Array(n).fill(Infinity);
  const pred = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  // heap of (dist, node); lazy deletion
  let cap = 1024;
  let hd = new Float64Array(cap);
  let hn = new Int32Array(cap);
  let size = 0;
  const push = (d: number, v: number) => {
    if (size === cap) {
      cap *= 2;
      const nd = new Float64Array(cap);
      nd.set(hd);
      hd = nd;
      const nn = new Int32Array(cap);
      nn.set(hn);
      hn = nn;
    }
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= d) break;
      hd[i] = hd[p];
      hn[i] = hn[p];
      i = p;
    }
    hd[i] = d;
    hn[i] = v;
  };
  const pop = (): number => {
    const top = hn[0];
    const d = hd[--size];
    const v = hn[size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= size) break;
      if (c + 1 < size && hd[c + 1] < hd[c]) c++;
      if (hd[c] >= d) break;
      hd[i] = hd[c];
      hn[i] = hn[c];
      i = c;
    }
    hd[i] = d;
    hn[i] = v;
    return top;
  };

  dist[source] = 0;
  push(0, source);
  const { adjStart, adjNode, adjEdge, edgeLen } = city;
  while (size > 0) {
    const u = pop();
    if (done[u]) continue;
    done[u] = 1;
    const du = dist[u];
    for (let k = adjStart[u]; k < adjStart[u + 1]; k++) {
      const e = adjEdge[k];
      if (closed && closed[e]) continue;
      const v = adjNode[k];
      const nd = du + edgeLen[e];
      if (nd < dist[v]) {
        dist[v] = nd;
        pred[v] = u;
        push(nd, v);
      }
    }
  }
  return { source, dist, pred };
}

/** Node path from tree.source to target (inclusive). Empty if unreachable. */
export function pathTo(tree: ShortestPathTree, target: number): number[] {
  if (!Number.isFinite(tree.dist[target])) return [];
  const out: number[] = [];
  for (let v = target; v !== -1; v = tree.pred[v]) out.push(v);
  out.reverse();
  return out;
}

export function pathLength(city: City, nodes: number[]): number {
  let len = 0;
  for (let i = 1; i < nodes.length; i++) {
    len += Math.hypot(city.x[nodes[i]] - city.x[nodes[i - 1]], city.y[nodes[i]] - city.y[nodes[i - 1]]);
  }
  return len;
}

/** Caches shortest-path trees per source node for a given closure set. */
export class TreeCache {
  private trees = new Map<number, ShortestPathTree>();
  constructor(
    private city: City,
    private closed?: Uint8Array,
  ) {}
  get(source: number): ShortestPathTree {
    let t = this.trees.get(source);
    if (!t) {
      t = dijkstra(this.city, source, this.closed);
      this.trees.set(source, t);
    }
    return t;
  }
  get size(): number {
    return this.trees.size;
  }
}

/** Dense symmetric distance matrix between location nodes (metres). */
export function distanceMatrix(cache: TreeCache, nodes: number[]): Float64Array {
  const m = nodes.length;
  const D = new Float64Array(m * m);
  for (let i = 0; i < m; i++) {
    const t = cache.get(nodes[i]);
    for (let j = 0; j < m; j++) D[i * m + j] = t.dist[nodes[j]];
  }
  return D;
}
