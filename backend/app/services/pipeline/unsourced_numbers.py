import re
from typing import Tuple, List, Set

# Regex to detect bracketed placeholders like [X% churn], [$4.2M], [threshold], etc.
# Excludes markdown links [text](url)
PLACEHOLDER_REGEX = re.compile(r"\[(?!\d+\])([^\]\(\n\r]+)\](?!\s*\()", re.IGNORECASE)

# First-person pronouns and indicators
FIRST_PERSON_REGEX = re.compile(
    r"\b(i|me|my|mine|myself|we|us|our|ours|ourselves)\b",
    re.IGNORECASE
)

# Common calendar years (e.g. 1990 to 2035) that are dates, not metric claims
YEAR_REGEX = re.compile(r"\b(?:19|20)\d{2}\b")

# Numeric figures pattern: currencies, percentages, quantities with metric suffixes, or numbers
FIGURE_REGEX = re.compile(
    r"(?:\$|€|£)?\b\d+(?:[.,]\d+)*(?:\s*(?:k|m|b|bn|x|%|gb|tb|mb|kb|ms|s|yr|yrs|year|years|hour|hours|day|days|week|weeks|month|months|user|users|client|clients|follower|followers|dollar|dollars|usd|arr|mrr))?\b%?",
    re.IGNORECASE
)


def extract_source_numbers(sources: List[str]) -> Set[str]:
    """
    Extracts all numeric tokens from the provided source texts
    (raw_thoughts, profile/about_me/resume, research snippets).
    Normalizes digits and common abbreviations so that e.g. '$4.2M' or '4.2'
    in the source matches '4.2' or '$4.2M' in the draft.
    """
    found = set()
    for text in sources:
        if not text:
            continue
        # Extract all digit sequences
        raw_numbers = re.findall(r"\d+(?:[.,]\d+)?", text)
        for num in raw_numbers:
            clean = num.replace(",", "")
            found.add(clean)
            # If float, also add stripped version (e.g., "4.0" -> "4")
            if "." in clean:
                found.add(clean.rstrip("0").rstrip("."))
        
        # Also extract tokenized figures (e.g. '10k', '2m', '15%')
        for match in FIGURE_REGEX.finditer(text):
            found.add(match.group(0).lower().strip())

    return found


def is_number_sourced(token: str, source_numbers: Set[str]) -> bool:
    """
    Checks if a numeric token or its base numerical value is present in source_numbers.
    """
    token_clean = token.lower().strip()
    if token_clean in source_numbers:
        return True

    # Extract digits from token
    digit_match = re.search(r"\d+(?:[.,]\d+)?", token_clean)
    if not digit_match:
        return True
    
    num_str = digit_match.group(0).replace(",", "")
    if num_str in source_numbers:
        return True
    if "." in num_str and num_str.rstrip("0").rstrip(".") in source_numbers:
        return True

    return False


def check_unsourced_numbers(
    draft: str,
    source_texts: List[str]
) -> Tuple[bool, str, List[str]]:
    """
    Deterministic unsourced-number check:
    - Exempts bracketed placeholders [MRR threshold], [$4.2M], etc.
    - Extracts sourced numbers from raw_thoughts, resume/about_me, research snippets.
    - Hard-fails first-person claims with unsourced figures (e.g. 'I scaled to $4.2M').
    - Warns on generic thresholds (e.g. 'databases over 500GB').

    Returns:
        (passed: bool, fail_reason: str, warnings: list[str])
    """
    source_numbers = extract_source_numbers(source_texts)

    # 1. Exempt bracketed placeholders by removing them
    clean_draft = PLACEHOLDER_REGEX.sub(" ", draft)

    # Strip markdown link destinations [text](url) -> text
    clean_draft = re.sub(r"\[([^\]]+)\]\([^\)]+\)", r"\1", clean_draft)

    # Split draft into sentences / lines
    # Split by periods, question marks, exclamation marks, or newlines
    sentences = re.split(r"(?<=[.!?\n])\s+", clean_draft)

    warnings: List[str] = []

    for sentence in sentences:
        s_clean = sentence.strip()
        if not s_clean:
            continue

        # Ignore list numbering at start of line (e.g. "1. ", "2) ", "#3 ")
        s_no_list = re.sub(r"^(?:[•\*\-\d\.]+\s*|\#\d+\s*)", "", s_clean)

        # Find all figures in sentence
        figures = FIGURE_REGEX.findall(s_no_list)
        if not figures:
            continue

        is_first_person = bool(FIRST_PERSON_REGEX.search(s_no_list))

        for fig in figures:
            fig_clean = fig.strip()
            # Skip empty or calendar years (e.g. 2024)
            if not fig_clean or YEAR_REGEX.fullmatch(fig_clean):
                continue

            # Skip single digit non-metrics like "1" or "2" when used as count if not first-person claim
            if fig_clean in {"1", "2", "3"} and not any(c in fig_clean for c in "$%kmbx"):
                if not is_first_person:
                    continue

            if not is_number_sourced(fig_clean, source_numbers):
                if is_first_person:
                    # HARD FAIL: First-person claim with unsourced figure
                    reason = (
                        f"Unsourced first-person numeric claim: figure '{fig_clean}' in "
                        f"'{s_clean}' not found in raw thoughts, profile/resume, or research."
                    )
                    return False, reason, warnings
                else:
                    # WARN: Generic unsourced threshold / rule of thumb
                    warn = (
                        f"Generic unsourced threshold: figure '{fig_clean}' in '{s_clean}'"
                    )
                    warnings.append(warn)

    return True, "", warnings
