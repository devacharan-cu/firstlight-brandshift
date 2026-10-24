import type { Scenario } from './scenario';
import type { PlanningResult, PlanView, RouteGeometry } from './plan';
import type { PlanStats } from './solver';
import type { DisruptionResult } from './disruption';

export interface BaselineResult {
  routes: number[][];
  stats: PlanStats;
  geometry: RouteGeometry[];
  ms: number;
}

export type ProgressPhase = 'matrix' | 'baseline' | 'savings' | 'improve' | 'geometry' | 'done';

export type WorkerRequest =
  | { type: 'baseline'; id: number; scenario: Scenario }
  | { type: 'plan'; id: number; scenario: Scenario }
  | { type: 'disrupt'; id: number; scenario: Scenario; planned: PlanView; closedEdge: number };

export type WorkerResponse =
  | { type: 'baseline'; id: number; result: BaselineResult }
  | { type: 'plan'; id: number; result: PlanningResult }
  | { type: 'disrupt'; id: number; result: DisruptionResult }
  | { type: 'progress'; id: number; phase: ProgressPhase; k: number; of: number }
  | { type: 'error'; id: number; message: string };
