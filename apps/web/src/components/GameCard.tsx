import Link from "next/link";
import { Swords, Calendar } from "lucide-react";
import "./GameCard.css";

export default function GameCard({ game }) {
  const isWhite =
    game.platform === "chess.com" || game.platform === "lichess"
      ? true // This would typically check if the active user played as white
      : false;

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
          <span
            style={{
              color: (game.result || "").toLowerCase().includes("stalemate")
                ? "#60a5fa"
                : (game.result || "").toLowerCase().includes("resign")
                  ? "#facc15"
                  : (game.result || "").toLowerCase().includes("win")
                    ? "var(--success)"
                    : "var(--danger)",
              fontWeight: 700,
            }}
          >
            {game.result || "Unknown"}
          </span>
        </div>
        {game.filename && (
          <Link
            href={`/analysis/${encodeURIComponent(game.filename)}`}
            className="btn btn-primary btn-sm"
          >
            Analyze Game
          </Link>
        )}
      </div>
    </div>
  );
}
