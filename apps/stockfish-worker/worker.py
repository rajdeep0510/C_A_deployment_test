
import re
import time
import logging

# Configure logging BEFORE any project imports — some __init__.py files call
# module-level logging.error() which triggers logging.basicConfig() with
# defaults (NOTSET level, no format) if no handlers exist yet, making our
# own basicConfig() call a no-op.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

import requests
from supabase import create_client, Client
from worker_config import settings
from worker_core.game_analyzer import GameAnalyzer
from worker_core.batch_analyzer import BatchAnalyzer
from storage.analysis_storage import CURRENT_ANALYSIS_VERSION

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

HEADERS_CHESS_COM = {"User-Agent": "ChessAdvisor/1.0 (academic project)"}
POLL_INTERVAL = 5          # seconds between polls when idle
RETRY_SLEEP   = 10         # seconds to sleep after an unexpected worker-loop error
STUCK_JOB_TIMEOUT_MINUTES = 30  # reset processing jobs older than this


# ---------------------------------------------------------------------------
# Supabase-backed per-game analysis cache
#
# Priority enforced by upsert semantics:
#   individual → ON CONFLICT DO UPDATE  (always overwrites — highest accuracy)
#   batch      → ON CONFLICT DO NOTHING (never overwrites an existing entry)
#
# So when batch asks for a game that was individually analyzed, it gets the
# 500K-node result. When batch asks for a game only it has seen, it gets its
# own cached 0.1s result. Individual analysis always wins.
# ---------------------------------------------------------------------------

def _cache_lookup(username: str, game_url: str) -> "dict | None":
    """Return a cached analysis result from Supabase, or None if not found / stale."""
    try:
        res = (
            supabase.table("game_analysis_cache")
            .select("result, source")
            .eq("username", username)
            .eq("game_url", game_url)
            .eq("analysis_version", CURRENT_ANALYSIS_VERSION)
            .limit(1)
            .execute()
        )
        if res.data:
            row = res.data[0]
            logger.info("Cache hit (%s): %s", row.get("source", "?"), game_url)
            return row["result"]
    except Exception as e:
        logger.warning("cache_lookup failed for %s: %s", game_url, e)
    return None


def _cache_save_individual(username: str, game_url: str, result: dict) -> None:
    """Persist an individual game result — always overwrites batch-level cache."""
    try:
        supabase.table("game_analysis_cache").upsert(
            {
                "username":         username,
                "game_url":         game_url,
                "analysis_version": CURRENT_ANALYSIS_VERSION,
                "source":           "individual",
                "result":           result,
            },
            on_conflict="username,game_url",
        ).execute()
    except Exception as e:
        logger.warning("cache_save_individual failed for %s: %s", game_url, e)


def _cache_save_batch(username: str, game_url: str, result: dict) -> None:
    """Persist a batch result — never overwrites an existing individual result."""
    try:
        supabase.table("game_analysis_cache").upsert(
            {
                "username":         username,
                "game_url":         game_url,
                "analysis_version": CURRENT_ANALYSIS_VERSION,
                "source":           "batch",
                "result":           result,
            },
            on_conflict="username,game_url",
            ignore_duplicates=True,   # DO NOTHING if a row already exists
        ).execute()
    except Exception as e:
        logger.warning("cache_save_batch failed for %s: %s", game_url, e)


# ---------------------------------------------------------------------------
# PGN fetching — mirrors the TypeScript logic in local-analysis.ts
# ---------------------------------------------------------------------------

def _fetch_lichess_pgn(game_id: str) -> str:
    url = f"https://lichess.org/game/export/{game_id}"
    r = requests.get(url, headers={"Accept": "application/x-chess-pgn"}, timeout=15)
    r.raise_for_status()
    return r.text


def _fetch_chess_com_pgn(username: str, game_id: str) -> str:
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    archives_r = requests.get(archives_url, headers=HEADERS_CHESS_COM, timeout=15)
    archives_r.raise_for_status()
    archives = archives_r.json().get("archives", [])

    # Walk archives newest-first until we find the game
    for archive_url in reversed(archives):
        games_r = requests.get(archive_url, headers=HEADERS_CHESS_COM, timeout=15)
        if not games_r.ok:
            continue
        for game in games_r.json().get("games", []):
            url = game.get("url", "")
            pgn = game.get("pgn", "")
            if str(game_id) in url and pgn:
                return pgn

    raise ValueError(f"Chess.com game {game_id} not found in {username}'s archives")


