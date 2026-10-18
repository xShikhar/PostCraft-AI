import asyncio
import logging
import random
import time
from typing import Any, Callable, Coroutine, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def create_gemini_client(
    model: Optional[str] = None,
    google_api_key: Optional[str] = None,
    temperature: Optional[float] = None,
    thinking_budget: Optional[int] = None,
    max_retries: int = 0,
    timeout: float = 60.0,
) -> ChatGoogleGenerativeAI:
    """
    Factory for creating ChatGoogleGenerativeAI clients with bounded retry configuration,
    pinned model version, and optional thinking budget.
    """
    settings = get_settings()
    resolved_model = model or settings.GEMINI_MODEL
    resolved_key = google_api_key or settings.GEMINI_API_KEY

    kwargs: dict[str, Any] = {
        "model": resolved_model,
        "google_api_key": resolved_key,
        "max_retries": max_retries,
        "timeout": timeout,
    }
    if temperature is not None:
        kwargs["temperature"] = temperature
    if thinking_budget is not None and "lite" not in resolved_model.lower():
        kwargs["thinking_budget"] = thinking_budget

    return ChatGoogleGenerativeAI(**kwargs)


async def invoke_with_bounded_backoff(
    invoker_fn: Callable[..., Coroutine[Any, Any, Any]],
    *args: Any,
    max_retries: int = 2,
    base_delay: float = 1.0,
    max_delay: float = 3.0,
    telemetry: Any = None,
    node_name: str = "llm",
    **kwargs: Any,
) -> Any:
    """
    Executes an async LLM invocation with bounded, jittered backoff on rate-limit
    and transient infrastructure errors.
    
    Prevents silent, runaway delays from default exponential backoffs (which sleep 32s-64s).
    """
    attempt = 0
    while True:
        try:
            started = time.perf_counter()
            result = await invoker_fn(*args, **kwargs)
            if telemetry:
                raw = result.get("raw") if isinstance(result, dict) else result
                usage = getattr(raw, "usage_metadata", None) or {}
                telemetry.record_call(node_name=node_name, target="gemini", operation="invoke", duration_s=time.perf_counter() - started, prompt_tokens=usage.get("input_tokens", 0), completion_tokens=usage.get("output_tokens", 0))
            return result
        except Exception as e:
            if telemetry:
                telemetry.record_call(node_name=node_name, target="gemini", operation="invoke", duration_s=time.perf_counter() - started, status="error", error_message=type(e).__name__)
            attempt += 1
            err_str = str(e).lower()
            is_rate_limit = (
                "429" in err_str
                or "resourceexhausted" in err_str
                or "quota" in err_str
                or "rate limit" in err_str
            )
            hard_quota = any(marker in err_str for marker in ("daily", "per day", "billing", "insufficient_quota", "limit: 0"))
            is_transient = (
                is_rate_limit
                or "503" in err_str
                or "504" in err_str
                or "unavailable" in err_str
                or "timeout" in err_str
                or "deadline" in err_str
                or "expired" in err_str
                or "exceeded" in err_str
            )

            if attempt > max_retries or not is_transient or hard_quota:
                logger.error(f"[{node_name}] LLM invocation failed after {attempt} attempt(s): {type(e).__name__}")
                raise

            # Bounded exponential backoff with jitter
            raw_delay = min(max_delay, base_delay * (1.5 ** (attempt - 1)))
            sleep_time = random.uniform(0, raw_delay)

            logger.warning(
                f"[{node_name}] Transient LLM error (attempt {attempt}/{max_retries}): {type(e).__name__}. "
                f"Retrying in {sleep_time:.2f}s..."
            )

            if telemetry and hasattr(telemetry, "record_call"):
                telemetry.record_call(
                    node_name=node_name,
                    target="backoff",
                    operation="rate_limit_backoff",
                    backoff_sleep_s=sleep_time,
                    duration_s=sleep_time,
                    status="retry",
                    error_message=type(e).__name__,
                )

            await asyncio.sleep(sleep_time)
