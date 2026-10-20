# Performance implementation notes

Updated 20 October 2026; supersedes previous benchmark/completeness claims. No new live-provider latency benchmark is claimed. Visual motion is scoped to transforms/opacity where possible and respects reduced-motion preferences.

- Tavily caps raw/summary fallback at 1,500 characters per result, up to five per search.
- Base model plus optional FAST/DRAFT overrides; no SDK retries; at most two wrapper retries with full jitter capped at three seconds and recognized permanent-quota fail-fast.
- Hard retries request only failed draft fields; deterministic checks collect failed indices in one pass and research is reused.
- Judge outages/missing score/scores below 7 lead to needs_review. Edits/finalization use async calls and shared checks.
- Chroma is lazy and blocking calls are offloaded. Empty/unavailable Chroma falls back to timestamp-ordered PostgreSQL styles.
- Critical drafts/preferences/learned styles commit before returning. Optional tasks use isolated sessions and drain for up to 20 seconds at shutdown. Vector erasure has a durable retry outbox.
- Queue timeout precedes generation insertion. PostgreSQL row locks serialize daily admission.
- Telemetry separates model attempts and sleep. Token rates are configurable estimates. Home uses server metrics; loading UI uses elapsed time, not fake stage percentages.

Verify live quota, latency, cold start, vector outage behavior and replica limits in staging. These are implementation properties, not throughput guarantees.
