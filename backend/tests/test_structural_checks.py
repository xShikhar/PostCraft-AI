import pytest
from app.services.pipeline.structural_checks import (
    check_em_dash_density,
    check_contrast_cliches,
    check_triple_parallel_lists,
    check_structural_tells,
)

def test_em_dash_density_gate():
    draft_excessive = "Point A — break 1. Point B — break 2. Point C — break 3."
    ok, reason = check_em_dash_density(draft_excessive, max_allowed=2)
    assert not ok
    assert "Em-dash density exceeded" in reason

    draft_valid = "Point A — break 1. Point B. Point C."
    ok, _ = check_em_dash_density(draft_valid, max_allowed=2)
    assert ok

def test_contrast_cliches_gate():
    draft_trope_1 = "It's not about the model, it's about the data moat."
    ok, reason = check_contrast_cliches(draft_trope_1)
    assert not ok
    assert "contrast cliché" in reason

    draft_trope_2 = "Your wrapper is not a SaaS business. It is a countdown timer."
    ok, reason = check_contrast_cliches(draft_trope_2)
    assert not ok
    assert "contrast cliché" in reason

    draft_trope_3 = "Treating AI as the engine, not the car."
    ok, reason = check_contrast_cliches(draft_trope_3)
    assert not ok
    assert "contrast cliché" in reason

    draft_clean = "We treat software as an operational layer for messy enterprise workflows."
    ok, _ = check_contrast_cliches(draft_clean)
    assert ok

def test_triple_parallel_lists_gate():
    draft_parallel = """
    The unit economics are clear:
    • Zero proprietary data means zero switching costs.
    • Zero workflow embedding means zero retention.
    • Zero deterministic logic means zero enterprise trust.
    """
    ok, reason = check_triple_parallel_lists(draft_parallel)
    assert not ok
    assert "Triple parallel" in reason

    draft_clean = """
    We track three core indicators:
    1. Weekly active pipeline runs
    2. Churn rate among accounts with more than 5 users
    3. Time to first query resolution
    """
    ok, _ = check_triple_parallel_lists(draft_clean)
    assert ok

def test_composite_structural_tells_gate():
    clean_draft = "Building defensible software requires deep domain workflows and audit trails."
    ok, _ = check_structural_tells(clean_draft)
    assert ok
