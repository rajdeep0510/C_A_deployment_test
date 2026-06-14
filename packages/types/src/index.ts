export type UserRole = 'admin' | 'academy_owner' | 'coach' | 'student';

export interface Profile {
  id: string;
  username?: string;
  role: UserRole;
  academy_id?: string;
  created_at: string;
}

export interface Academy {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface Game {
  platform: 'chess.com' | 'lichess';
  url: string;
  pgn: string;
  white: string;
  black: string;
  result: string;
  end_time: number;
  filename?: string;
}

export interface Puzzle {
  puzzle_id: string;
  fen: string;
  moves: string[];
  rating?: number;
  theme?: string;
  themes?: string[];
  solution?: string[];
  source?: 'own_game' | 'library';
}

export interface AnalysisJob {
  id: string;
  username: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  created_at: string;
  updated_at: string;
}
