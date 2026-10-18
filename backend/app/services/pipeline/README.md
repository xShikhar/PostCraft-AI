# Generation pipeline

Real six-node LangGraph: research -> pattern_extraction -> draft_generation -> quality_check -> save_generation; hard failures go through increment_retry back to drafting, at most twice. Errors save failed state.

Deterministic gates cover originality (two 8-word hits or a 10-word run), structural tells, banned phrases and unit-preserving unsourced personal numbers. The judge receives inputs/provenance and evaluates grounding, completeness, CTA and substance. Judge errors/missing score/scores below 7 save needs_review; hard violations retry. Draft-set scores are estimates, not truth guarantees.

Targeted schemas request failed fields only. Recent encrypted Preferences feed draft prompts; timestamp-ordered styles have PostgreSQL fallback. Optional background is gated separately from writing instructions. Research provenance survives caching; synthetic structure is low-confidence and never cached or factual evidence.

Critical results are awaited; optional cache/index/cost tasks have isolated sessions. Editing/finalization reuse checks and preserve chats. Root documentation/FIX_VERIFICATION.md describe operations and actual verification.
