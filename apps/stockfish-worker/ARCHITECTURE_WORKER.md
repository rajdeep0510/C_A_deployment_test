# Stockfish Worker Architecture

## Overview
The Stockfish Worker is a standalone Python service responsible for performing heavy chess analysis using the Stockfish engine. It operates asynchronously by polling a job queue (Supabase table) and writing results back to the database.

## Components
- `worker.py`: The entry point that polls for pending jobs and orchestrates the analysis.
- `core/`: Contains the analysis logic ported from the original backend.
  - `game_analyzer.py`: Move-by-move analysis.
  - `batch_analyzer.py`: Analysis of multiple games for trend reporting.
  - `engine_manager.py`: Handles Stockfish process lifecycle.
- `config.py`: Configuration using Pydantic Settings, pulling from `.env`.

## Data Flow
1. Next.js App Router inserts a row into `public.analysis_jobs` with `status='pending'`.
2. Worker fetches the oldest pending job.
3. Worker updates job status to `processing`.
4. Worker executes analysis (GameAnalyzer or BatchAnalyzer).
5. Worker updates job status to `completed` (or `failed`) and stores the JSON `result`.
6. Next.js frontend polls the job status and displays the result when available.

## Dependencies
- `python-chess`
- `supabase-py`
- `pydantic-settings`
- `stockfish` (executable must be in PATH or configured)
