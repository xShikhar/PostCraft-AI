import time
import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

logger = logging.getLogger("app.telemetry")

@dataclass
class CallMetric:
    target: str           # "gemini", "tavily", "serpapi", "chromadb", "postgres"
    operation: str        # e.g. "pattern_extraction", "draft_generation", "query_search"
    duration_s: float
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    status: str = "ok"    # "ok", "error", "retry"
    error_message: Optional[str] = None
    backoff_sleep_s: float = 0.0

@dataclass
class NodeMetric:
    name: str
    duration_s: float = 0.0
    start_time: float = 0.0
    end_time: float = 0.0
    retry_count: int = 0
    status: str = "ok"
    calls: List[CallMetric] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

class PipelineTelemetry:
    """
    Per-generation telemetry collector.
    Captures exact node timings, external API calls (Gemini, Tavily, ChromaDB, DB),
    token usage (prompt, completion, reasoning), retries, and sleeps.
    """

    def __init__(self, generation_id: str):
        self.generation_id = str(generation_id)
        self.start_wall_time = time.perf_counter()
        self.end_wall_time: Optional[float] = None
        self.total_wall_time_s: float = 0.0
        
        self.nodes: Dict[str, NodeMetric] = {}
        self.retry_loops_taken: int = 0
        self.total_gemini_calls: int = 0
        self.total_gemini_time_s: float = 0.0
        self.total_gemini_prompt_tokens: int = 0
        self.total_gemini_completion_tokens: int = 0
        self.total_gemini_reasoning_tokens: int = 0
        self.total_backoff_sleep_s: float = 0.0
        self.total_search_time_s: float = 0.0
        self.total_chroma_time_s: float = 0.0
        self.total_db_time_s: float = 0.0
        self.error_retries_count: int = 0

    @asynccontextmanager
    async def measure_node(self, node_name: str, retry_count: int = 0):
        # Handle nodes that execute multiple times (e.g. draft_generation on retry)
        node_key = f"{node_name}_r{retry_count}" if retry_count > 0 else node_name
        metric = NodeMetric(name=node_name, retry_count=retry_count, start_time=time.perf_counter())
        self.nodes[node_key] = metric
        try:
            yield metric
            metric.status = "ok"
        except Exception as e:
            metric.status = "error"
            metric.metadata["error"] = type(e).__name__
            raise
        finally:
            metric.end_time = time.perf_counter()
            metric.duration_s = round(metric.end_time - metric.start_time, 4)

    def record_call(
        self,
        node_name: str,
        target: str,
        operation: str,
        duration_s: float,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        reasoning_tokens: int = 0,
        status: str = "ok",
        error_message: Optional[str] = None,
        backoff_sleep_s: float = 0.0,
    ) -> CallMetric:
        call = CallMetric(
            target=target,
            operation=operation,
            duration_s=round(duration_s, 4),
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            reasoning_tokens=reasoning_tokens,
            status=status,
            error_message=error_message,
            backoff_sleep_s=round(backoff_sleep_s, 4),
        )
        
        # Attach to latest active node metric matching node_name
        for key in reversed(list(self.nodes.keys())):
            if self.nodes[key].name == node_name:
                self.nodes[key].calls.append(call)
                break

        # Aggregate metrics
        if target == "gemini":
            self.total_gemini_calls += 1
            self.total_gemini_time_s += duration_s
            self.total_gemini_prompt_tokens += prompt_tokens
            self.total_gemini_completion_tokens += completion_tokens
            self.total_gemini_reasoning_tokens += reasoning_tokens
        elif target in ("tavily", "serpapi"):
            self.total_search_time_s += duration_s
        elif target == "chromadb":
            self.total_chroma_time_s += duration_s
        elif target == "postgres":
            self.total_db_time_s += duration_s

        if backoff_sleep_s > 0:
            self.total_backoff_sleep_s += backoff_sleep_s
            self.error_retries_count += 1

        return call

    def finish(self) -> Dict[str, Any]:
        self.end_wall_time = time.perf_counter()
        self.total_wall_time_s = round(self.end_wall_time - self.start_wall_time, 4)
        summary = self.to_dict()
        logger.info("PIPELINE_TELEMETRY: %s", json.dumps(summary))
        return summary

    def to_dict(self) -> Dict[str, Any]:
        node_timings = {}
        for key, nm in self.nodes.items():
            node_timings[key] = {
                "duration_s": nm.duration_s,
                "retry_count": nm.retry_count,
                "status": nm.status,
                "metadata": nm.metadata,
                "calls": [
                    {
                        "target": c.target,
                        "op": c.operation,
                        "dur_s": c.duration_s,
                        "tokens": {
                            "prompt": c.prompt_tokens,
                            "completion": c.completion_tokens,
                            "reasoning": c.reasoning_tokens,
                        },
                        "status": c.status,
                        "sleep_s": c.backoff_sleep_s,
                    }
                    for c in nm.calls
                ],
            }

        return {
            "generation_id": self.generation_id,
            "total_wall_time_s": self.total_wall_time_s,
            "retry_loops_taken": self.retry_loops_taken,
            "gemini": {
                "calls": self.total_gemini_calls,
                "time_s": round(self.total_gemini_time_s, 4),
                "prompt_tokens": self.total_gemini_prompt_tokens,
                "completion_tokens": self.total_gemini_completion_tokens,
                "reasoning_tokens": self.total_gemini_reasoning_tokens,
            },
            "search_time_s": round(self.total_search_time_s, 4),
            "chroma_time_s": round(self.total_chroma_time_s, 4),
            "db_time_s": round(self.total_db_time_s, 4),
            "backoff_sleep_s": round(self.total_backoff_sleep_s, 4),
            "nodes": node_timings,
        }

@asynccontextmanager
async def operation_telemetry(identifier: str, operation: str):
    telemetry = PipelineTelemetry(generation_id=identifier)
    try:
        async with telemetry.measure_node(operation):
            yield telemetry
    finally:
        telemetry.finish()
