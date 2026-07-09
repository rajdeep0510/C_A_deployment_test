from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Supabase ──────────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""   # service_role key (not publishable) — keep secret

    # ── Stockfish engine ──────────────────────────────────────────────────────
    STOCKFISH_PATH: str = "stockfish"
    ANALYSIS_TIME: float = 0.1      # kept for reference; engine now uses ANALYSIS_NODES
    ANALYSIS_NODES: int = 500_000  # Reduced for Render free tier (30s timeout protection)
    BATCH_ANALYSIS_TIME: float = 0.1  # seconds per position for batch jobs (time-based, adaptive)
    ENGINE_THREADS: int = 1        # Reduced for Render free tier
    ENGINE_HASH_MB: int = 64       # Reduced for Render free tier (512MB RAM protection)

    # ── Third-party API fetching ──────────────────────────────────────────────
    CHESS_COM_BASE_URL: str = "https://api.chess.com/pub/player"
    LICHESS_BASE_URL: str = "https://lichess.org/api"
    REQUEST_TIMEOUT: int = 10       # seconds before giving up on a remote call

    # ── Local storage ─────────────────────────────────────────────────────────
    # Override these env vars to redirect storage elsewhere (e.g. a mounted volume)
    GAMES_DATA_DIR: Path = Path(__file__).parent / "data" / "games"
    REPORTS_DATA_DIR: Path = Path(__file__).parent / "data" / "reports"
    ANALYSIS_CACHE_DIR: Path = Path(__file__).parent / "data" / "analysis"

    # ── Analysis limits ───────────────────────────────────────────────────────
    MAX_BATCH_SIZE: int = 50

    # ── Stockfish concurrency ─────────────────────────────────────────────────
    # Max simultaneous Stockfish processes. Raise carefully — each engine uses
    # ~256 MB RAM (ENGINE_HASH_MB) plus CPU. 2 is safe on a typical dev box.
    # Set to 1 for Render Free Tier (512MB RAM limit)
    MAX_CONCURRENT_ENGINES: int = 1
    # Seconds a request will wait for a free engine slot before getting a 503.
    ENGINE_ACQUIRE_TIMEOUT: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()

# Ensure data directories exist at import time so callers never have to
settings.GAMES_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.REPORTS_DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.ANALYSIS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
