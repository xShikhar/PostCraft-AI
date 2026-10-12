import pytest
from app.services.pipeline.unsourced_numbers import (
    extract_source_numbers,
    is_number_sourced,
    check_unsourced_numbers,
)

def test_extract_source_numbers():
    sources = [
        "I reached $100k ARR with 15% churn.",
        "Research shows latency dropped by 4.2ms in 2024.",
        "Profile: 10 years experience as CTO at 500-person startup."
    ]
    numbers = extract_source_numbers(sources)
    assert "100" in numbers or "100k" in numbers
    assert "15" in numbers
    assert "4.2" in numbers
    assert "10" in numbers
    assert "500" in numbers

def test_first_person_unsourced_figure_hard_fails():
    sources = ["I run a boutique dev agency."]
    draft = "Last month, I scaled our revenue to $4.2M by changing our sales pitch."
    passed, reason, warnings = check_unsourced_numbers(draft, sources)
    assert passed is False
    assert "Unsourced first-person numeric claim" in reason
    assert "$4.2M" in reason or "4.2" in reason

def test_first_person_sourced_figure_passes():
    sources = ["Raw thoughts: I grew my team to 25 engineers and hit $2M ARR."]
    draft = "When I grew the team to 25 engineers, we hit $2M ARR by standardizing workflows."
    passed, reason, warnings = check_unsourced_numbers(draft, sources)
    assert passed is True
    assert reason == ""

def test_placeholder_exempt_from_hard_fail():
    sources = ["I run a boutique dev agency."]
    draft = "Last month, I scaled our revenue to [$4.2M ARR] with [X% churn] by changing our sales pitch."
    passed, reason, warnings = check_unsourced_numbers(draft, sources)
    assert passed is True
    assert reason == ""

def test_adjacent_placeholders_exempt():
    sources = []
    draft = "We closed [MRR threshold][churn target] by end of quarter."
    passed, reason, warnings = check_unsourced_numbers(draft, sources)
    assert passed is True
    assert reason == ""

def test_generic_threshold_warns_not_fails():
    sources = ["Postgres optimization tips."]
    draft = "If your database exceeds 500GB, single-node Postgres will struggle without table partitioning."
    passed, reason, warnings = check_unsourced_numbers(draft, sources)
    assert passed is True  # does NOT hard fail
    assert len(warnings) > 0
    assert any("500GB" in w or "500" in w for w in warnings)

def test_calendar_years_and_enumerations_pass():
    sources = []
    draft = """
    1. In 2024, developer productivity is moving to agents.
    2. Step two is testing locally.
    3. Rule three is clean architecture.
    """
    passed, reason, warnings = check_unsourced_numbers(draft, sources)
    assert passed is True
    assert reason == ""
