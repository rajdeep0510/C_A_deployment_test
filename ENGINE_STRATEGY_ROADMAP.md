# Engine Analysis Strategy & Roadmap

## Executive Summary
This document outlines the transition from a purely backend-driven analysis model (Stockfish Worker) to a **Hybrid Architecture**. The goal is to maximize user responsiveness, scale infinitely at zero cost via client-side WebAssembly (WASM), and reserve backend resources for high-value, deep-data insights.

---

## 1. Current State Comparison

| Feature | Backend Python Worker | Chesskit WASM (Local) |
| :--- | :--- | :--- |
| **Execution** | Async / Queue-based | Synchronous / Real-time |
| **Latency** | High (Network + Polling) | Zero (Instant) |
| **Scaling Cost** | Increases with usage ($) | Free ($0 for compute) |
| **Stability** | Reliable (Server-grade) | Varies (Client hardware) |

---

## 2. Capability Mapping (Offload Feasibility)

| Analysis Component | Status | Recommendation |
| :--- | :--- | :--- |
| **Basic Evaluation (CP/Mate)** | ✅ Ready | **Offload to Client**. Use Chesskit for all move-by-move engine scores. |
| **Move Classification** | ✅ Ready | **Offload to Client**. Port thresholds from `move_classifier.py` to `getMovesClassification.ts`. |
| **Accuracy Score** | ✅ Ready | **Offload to Client**. Use the Lichess-style exponential drop logic in `accuracy.ts`. |
| **Opening/Book Detection** | ⚠️ Partial | **Hybrid**. Use client-side FEN matching for common lines; keep `OpeningDB` for deep transposition checks. |
| **Sacrifice Detection** | ⚠️ Partial | **Port to Client**. Move the `_PIECE_VALUES` attacker logic into the Typescript library. |
| **Tactical Validation** | ❌ Complex | **Keep in Worker**. Validating *why* a move failed (Missed Mate/Fork) is better suited for Python's `TacticalValidator`. |
| **Multi-Game Patterns** | ❌ Backend Only| **Keep in Worker**. Aggregating trends across 50+ games should remain a background server task. |

---

## 3. The Future Architecture (The "Ideal Flow")

### Tier 1: Interactive (Client-Side WASM)
*   **User Action:** User moves a piece or views a game.
*   **Mechanism:** `Chesskit/WASM` starts a background Web Worker.
*   **Output:** Instant Evaluation Bar, "Best Move" arrows, and basic classification (Blunder/Great).
*   **Benefit:** Snappy UI, no server lag.

### Tier 2: Persistence (Edge/API)
*   **Action:** Once WASM analysis completes for a game.
*   **Mechanism:** Frontend POSTs the generated JSON (Evaluations + Classifications) to a Next.js API.
*   **Output:** Data is saved to Supabase `analysis_results`.
*   **Benefit:** Avoids re-running the engine for the same game twice.

### Tier 3: Deep Insights (Python Worker)
*   **Action:** User requests a "Full Report" or "Training Plan."
*   **Mechanism:** Supabase Job Queue triggers the `stockfish-worker`.
*   **Output:** Tactical mistake categorization, pattern identification, and long-term progress reports.
*   **Benefit:** High-quality, professional-grade coaching insights.

---

## 4. Actionable Roadmap

### Phase 1: Short-Term (Integration)
- [ ] Integrate `Chesskit/UciEngine` into the main Web UI.
- [ ] Implement a "Local Analysis" mode that populates the UI using the browser engine.
- [ ] Create a "Save Analysis" endpoint to persist WASM results to Supabase.

### Phase 2: Mid-Term (Parity)
- [ ] Port sacrifice detection logic (`_is_sacrifice_move`) from Python to Typescript.
- [ ] Sync move classification thresholds (Centipawn Loss vs. Win % Drop) between both systems to ensure identical results.
- [ ] Implement browser-side caching using `IndexedDB` (via `idb`).

### Phase 3: Long-Term (Optimization)
- [ ] Implement a "Cloud Analysis" fallback: if the user's device is too slow (detected via benchmarks), automatically offload to the Python Worker.
- [ ] Transition the Python Worker to focus exclusively on `TacticalValidator` and `PatternAggregator` (high-level coaching) rather than basic engine polling.
