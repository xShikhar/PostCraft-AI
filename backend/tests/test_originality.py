import pytest
from app.services.pipeline.originality import check_originality

def test_benign_draft_with_common_idioms_passes():
    snippets = [
        "In the early days of building our startup, we learned that customer acquisition cost can be a double-edged sword. "
        "At the end of the day, finding product-market fit requires talking to customers rather than reinventing the wheel."
    ]
    # Draft using similar business idioms in an entirely different context
    draft = (
        "When engineering leaders evaluate technical debt, at the end of the day it is all about trade-offs. "
        "In the early days of a new project, moving fast without reinventing the wheel is fine, but ignoring "
        "architecture becomes a double-edged sword when scaling to enterprise contracts."
    )
    passed, reason = check_originality(draft, snippets)
    assert passed is True
    assert reason == ""

def test_copied_15_consecutive_words_fails():
    snippets = [
        "Inserting PgBouncer in front of the application layer and routing heavy reporting queries to read replicas instantly changes performance."
    ]
    # Draft that verbatim copies 15 consecutive words
    draft = (
        "Here is a key database optimization: inserting PgBouncer in front of the application layer "
        "and routing heavy reporting queries to read replicas instantly changes performance for high-traffic apps."
    )
    passed, reason = check_originality(draft, snippets)
    assert passed is False
    assert "consecutive copied words" in reason or "distinct 8-word matches" in reason

def test_site_chrome_is_ignored():
    snippets = [
        "Sign in to view more posts on LinkedIn. Cookie policy and privacy policy. All rights reserved 2026. Join LinkedIn."
    ]
    draft = "Our cookie policy and privacy policy are updated. All rights reserved 2026. Sign in to view."
    passed, reason = check_originality(draft, snippets)
    assert passed is True

def test_synthetic_structure_source_is_exempt():
    snippets = [
        "Hook -> 3 contrarian points -> Concrete operational tradeoff -> Question CTA"
    ]
    draft = "Hook -> 3 contrarian points -> Concrete operational tradeoff -> Question CTA"
    passed, reason = check_originality(draft, snippets, research_source="synthetic_structure")
    assert passed is True
