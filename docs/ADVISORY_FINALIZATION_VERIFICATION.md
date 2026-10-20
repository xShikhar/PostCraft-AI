# Advisory finalization and integrated story background

Implemented on `frontend-redesign`, verified October 20, 2026.

- Finalize runs the quality review. Feedback that previously blocked finalization now opens a review dialog with the actual substance score, or an explicit unavailable state.
- Keep editing preserves the editable draft. Finalize anyway acknowledges the saved review and finalizes that exact draft.
- Approval is tied to the selected variation and its content hash through a server-issued review token. Changing the text invalidates approval. Ownership, empty-draft and in-progress-generation protections remain.
- Finalized records retain the original review and the author's acknowledgment; warnings are never rewritten as a passing assessment.
- Optional voice-learning failures no longer prevent finalization. The response reports when voice learning was unavailable.
- The home story stage has a transparent background, allowing the existing page atmosphere to continue behind its typography and animated cards.

## Verification

- Production frontend build, lint and TypeScript checks passed.
- Latest backend suite: 81 passed, two dependency deprecation warnings.
- An earlier suite run intermittently returned no generation-level quality metadata in `test_initial_generation_quality_applies_to_all_generated_drafts`; the unchanged test passed on the latest complete run. No speculative product change was made for that result.
- `finalize-review.mjs`: desktop/mobile review UI, score/unavailable feedback, keep-editing, retry after failure, explicit approval and final lock passed.
- `real-finalize-review.mjs`: isolated real API/database finalization with unavailable provider, explicit approval, persisted feedback and lock after reload passed.
- `workspace-redesign.mjs`: existing workspace workflows passed with API fixtures.
- `bold-story.mjs`: pinned motion, skip navigation, pause cleanup, responsive/reduced-motion fallbacks and overflow checks passed. Dark rendering inspected: no separate solid rectangular backdrop.

The real API browser test uses disposable test data, not the user's drafts.
