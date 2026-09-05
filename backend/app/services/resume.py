"""
Resume processing service.

Handles text extraction from PDF/DOCX/text resumes and one-shot Gemini
summarization into a structured JSON profile (role, industry, expertise areas,
experience level). The raw text is stored in full; the structured summary is
derived once at upload time and injected as a compact context block into
generation prompts.
"""

import logging
from typing import Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text(file_bytes: bytes, mime_type: str) -> str:
    """
    Extract plain text from a resume file based on its MIME type.
    Falls back to UTF-8 decode for plain text files.
    Raises ValueError for unsupported types.
    """
    if mime_type in ("application/pdf", "application/x-pdf"):
        return _extract_pdf(file_bytes)
    elif mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return _extract_docx(file_bytes)
    elif mime_type in ("text/plain", "text/markdown"):
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(
            f"Unsupported resume file type: {mime_type}. "
            "Please upload a PDF, DOCX, or plain text file."
        )


def _extract_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using pdfplumber."""
    try:
        import pdfplumber
    except ImportError:
        logger.warning("pdfplumber not installed; using fallback raw text extraction")
        return _fallback_text_extraction(file_bytes)

    text_parts: list[str] = []
    try:
        import io
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return _fallback_text_extraction(file_bytes)

    result = "\n".join(text_parts)
    if not result.strip():
        logger.warning("PDF text extraction returned empty; using fallback")
        return _fallback_text_extraction(file_bytes)
    return result


def _extract_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX using docx2txt."""
    try:
        import docx2txt
    except ImportError:
        logger.warning("docx2txt not installed; using fallback raw text extraction")
        return _fallback_text_extraction(file_bytes)

    try:
        import io
        result = docx2txt.process(io.BytesIO(file_bytes))
        if not result or not result.strip():
            logger.warning("DOCX extraction returned empty; using fallback")
            return _fallback_text_extraction(file_bytes)
        return result
    except Exception as e:
        logger.error(f"DOCX extraction failed: {e}")
        return _fallback_text_extraction(file_bytes)


def _fallback_text_extraction(file_bytes: bytes) -> str:
    """Last-resort extraction: try UTF-8, then latin-1."""
    for encoding in ("utf-8", "latin-1"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="replace")


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
) -> ResumeSummary:
    """
    Calls Gemini once to summarize a resume's raw text into a structured profile.
    Runs at upload time only — no cost on subsequent generations.
    """
    from langchain_google_genai import ChatGoogleGenerativeAI

    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=gemini_api_key,
    )
    structured_llm = llm.with_structured_output(ResumeSummary, include_raw=False)

    prompt = f"""
You are an HR analyst reading a candidate's resume. Extract a structured summary.

Return exactly the structured fields requested. Be specific and concise.

RESUME TEXT:
{raw_text[:8000]}
"""
    try:
        summary = await structured_llm.ainvoke(prompt)
        return summary
    except Exception as e:
        logger.error(f"Resume summarization failed: {e}")
        # Graceful degradation: return empty summary rather than failing the upload
        return ResumeSummary(
            role="",
            industry="",
            expertise_areas=[],
            experience_level="",
        )
