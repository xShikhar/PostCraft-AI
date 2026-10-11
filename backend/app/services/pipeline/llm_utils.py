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
    max_retries: int = 1,
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
            return await invoker_fn(*args, **kwargs)
        except Exception as e:
            attempt += 1
            err_str = str(e).lower()
            is_rate_limit = (
                "429" in err_str
                or "resourceexhausted" in err_str
                or "quota" in err_str
                or "rate limit" in err_str
            )
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

            if attempt > max_retries or not is_transient:
                logger.error(f"[{node_name}] LLM invocation failed after {attempt} attempt(s): {e}")
                raise

            # Bounded exponential backoff with jitter
            raw_delay = min(max_delay, base_delay * (1.5 ** (attempt - 1)))
            jitter = random.uniform(0.1, 0.4)
            sleep_time = min(max_delay, raw_delay + jitter)

            logger.warning(
                f"[{node_name}] Transient LLM error (attempt {attempt}/{max_retries}): {e}. "
                f"Retrying in {sleep_time:.2f}s..."
            )

            if telemetry and hasattr(telemetry, "record_call"):
                telemetry.record_call(
                    node_name=node_name,
                    target="gemini",
                    operation="rate_limit_backoff",
                    duration_s=sleep_time,
                    status="retry",
                    error_message=str(e),
                )

            await asyncio.sleep(sleep_time)
