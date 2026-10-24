import type { Scenario } from './scenario';
import type { PlanningResult, PlanView, RouteGeometry } from './plan';
import type { PlanStats } from './solver';
import type { DisruptionResult } from './disruption';
import type { BreakdownResult, InsertionOption, MoveResult } from './ops';

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
  | { type: 'disrupt'; id: number; scenario: Scenario; planned: PlanView; closedEdge: number }
  | { type: 'evaluate'; id: number; scenario: Scenario; routes: number[][] }
  | { type: 'insertOptions'; id: number; scenario: Scenario; routes: number[][]; order: number; frozen: number[] }
  | { type: 'move'; id: number; scenario: Scenario; routes: number[][]; order: number; toVan: number; frozen: number[] }
  | { type: 'breakdown'; id: number; scenario: Scenario; routes: number[][]; van: number; frozen: number[] };

export interface MoveResponse {
  move: MoveResult;
  view: PlanView;
}

export interface WorkerResult {
  baseline: BaselineResult;
  plan: PlanningResult;
  disrupt: DisruptionResult;
  evaluate: PlanView;
  insertOptions: InsertionOption[];
  move: MoveResponse;
  breakdown: BreakdownResult;
}

export type WorkerResponse =
  | { type: 'result'; id: number; result: WorkerResult[keyof WorkerResult] }
  | { type: 'progress'; id: number; phase: ProgressPhase; k: number; of: number }
  | { type: 'error'; id: number; message: string };
