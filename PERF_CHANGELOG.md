# Performance Changelog — Generation Latency Optimization

> This file tracks all performance audits, measurements, baseline benchmarks, and latency reductions for PostCraft AI.

---

## Baseline Checkpoint (Git Tag: `perf-baseline` @ `ff65524`)

### Phase 1: Measurement & Instrumentation
- **Added Telemetry Module:** `backend/app/services/pipeline/telemetry.py`
  - Captures wall-clock time per LangGraph node (`research`, `pattern_extraction`, `draft_generation`, `quality_check`, `increment_retry`, `save_generation`).
  - Records external call targets (`gemini`, `tavily`, `serpapi`, `chromadb`, `postgres`), operations, exact durations, input/output/reasoning tokens, HTTP status, and rate-limit backoff sleep times.
  - Zero PII or draft content is logged.
- **Wired Telemetry into Nodes:**
  - `backend/app/services/pipeline/state.py`: Added `telemetry: Optional[dict]` to `PipelineState` and `GraphState`.
  - `backend/app/services/pipeline/pipeline.py`: Instantiates `PipelineTelemetry`, attaches to state, and exports summary JSON.
  - `backend/app/services/pipeline/nodes.py`: Instrumented all 6 nodes with `_measure_node_ctx` and call-level tracking.
  - `backend/app/services/research.py`: Instrumented database cache check, search API calls, and synthetic fallback.
- **Model Configuration Fix:**
  - `backend/app/core/config.py`: Replaced hardcoded `gemini-2.5-flash` (which returns HTTP 404 for new keys) with configurable `GEMINI_MODEL: str = "gemini-3.5-flash"`.

---

## Audit Summary (Phase 2)
See full Phase 2 Audit Report presented to the user.
