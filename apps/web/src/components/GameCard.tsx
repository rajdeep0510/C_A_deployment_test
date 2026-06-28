import Link from "next/link";
import { Swords, Calendar } from "lucide-react";
import "./GameCard.css";

const DRAW_RESULTS = new Set([
  "stalemate", "insufficient", "agreed", "repetition",
  "timevsinsufficient", "50move", "1/2-1/2",
]);
const LOSS_RESULTS = new Set([
  "checkmated", "resigned", "timeout", "abandoned", "loss",
]);

function resolveOutcome(
  result: string,
  white: string,
  black: string,
  username: string,
): "Win" | "Loss" | "Draw" {
  const r = (result || "").toLowerCase().trim();
  const isWhite = white?.toLowerCase() === username?.toLowerCase();

  if (r === "1-0") return isWhite ? "Win" : "Loss";
  if (r === "0-1") return isWhite ? "Loss" : "Win";
  if (r === "white") return isWhite ? "Win" : "Loss";
  if (r === "black") return isWhite ? "Loss" : "Win";
  if (DRAW_RESULTS.has(r)) return "Draw";
  if (r === "win") return "Win";
  if (LOSS_RESULTS.has(r)) return "Loss";
  return "Draw";
}

const OUTCOME_COLOR = {
  Win: "var(--success)",
  Loss: "var(--danger)",
  Draw: "#60a5fa",
};

export default function GameCard({ game, username = "" }: { game: any; username?: string }) {
  const outcome = resolveOutcome(game.result, game.white, game.black, username);

  return (
    <div className="glass-card game-card">
      <div className="game-card-header">
        <span className="platform-badge">{game.platform}</span>
        <div className="game-date">
          <Calendar size={14} />
          {new Date(game.end_time * 1000).toLocaleDateString()}
        </div>
      </div>

      <div className="game-players">
        <div className="player white">
          <div className="piece-icon">♙</div>
          <span className="player-name">{game.white}</span>
        </div>
        <div className="vs">
          <Swords size={16} />
        </div>
        <div className="player black">
          <div className="piece-icon">♟</div>
          <span className="player-name">{game.black}</span>
        </div>
      </div>

      <div className="game-footer">
        <div className="result">
          Result:{" "}
          <span style={{ color: OUTCOME_COLOR[outcome], fontWeight: 700 }}>
            {outcome}
          </span>
        </div>
        <Link
          href={`/analysis/${encodeURIComponent(game.filename)}`}
          className="btn btn-primary btn-sm"
        >
          Analyze Game
        </Link>
      </div>
    </div>
  );
}
