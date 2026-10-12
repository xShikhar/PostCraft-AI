import re
from typing import Tuple, List, Set, Optional

# Whitelist of common business idioms, clichés, and industry phrases
COMMON_BUSINESS_WHITELIST = {
    "at the end of the day",
    "in the early days",
    "in the early days of",
    "a double edged sword",
    "the double edged sword of",
    "a single point of failure",
    "from the ground up",
    "when it comes to",
    "take it with a grain of salt",
    "product market fit",
    "customer acquisition cost",
    "lifetime value of a customer",
    "low hanging fruit",
    "move the needle",
    "reinventing the wheel",
    "on the other hand",
    "think outside the box",
    "the elephant in the room",
    "all things being equal",
    "by and large",
    "in order to ensure that",
    "as a matter of fact",
    "for what it is worth",
    "the tip of the iceberg",
}

# Site chrome and navigational boilerplate to filter out from creator posts
CHROME_PATTERNS = [
    re.compile(r"\b(?:cookie policy|privacy policy|terms of service|all rights reserved)\b", re.IGNORECASE),
    re.compile(r"\b(?:sign in to view|join linkedin|see more comments|view profile)\b", re.IGNORECASE),
    re.compile(r"\b(?:likes\s+comments\s+shares|repost|follow\s+following)\b", re.IGNORECASE),
]


def normalize_words(text: str) -> List[str]:
    """
    Normalizes text by removing punctuation, lowercasing, and splitting into tokens.
    """
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return [w for w in cleaned.split() if w]


def is_site_chrome(snippet: str) -> bool:
    """
    Checks if a snippet appears to be website navigation, footer text, or boilerplate.
    """
    for pattern in CHROME_PATTERNS:
        if pattern.search(snippet):
            return True
    return False


def get_ngrams(words: List[str], n: int) -> Set[Tuple[str, ...]]:
    """Returns a set of n-gram tuples for a list of words."""
    if len(words) < n:
        return set()
    return {tuple(words[i : i + n]) for i in range(len(words) - n + 1)}


def is_whitelisted_phrase(ngram_tuple: Tuple[str, ...]) -> bool:
    """
    Checks if an n-gram is part of a common business phrase whitelist.
    """
    phrase = " ".join(ngram_tuple)
    return any(wl in phrase for wl in COMMON_BUSINESS_WHITELIST)


def find_longest_consecutive_match(words_a: List[str], words_b: List[str]) -> int:
    """
    Finds the maximum length of consecutive matching words between two word lists.
    Using standard dynamic programming / longest common substring algorithm.
    """
    if not words_a or not words_b:
        return 0
    m, n = len(words_a), len(words_b)
    # Space-optimized DP row
    prev = [0] * (n + 1)
    max_len = 0
    for i in range(1, m + 1):
        curr = [0] * (n + 1)
        for j in range(1, n + 1):
            if words_a[i - 1] == words_b[j - 1]:
                curr[j] = prev[j - 1] + 1
                if curr[j] > max_len:
                    max_len = curr[j]
            else:
                curr[j] = 0
        prev = curr
    return max_len


def check_originality(
    draft: str,
    snippets: List[str],
    research_source: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Enhanced originality check:
    - Compares only against creator-post text (filtering site chrome and synthetic scaffolds).
    - Normalizes punctuation and case.
    - Uses 8-word n-grams with a 2-hit threshold OR a 10-word consecutive match.
    - Whitelists common business idioms to prevent false positives.

    Returns:
        (passed: bool, reason: str)
    """
    # If research was synthetic fallback, skip plagiarism check against synthetic structure
    if research_source == "synthetic_structure":
        return True, ""

    draft_words = normalize_words(draft)
    if len(draft_words) < 8:
        return True, ""

    draft_8grams = get_ngrams(draft_words, 8)
    # Remove whitelisted idioms from draft n-grams
    filtered_draft_8grams = {ng for ng in draft_8grams if not is_whitelisted_phrase(ng)}

    for snippet in snippets:
        if not snippet or not snippet.strip():
            continue
        # Skip site chrome / web navigation boilerplate
        if is_site_chrome(snippet):
            continue

        snippet_words = normalize_words(snippet)
        if len(snippet_words) < 8:
            continue

        # 1. Check for 10-word consecutive match
        consecutive_len = find_longest_consecutive_match(draft_words, snippet_words)
        if consecutive_len >= 10:
            return False, (
                f"Plagiarism detected: {consecutive_len} consecutive copied words "
                f"matching creator post."
            )

        # 2. Check 8-gram overlap with a 2-hit threshold
        snippet_8grams = get_ngrams(snippet_words, 8)
        filtered_snippet_8grams = {ng for ng in snippet_8grams if not is_whitelisted_phrase(ng)}
        overlap = filtered_draft_8grams.intersection(filtered_snippet_8grams)

        if len(overlap) >= 2:
            sample = " ".join(list(overlap)[0])
            return False, (
                f"Plagiarism detected: {len(overlap)} distinct 8-word matches with creator post "
                f"(e.g. '{sample}')."
            )

    return True, ""
