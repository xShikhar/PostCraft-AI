"""
LangGraph Post Generation Pipeline

This module defines the topology of the pipeline graph. 
It uses four key LangGraph concepts:

1. State (`GraphState`): A TypedDict that holds the data flowing through the pipeline.
   - Defined in `app.services.pipeline.state.py`, referenced here when building the graph (line 58).
2. Nodes: Async functions that take the State, do work, and return state updates.
   - We add them using `builder.add_node(...)` (lines 60-65).
3. Conditional Edges: Functions that examine the State and decide which Node to run next.
   - We add them using `builder.add_conditional_edges(...)` (lines 70-109).
4. Compiled Graph: The final executable object that runs the workflow.
   - Created via `builder.compile()` (line 114) and returned for use.

To modify the graph structure (e.g. adding a new step), you would update this file.
To modify what a specific step actually does, you would edit the corresponding function in `nodes.py`.
"""

import logging
from typing import Literal

from langgraph.graph import StateGraph, START, END

from app.services.pipeline.state import GraphState
from app.services.pipeline.deps import PipelineDeps
from app.services.pipeline.nodes import (
    node_research,
    node_pattern_extraction,
    node_draft_generation,
    node_quality_check,
    node_increment_retry,
    node_save_generation,
    MAX_RETRIES,
)

logger = logging.getLogger(__name__)

def bind(node_fn, deps: PipelineDeps):
    """
    Creates an async closure that binds PipelineDeps to a node function.
    LangGraph requires nodes to be coroutine functions; using a raw lambda
    fails LangGraph's async detection. This closure correctly preserves the async signature.
    """
    async def _node(state: GraphState) -> dict:
        return await node_fn(state, deps)
    return _node

def build_graph(deps: PipelineDeps):
    """Builds and compiles the StateGraph."""
    
    builder = StateGraph(GraphState)

    # Add nodes using the safe async bind helper
    builder.add_node("research", bind(node_research, deps))
    builder.add_node("pattern_extraction", bind(node_pattern_extraction, deps))
    builder.add_node("draft_generation", bind(node_draft_generation, deps))
    builder.add_node("quality_check", bind(node_quality_check, deps))
    builder.add_node("increment_retry", bind(node_increment_retry, deps))
    builder.add_node("save_generation", bind(node_save_generation, deps))

    # Entry edge
    builder.add_edge(START, "research")

    # Conditional Routers
    def route_after_research(state: GraphState) -> Literal["save_generation", "pattern_extraction", "draft_generation"]:
        if state.get("error"): return "save_generation"
        if state.get("skip_extraction"): return "draft_generation"
        return "pattern_extraction"

    builder.add_conditional_edges(
        "research",
        route_after_research,
        {"pattern_extraction": "pattern_extraction", "draft_generation": "draft_generation", "save_generation": "save_generation"},
    )

    def route_after_extraction(state: GraphState) -> Literal["draft_generation", "save_generation"]:
        if state.get("error"): return "save_generation"
        return "draft_generation"

    builder.add_conditional_edges(
        "pattern_extraction",
        route_after_extraction,
        {"draft_generation": "draft_generation", "save_generation": "save_generation"},
    )

    def route_after_drafts(state: GraphState) -> Literal["quality_check", "save_generation"]:
        if state.get("error"): return "save_generation"
        return "quality_check"

    builder.add_conditional_edges(
        "draft_generation",
        route_after_drafts,
        {"quality_check": "quality_check", "save_generation": "save_generation"},
    )

    def route_after_quality_with_retry(state: GraphState) -> Literal["increment_retry", "save_generation"]:
        qr = state.get("quality_results", "")
        if not qr or qr.startswith("PASS"):
            return "save_generation"
        if state.get("retry_count", 0) < MAX_RETRIES:
            logger.warning(f"Quality Check Failed. Retry count: {state.get('retry_count', 0)}. Reason: {qr}")
            return "increment_retry"
        return "save_generation"

    builder.add_conditional_edges(
        "quality_check",
        route_after_quality_with_retry,
        {"increment_retry": "increment_retry", "save_generation": "save_generation"},
    )

    # Unconditional loop back from increment
    builder.add_edge("increment_retry", "draft_generation")

    # Terminal node
    builder.add_edge("save_generation", END)

    return builder.compile()
