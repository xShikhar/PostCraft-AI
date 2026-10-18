"""
Resume processing service.

Handles text extraction from PDF/DOCX/text resumes and one-shot Gemini
summarization into a structured JSON profile (role, industry, expertise areas,
experience level). The raw text is stored in full; the structured summary is
derived once at upload time and injected as a compact context block into
generation prompts.
"""

import io
import logging
from typing import Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

MAX_EXTRACTED_CHARS = 100_000

def extract_text(file_bytes: bytes, mime_type: str = "", filename: str = "") -> str:
    """Strict format checks with a bounded decompressed document budget."""
    import zipfile
    from pathlib import PurePath
    suffix = PurePath(filename.lower()).suffix
    if len(file_bytes) > 5 * 1024 * 1024:
        raise ValueError("Resume file too large (max 5MB)")
    if suffix == ".pdf" and file_bytes.startswith(b"%PDF-"):
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        if reader.is_encrypted or len(reader.pages) > 50:
            raise ValueError("PDF must be unencrypted and contain at most 50 pages")
        parts = []
        size = 0
        for page in reader.pages:
            chunk = page.extract_text() or ""
            size += len(chunk)
            if size > MAX_EXTRACTED_CHARS:
                raise ValueError("Extracted resume exceeds 100,000 characters")
            parts.append(chunk)
        return "\n".join(parts)
    if suffix == ".docx" and file_bytes.startswith(b"PK"):
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as archive:
            if "word/document.xml" not in archive.namelist() or sum(x.file_size for x in archive.infolist()) > 10 * 1024 * 1024 or len(archive.infolist()) > 1000:
                raise ValueError("Invalid or oversized DOCX document")
        import docx2txt
        result = docx2txt.process(io.BytesIO(file_bytes)) or ""
    elif suffix in (".txt", ".md"):
        try:
            result = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValueError("Text resumes must use UTF-8 encoding") from None
        if any(not c.isprintable() and c not in "\n\r\t" for c in result):
            raise ValueError("Text resume contains binary control characters")
    else:
        raise ValueError("Unsupported resume file type. Upload PDF, DOCX, TXT or Markdown.")
    if len(result) > MAX_EXTRACTED_CHARS:
        raise ValueError("Extracted resume exceeds 100,000 characters")
    return result


# ---------------------------------------------------------------------------
# Structured summarization via Gemini
# ---------------------------------------------------------------------------

class ResumeSummary(BaseModel):
    """Structured summary extracted from a resume."""
    role: str = Field(description="The person's current or most recent job title/role.")
    industry: str = Field(description="The primary industry they work in (e.g. B2B SaaS, fintech, consulting).")
    expertise_areas: list[str] = Field(
        description="Top 3-5 areas of expertise or skill domains mentioned in the resume."
    )
    experience_level: str = Field(
        description="Overall experience level: 'junior' (0-3 yrs), 'mid' (3-7 yrs), or 'senior' (7+ yrs). Estimate from the resume content."
    )
    past_employer: str = Field(
        default="",
        description="The most recent or most prominent past employer / company name. Empty if not clearly identifiable."
    )
    education: str = Field(
        default="",
        description="Highest or most prominent education credential (e.g. 'BS Computer Science, MIT' or 'MBA, Stanford'). Empty if not clearly identifiable."
    )


async def summarize_to_structured(
    raw_text: str,
    gemini_api_key: str,
    user_id: str | None = None,
) -> ResumeSummary:
    """
    Calls Gemini once to summarize a resume's raw text into a structured profile.
    Runs at upload time only — no cost on subsequent generations.
    """
    from app.services.pipeline.llm_utils import create_gemini_client, invoke_with_bounded_backoff

    from app.core.config import get_settings
    from app.services.pipeline.telemetry import operation_telemetry
    import uuid
    settings = get_settings()
    llm = create_gemini_client(
        model=settings.GEMINI_FAST_MODEL or settings.GEMINI_MODEL,
        google_api_key=gemini_api_key,
        max_retries=0,
        timeout=30.0,
    )
    structured_llm = llm.with_structured_output(ResumeSummary, include_raw=True)

    prompt = f"""
You are an HR analyst reading a candidate's resume. Extract a structured summary.

Return exactly the structured fields requested. Be specific and concise.

RESUME TEXT:
{raw_text[:8000]}
"""
    try:
        async with operation_telemetry("resume:" + str(uuid.uuid4()), "resume_summary") as telemetry:
            summary = await invoke_with_bounded_backoff(structured_llm.ainvoke, prompt, node_name="resume_summary", telemetry=telemetry)
        if isinstance(summary, dict):
            parsed, raw = summary.get("parsed"), summary.get("raw")
            if raw:
                from app.services.pipeline.background_tasks import run_in_background, bg_log_cost
                usage = getattr(raw, "usage_metadata", None) or {}
                run_in_background(bg_log_cost("", "resume_summary", usage.get("input_tokens", 0), usage.get("output_tokens", 0), user_id=user_id, model=settings.GEMINI_FAST_MODEL or settings.GEMINI_MODEL))
            if parsed is None:
                raise ValueError("Resume summary unavailable")
            return parsed
        return summary
    except Exception as e:
        logger.error(f"Resume summarization failed: {type(e).__name__}")
        raise ValueError("Resume summarization is unavailable. Please try again.") from None