def _fetch_fallback_pgn(username: str) -> str | None:
    """Return the most recent game PGN for the player from any platform."""
    # Try Chess.com first
    try:
        archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"
        ar = requests.get(archives_url, headers=HEADERS_CHESS_COM, timeout=10)
        if ar.ok:
            archives = ar.json().get("archives", [])
            if archives:
                gr = requests.get(archives[-1], headers=HEADERS_CHESS_COM, timeout=10)
                if gr.ok:
                    games = gr.json().get("games", [])
                    if games and games[-1].get("pgn"):
                        return games[-1]["pgn"]
    except Exception:
        pass

    # Try Lichess
    try:
        url = f"https://lichess.org/api/games/user/{username}?max=1"
        r = requests.get(url, headers={"Accept": "application/x-chess-pgn"}, timeout=10)
        if r.ok and r.text.strip():
            return r.text
    except Exception:
        pass

    return None


def fetch_pgn(username: str, filename: str) -> str:
    """
    Resolve a filename/URL stored in analysis_jobs to a PGN string.

    Supported filename formats (same as TypeScript local-analysis.ts):
      - Lichess full URL: https://lichess.org/abcd1234[/...]
      - Lichess short ID: abcd1234  (8 alphanum chars)
      - Chess.com full URL: chess.com/game/live/123456789
      - Chess.com numeric ID: 123456789
      - Anything else → fallback to most recent game
    """
    decoded = filename.strip()

    # Lichess URL
    lichess_url_match = re.match(
        r"(?:https?://)?(?:www\.)?lichess\.org/([a-z0-9]{8})", decoded, re.IGNORECASE
    )
    if lichess_url_match:
        return _fetch_lichess_pgn(lichess_url_match.group(1))

    # Lichess bare ID
    if re.fullmatch(r"[a-z0-9]{8}", decoded, re.IGNORECASE):
        return _fetch_lichess_pgn(decoded)

    # Chess.com URL or numeric ID
    chess_com_match = re.search(
        r"(?:chess\.com/game/(?:live|daily)/)?(\d+)", decoded, re.IGNORECASE
    )
    if chess_com_match:
        return _fetch_chess_com_pgn(username, chess_com_match.group(1))

    # Fallback: most recent game
    pgn = _fetch_fallback_pgn(username)
    if pgn:
        return pgn

    raise ValueError(
        f"Cannot resolve filename '{filename}' to a PGN for user '{username}'"
    )


# ---------------------------------------------------------------------------
# Startup maintenance
# ---------------------------------------------------------------------------

def reset_stuck_jobs() -> None:
    """On startup, reset any jobs left in 'processing' from a previous crashed worker."""
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=STUCK_JOB_TIMEOUT_MINUTES)).isoformat()
    res = (
        supabase.table("analysis_jobs")
        .update({"status": "pending"})
        .eq("status", "processing")
        .lt("created_at", cutoff)
        .execute()
    )
    count = len(res.data) if res.data else 0
    if count:
        logger.info("Reset %d stuck processing job(s) back to pending", count)


# ---------------------------------------------------------------------------
# Job processing
# ---------------------------------------------------------------------------

def process_job(job: dict, analyzer: GameAnalyzer) -> None:
    job_id  = job["id"]
    username = job["username"]
    filename = job["filename"]

    logger.info("Processing job %s — %s / %s", job_id, username, filename)

    # Mark as processing immediately so no other worker picks it up
    supabase.table("analysis_jobs").update({"status": "processing"}).eq("id", job_id).execute()

    try:
        pgn_text = fetch_pgn(username, filename)
        result   = analyzer.analyze_pgn(pgn_text, username)

        supabase.table("analysis_jobs").update(
            {"status": "completed", "result": result}
        ).eq("id", job_id).execute()

        # Write to shared cache so batch analysis can reuse this high-accuracy
        # result instead of re-running Stockfish at lower batch depth.
        _cache_save_individual(username, filename, result)

        logger.info("Job %s completed (accuracy=%.1f%%)", job_id, result.get("game_accuracy", 0))

    except Exception as e:
        logger.error("Job %s failed: %s", job_id, e, exc_info=True)
        supabase.table("analysis_jobs").update({"status": "failed"}).eq("id", job_id).execute()


