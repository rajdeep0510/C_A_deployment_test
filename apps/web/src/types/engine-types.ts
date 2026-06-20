export enum MoveClassification {
  Blunder = "blunder",
  Mistake = "mistake",
  Inaccuracy = "inaccuracy",
  Okay = "okay",
  Excellent = "excellent",
  Best = "best",
  Forced = "forced",
  Opening = "opening",
  Perfect = "perfect",
  Splendid = "splendid",
}

export interface EngineWorker {
  isReady: boolean;
  uci(command: string): void;
  listen: (data: string) => void;
  terminate: () => void;
}

export interface WorkerJob {
  commands: string[];
  finalMessage: string;
  onNewMessage?: (messages: string[]) => void;
  resolve: (messages: string[]) => void;
}

export interface LineEval {
  pv: string[];
  cp?: number;
  mate?: number;
  depth: number;
  multiPv: number;
}

export interface PositionEval {
  bestMove?: string;
  moveClassification?: MoveClassification;
  opening?: string;
  lines: LineEval[];
}

export interface Accuracy {
  white: number;
  black: number;
}

export interface EstimatedElo {
  white: number;
  black: number;
}

export interface EngineSettings {
  engine: string;
  depth: number;
  multiPv: number;
  date: string;
}

export interface GameEval {
  positions: PositionEval[];
  accuracy: Accuracy;
  estimatedElo?: EstimatedElo;
  settings: EngineSettings;
}

export interface EvaluateGameParams {
  fens: string[];
  uciMoves: string[];
  depth?: number;
  multiPv?: number;
  setEvaluationProgress?: (value: number) => void;
  playersRatings?: { white?: number; black?: number };
  workersNb?: number;
}

export const QUALITY_MAP: Record<string, string> = {
  [MoveClassification.Splendid]: "Brilliant",
  [MoveClassification.Perfect]: "Best",
  [MoveClassification.Best]: "Best",
  [MoveClassification.Excellent]: "Excellent",
  [MoveClassification.Okay]: "Good",
  [MoveClassification.Inaccuracy]: "Inaccuracy",
  [MoveClassification.Mistake]: "Mistake",
  [MoveClassification.Blunder]: "Blunder",
  [MoveClassification.Opening]: "Book",
  [MoveClassification.Forced]: "Forced",
};
