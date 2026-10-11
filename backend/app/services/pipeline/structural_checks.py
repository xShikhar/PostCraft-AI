import re
from typing import Tuple

# Regex patterns for "not X, it's Y" structural AI tropes
CONTRAST_CLICHE_PATTERNS = [
    # "It's not X, it's Y" / "It is not X, but Y"
    re.compile(r"\b(?:it'?s|it is)\s+not\s+[^.!?,\n]+,\s*(?:it'?s|it is|they'?re|they are)\s+", re.IGNORECASE),
    # "Not because X, but because Y" / "Not because X. Not because Y. They're dying because..."
    re.compile(r"\bnot\s+because\s+[^.!?,\n]+[.,;]?\s*(?:not\s+because|but\s+because|they'?re|it'?s)\s+", re.IGNORECASE),
    # "not about X, it's about Y"
    re.compile(r"\bnot\s+about\s+[^.!?,\n]+,\s*(?:it'?s|it is|but)\s+about\s+", re.IGNORECASE),
    # "as the engine, not the car" / "treating X as the engine, not the car" / "a feature, not a company" / "a feature, not a product"
    re.compile(r"\b(?:as\s+the\s+\w+|a\s+\w+),\s+not\s+(?:the\s+\w+|a\s+\w+)\b", re.IGNORECASE),
    # "is not a X. It's a Y" / "is not a X. It is a Y"
    re.compile(r"\bis\s+not\s+a\s+[^.!?\n]+[.!?]\s*(?:it'?s|it is)\s+a\s+", re.IGNORECASE),
]

# Regex patterns for parallel lines like "Zero X means zero Y" or "No X means no Y"
PARALLEL_ZERO_PATTERN = re.compile(
    r"^(?:•|\*|-|\d+\.)?\s*(zero|no|more|less|fewer)\s+.*?\s+(means|leads to|equals|creates|results in)\s+(zero|no|more|less|fewer)\b",
    re.IGNORECASE
)

def check_em_dash_density(draft: str, max_allowed: int = 2) -> Tuple[bool, str]:
    """
    Checks if a draft exceeds the allowable count of em-dashes (—).
    AI models heavily rely on em-dashes for cadence. Real human copy uses them sparingly.
    """
    em_dash_count = draft.count("—")
    # Also check double hyphens used as pseudo em-dashes
    pseudo_em_dashes = len(re.findall(r"\s--\s", draft))
    total_count = em_dash_count + pseudo_em_dashes

    if total_count > max_allowed:
        return False, f"Em-dash density exceeded ({total_count} occurrences, max allowed is {max_allowed})"
    return True, ""


def check_contrast_cliches(draft: str) -> Tuple[bool, str]:
    """
    Detects deterministic 'not X, it's Y' or 'Not because X, but because Y' patterns.
    """
    for pattern in CONTRAST_CLICHE_PATTERNS:
        match = pattern.search(draft)
        if match:
            snippet = match.group(0).strip().replace("\n", " ")
            return False, f"Structural AI tell detected ('not X, it's Y' contrast cliché): '{snippet}'"
    return True, ""


def check_triple_parallel_lists(draft: str) -> Tuple[bool, str]:
    """
    Detects triple parallel repetitive structures, such as 3+ lines of:
    - 'Zero X means zero Y' / 'No X means no Y'
    - 3+ lines with identical 2-4 word starting prefixes
    """
    lines = [line.strip() for line in draft.split("\n") if line.strip()]

    # 1. Check for 'Zero X means zero Y' / 'No X means no Y' patterns
    zero_matches = []
    for line in lines:
        clean = re.sub(r"^[•\*\-\d\.]+\s*", "", line).strip()
        if PARALLEL_ZERO_PATTERN.search(clean):
            zero_matches.append(clean)

    if len(zero_matches) >= 3:
        sample = " | ".join(zero_matches[:3])
        return False, f"Triple parallel 'Zero X means zero Y' list detected: '{sample}'"

    # 2. Check for 3+ consecutive lines with identical starting 2-3 word prefixes
    # (e.g. "It lives in...", "It lives in...", "It lives in...")
    cleaned_lines = [re.sub(r"^[•\*\-\d\.]+\s*", "", l).strip() for l in lines]
    consecutive_prefix = None
    consecutive_count = 1

    for i in range(len(cleaned_lines) - 1):
        words_curr = cleaned_lines[i].lower().split()[:3]
        words_next = cleaned_lines[i + 1].lower().split()[:3]
        if len(words_curr) >= 2 and words_curr == words_next:
            prefix_str = " ".join(words_curr)
            if prefix_str == consecutive_prefix:
                consecutive_count += 1
            else:
                consecutive_prefix = prefix_str
                consecutive_count = 2
            if consecutive_count >= 3:
                return False, f"Triple parallel repetitive prefix detected: '{consecutive_prefix}...' repeated {consecutive_count} times"
        else:
            consecutive_prefix = None
            consecutive_count = 1

    return True, ""


def check_structural_tells(draft: str) -> Tuple[bool, str]:
    """
    Composite deterministic check for structural AI tells:
    1. Em-dash density (> 2 em-dashes per post)
    2. 'Not X, it's Y' contrast tropes
    3. Triple parallel lists ('Zero X means zero Y' or identical prefixes)
    """
    ok, reason = check_em_dash_density(draft)
    if not ok:
        return False, reason

    ok, reason = check_contrast_cliches(draft)
    if not ok:
        return False, reason

    ok, reason = check_triple_parallel_lists(draft)
    if not ok:
        return False, reason

    return True, ""
