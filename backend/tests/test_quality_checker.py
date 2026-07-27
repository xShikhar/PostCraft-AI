import pytest
from app.services.orchestrator import check_originality

def test_check_originality():
    # 1. Flag exact 6+ word matches
    draft = "This is a completely original draft but it has a shared phrase that is six words long."
    research_text = "Here is some research. it has a shared phrase that is six words long. End of research."
    
    # "it has a shared phrase that is six words long" is 9 words.
    assert check_originality(draft, [research_text])[0] is False
    
    # 2. Ignore short generic 3-word overlaps
    draft_short = "Here is my short original text."
    research_short = "Here is my research text."
    
    # Max overlap is "Here is my" (3 words). Should pass.
    assert check_originality(draft_short, [research_short])[0] is True
    
    # 3. No overlap
    assert check_originality("Apples and oranges", ["Bananas and grapes"])[0] is True
