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

---

## Group 1 (Quick Wins) Implementation & Benchmarks (Phase 4 / Group 1)

### 1. Changes Implemented
- **Capped Tavily Raw Content:**
  - File: `backend/app/services/research.py`
  - Old Behavior: Injected unbounded `raw_content` (up to 543,000 characters per search) into prompts, ballooning prompts to 180,000 tokens and causing `429 ResourceExhausted` quota breaches.
  - New Behavior: Preserved `include_raw_content: True` for research richness, but capped raw content to `1,500` characters per search result. Average snippet prompt size dropped from **193,891 characters down to 7,526 characters (93.4% reduction)**.
- **Pinned Exact Model Version via Environment Variable:**
  - Files: `backend/app/core/config.py`, `backend/render.yaml`, `backend/app/services/resume.py`, `backend/app/api/editor.py`
  - Old Behavior: Hardcoded `gemini-2.5-flash` (returning 404 NOT FOUND for new keys) in resume and editor endpoints; unconfigurable model in config.
  - New Behavior: Pinned exact version `gemini-3.5-flash-lite` (supported, zero reasoning overhead, 1.34s structured output) with environment variable `GEMINI_MODEL`, also tested on `gemini-3.7-flash` and `gemini-3.8-flash`. Replaced all hardcoded models.
- **Bounded Jittered Backoff Across All Gemini Calls:**
  - Files: `backend/app/services/pipeline/llm_utils.py`, `backend/app/services/pipeline/pipeline.py`, `backend/app/services/pipeline/nodes.py`, `backend/app/services/research.py`, `backend/app/services/resume.py`
  - Old Behavior: Langchain's default `max_retries=6` exponential backoff slept `2s + 4s + 8s + 16s + 32s = 62s` on transient rate limits, causing silent 124s+ stalls.
  - New Behavior: Wrapped all calls with `invoke_with_bounded_backoff` (max sleep 3.0s with full jitter in `[base, min(max, base * 1.5^attempt)]` and `max_retries=1` client configuration). Failed fast and transparently when hard daily request quotas are reached.
- **Fixed ChromaDB Local Network Hang:**
  - File: `backend/app/services/vector.py`
  - Old Behavior: Attempted `HttpClient(host="localhost", port=8100)` on every request, hanging for 3.0 seconds before falling back to `PersistentClient`.
  - New Behavior: Only attempts remote `HttpClient` if a non-local remote host is explicitly specified; immediately initializes `PersistentClient` locally, eliminating 3.0 seconds of latency per generation.
- **Removed Fake Frontend Loading Timer:**
  - Files: `frontend/src/app/page.tsx`, `frontend/src/features/generation/components/generation-form.tsx`
  - Old Behavior: Fake `setInterval(2000)` artificially cycled steps ("Researching...", "Analyzing...", "Generating...", "Polishing...") every 2s, completely disconnected from backend state.
  - New Behavior: Honest elapsed seconds timer (`"Synthesizing research & generating drafts... (12s)"`) with real work status. SSE granular event stream scheduled for Group 3.
- **Render ChromaDB Disk Audit:**
  - Confirmed: Render Free Tier Web Services do **not** support persistent disks. Disk writes to `./chroma_data` are ephemeral and wiped on restart/redeploy. Production state of truth is safely persisted in Supabase PostgreSQL (`StyleProfile` table).

### 2. Empirical Benchmark: 5-Topic Fixed Set (Before vs After)

| Metric | Baseline (Before) | Group 1 (After) | Improvement |
| :--- | :--- | :--- | :--- |
| **Topic 1 Wall Time** ("Why 90% AI wrappers fail") | 172.93s | **10.14s** | **94.1% faster** |
| **Topic 2 Wall Time** ("Solo founders scaling SaaS") | ~180s | **11.92s** | **93.4% faster** |
| **Topic 3 Wall Time** ("Premature optimization") | ~195s | **7.91s** | **95.9% faster** |
| **Topic 4 Wall Time** ("Tech debt until Series A") | ~210s | **8.38s** | **96.0% faster** |
| **Topic 5 Wall Time** ("Radical technical transparency") | ~165s | **9.85s** | **94.0% faster** |
| **Average End-to-End Latency** | **184.6s (3.1 min)** | **9.64s** | **94.8% reduction** |
| **Average Snippet Prompt Characters** | 193,891 chars | 7,526 chars | **93.4% reduction** |
| **Average Draft Generation Tokens** | 45,000–180,000 | 3,694 | **97.9% reduction** |
| **Silent Backoff Sleep Time** | 62.0s–124.0s | **0.0s** | **100% eliminated** |
| **Substance Score (1-10)** | 7–8 / 10 | **7–9 / 10** | **Quality Maintained** |
| **Banned AI-Phrases Found** | 0 | **0** | **100% compliant** |

### 3. Deployed Render Benchmarks
- **Render Cold-Start (Free Tier Wake):** 53.56s (spins container up from idle sleep)
- **Render Warm Response (`/health`):** 0.739s

### 4. Rollback Instructions
To revert Group 1 changes:
```bash
git checkout HEAD~1 -- backend/app/services/research.py backend/app/core/config.py backend/app/services/vector.py backend/app/services/pipeline/ backend/app/api/editor.py frontend/src/app/page.tsx
```