# ---------------------------------------------------------------------------
# Batch job processing
# ---------------------------------------------------------------------------

def _batch_progress_callback(job_id: str, done: int, total: int, current: str) -> None:
    """Writes per-game progress to batch_jobs so the frontend can show a real progress bar."""
    try:
        supabase.table("batch_jobs").update({
            "games_done":  done,
            "games_total": total,
            "current_game": current,
        }).eq("id", job_id).execute()
    except Exception as e:
        logger.warning("Could not write batch progress for job %s: %s", job_id, e)


def process_batch_job(job: dict) -> None:
    job_id    = job["id"]
    username  = job["username"]
    game_urls = job.get("game_urls") or []

    logger.info("Processing batch job %s — %s, %d games", job_id, username, len(game_urls))

    # Mark as processing and write the total up-front so the frontend
    # can show "0 / N" immediately and render an accurate progress bar.
    supabase.table("batch_jobs").update({
        "status":      "processing",
        "games_total": len(game_urls),
        "games_done":  0,
    }).eq("id", job_id).execute()

    try:
        pgn_list: list[str] = []
        fetched_labels: list[str] = []
        for url in game_urls:
            try:
                pgn = fetch_pgn(username, url)
                pgn_list.append(pgn)
                fetched_labels.append(url)
                logger.info("Fetched PGN for %s", url)
            except Exception as e:
                logger.warning("Could not fetch PGN for %s: %s", url, e)

        if not pgn_list:
            raise ValueError("No valid PGNs could be fetched for any of the %d URLs" % len(game_urls))

        batch_analyzer = BatchAnalyzer(engine_path=settings.STOCKFISH_PATH)
        result = batch_analyzer.analyze_pgn_list(
            pgn_list,
            username,
            labels=fetched_labels,
            on_progress=lambda done, total, current: _batch_progress_callback(
                job_id, done, total, current
            ),
            cache_lookup=_cache_lookup,
            cache_save=_cache_save_batch,
        )

        supabase.table("batch_jobs").update({
            "status": "completed",
            "result": result,
            "games_done": result.get("total_analyzed", len(pgn_list)),
        }).eq("id", job_id).execute()

        logger.info("Batch job %s completed — %d/%d games analyzed",
                    job_id, result.get("total_analyzed", 0), len(game_urls))

    except Exception as e:
        logger.error("Batch job %s failed: %s", job_id, e, exc_info=True)
        supabase.table("batch_jobs").update({"status": "failed"}).eq("id", job_id).execute()


# ---------------------------------------------------------------------------
# Main polling loop
# ---------------------------------------------------------------------------

def main() -> None:
    logger.info("Stockfish worker started — Stockfish path: %s", settings.STOCKFISH_PATH)
    reset_stuck_jobs()
    analyzer = GameAnalyzer(engine_path=settings.STOCKFISH_PATH)

    # Start engine once and keep it warm across jobs
    analyzer.engine.start()
    logger.info("Engine ready")

    try:
        while True:
            try:
                # Single-game jobs take priority
                res = (
                    supabase.table("analysis_jobs")
                    .select("*")
                    .eq("status", "pending")
                    .order("created_at")
                    .limit(1)
                    .execute()
                )
                if res.data:
                    process_job(res.data[0], analyzer)
                    continue  # re-check immediately

                # Then batch jobs
                batch_res = (
                    supabase.table("batch_jobs")
                    .select("*")
                    .eq("status", "pending")
                    .order("created_at")
                    .limit(1)
                    .execute()
                )
                if batch_res.data:
                    process_batch_job(batch_res.data[0])
                    continue  # re-check immediately

                time.sleep(POLL_INTERVAL)
            except Exception as e:
                logger.error("Worker loop error: %s", e, exc_info=True)
                time.sleep(RETRY_SLEEP)
    finally:
        analyzer.engine.stop()
        logger.info("Engine stopped — worker exiting")


if __name__ == "__main__":
    main()
