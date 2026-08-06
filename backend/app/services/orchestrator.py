import json
import logging
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models import Generation, StyleProfile, CostLog
from app.schemas.orchestrator import PipelineState, ExtractedPattern, GeneratedDrafts
from app.services.research import cascading_search
from app.services.vector import vector_service
from app.config import get_settings

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)


def check_originality(draft: str, snippets: List[str]) -> Tuple[bool, str]:
    """Checks for 6-word overlaps between the draft and any source snippets."""
    def get_ngrams(text: str, n: int = 6):
        words = text.lower().split()
        return set(tuple(words[i:i+n]) for i in range(len(words)-n+1))
        
    draft_ngrams = get_ngrams(draft)
    if not draft_ngrams:
        return True, ""
        
    for snippet in snippets:
        snippet_ngrams = get_ngrams(snippet)
        overlap = draft_ngrams.intersection(snippet_ngrams)
        if overlap:
            matched_phrase = " ".join(list(overlap)[0])
            return False, f"Plagiarism detected. 6+ word match: '{matched_phrase}'"
            
    return True, ""

class PostGenerationPipeline:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.client = genai.Client(api_key=self.settings.GEMINI_API_KEY) if self.settings.GEMINI_API_KEY else None

    async def _log_cost(self, operation: str, response, generation_id=None):
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            prompt_tokens = response.usage_metadata.prompt_token_count
            completion_tokens = response.usage_metadata.candidates_token_count
            # Gemini 2.5 Flash pricing: $0.30 / 1M prompt, $2.50 / 1M completion
            cost = (prompt_tokens / 1_000_000 * 0.30) + (completion_tokens / 1_000_000 * 2.50)
            
            cost_log = CostLog(
                generation_id=generation_id,
                operation=operation,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                estimated_cost_usd=cost
            )
            self.session.add(cost_log)
            # Commit will happen during node_save_generation or natural flow

    async def run(self, state: PipelineState) -> PipelineState:
        """Executes the pipeline using a dynamic state machine loop."""
        try:
            logger.info(f"Starting dynamic pipeline for Generation {state.generation_id}")
            
            # Step 1: Research
            state = await self.node_research(state)
            if state.error:
                return await self.node_save_generation(state)
                
            # Check for cache-hit short-circuit
            skip_extraction = False
            recent_profile = None
            if state.research_result and state.research_result.source == "cache":
                # Check if we have a StyleProfile for this user/platform
                stmt = select(StyleProfile).where(
                    StyleProfile.user_id == state.user_id,
                    StyleProfile.platform == state.platform
                ).order_by(StyleProfile.id.desc()).limit(1)
                res = await self.session.execute(stmt)
                recent_profile = res.scalars().first()
                if recent_profile:
                    logger.info("Cache hit + recent profile found. Skipping pattern extraction.")
                    skip_extraction = True
                    # Populate extracted_pattern from DB so draft generation has constraints
                    state.extracted_pattern = ExtractedPattern(
                        structure=recent_profile.structure,
                        tone=recent_profile.tone,
                        pacing=recent_profile.pacing,
                        storytelling_technique=recent_profile.storytelling_technique,
                        formatting=recent_profile.formatting,
                        cta_style=recent_profile.cta_style
                    )

            # Step 2: Pattern Extraction (if not skipped)
            if not skip_extraction:
                state = await self.node_pattern_extraction(state)
                if state.error:
                    return await self.node_save_generation(state)

            # Step 3: Draft Generation & Quality Check Loop
            while state.retry_count <= 2:
                state = await self.node_draft_generation(state)
                if state.error:
                    return await self.node_save_generation(state)
                    
                state = await self.node_quality_check(state)
                
                # If quality_results is empty or "PASS", we succeeded
                if not state.quality_results or state.quality_results.startswith("PASS"):
                    break
                    
                logger.warning(f"Quality Check Failed. Retry count: {state.retry_count}. Reason: {state.quality_results}")
                state.retry_count += 1
                
            # End of loop
            return await self.node_save_generation(state)
            
        except Exception as e:
            logger.error(f"Pipeline error: {str(e)}", exc_info=True)
            state.error = str(e)
            return await self.node_save_generation(state)

    async def node_research(self, state: PipelineState) -> PipelineState:
        logger.info("Executing node_research")
        result = await cascading_search(state.topic, state.platform, self.session)
        state.research_result = result
        return state

    async def node_pattern_extraction(self, state: PipelineState) -> PipelineState:
        logger.info("Executing node_pattern_extraction")
        if not self.client:
            state.error = "Gemini API key missing"
            return state

        snippets_text = "\n\n---\n\n".join(state.research_result.content_snippets)
        
        # Query ChromaDB for a historical preference
        historical_bias = ""
        past_style = vector_service.get_similar_profile(str(state.user_id), state.platform, snippets_text)
        if past_style:
            historical_bias = f"\nHere is the user's historical preferred style:\n{past_style}\nBias and blend your extraction towards this historical style where appropriate."

        prompt = f"""
        Analyze the following public {state.platform} posts about '{state.topic}'.
        
        CRITICAL INSTRUCTION:
        Extract ONLY the structural patterns, tone, pacing, storytelling techniques, formatting, and CTA styles.
        DO NOT extract the subject matter, facts, or phrases. We only want the scaffolding.
        {historical_bias}
        
        You MUST call the `extract_style_patterns` tool.
        
        POSTS:
        {snippets_text}
        """

        extract_tool = {
            "function_declarations": [
                {
                    "name": "extract_style_patterns",
                    "description": "Extracts the structural style patterns from social media posts.",
                    "parameters": {
                        "type": "OBJECT",
                        "properties": {
                            "structure": {"type": "STRING"},
                            "tone": {"type": "STRING"},
                            "pacing": {"type": "STRING"},
                            "storytelling_technique": {"type": "STRING"},
                            "formatting": {"type": "STRING"},
                            "cta_style": {"type": "STRING"}
                        },
                        "required": ["structure", "tone", "pacing", "storytelling_technique", "formatting", "cta_style"]
                    }
                }
            ]
        }

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(tools=[extract_tool])
        )
        await self._log_cost("pattern_extraction", response, state.generation_id)

        extracted = None
        if response.function_calls:
            for call in response.function_calls:
                if call.name == "extract_style_patterns":
                    args = call.args
                    extracted = ExtractedPattern(**args)
                    break
        
        if not extracted:
            logger.warning("Model did not call the extract tool. Generating empty scaffold.")
            extracted = ExtractedPattern(
                structure="Standard hook and body", tone="Professional", pacing="Moderate",
                storytelling_technique="Direct", formatting="Standard", cta_style="Question"
            )

        state.extracted_pattern = extracted

        # Save to StyleProfile for durability
        profile = StyleProfile(
            user_id=state.user_id,
            platform=state.platform,
            structure=extracted.structure,
            tone=extracted.tone,
            pacing=extracted.pacing,
            storytelling_technique=extracted.storytelling_technique,
            formatting=extracted.formatting,
            cta_style=extracted.cta_style
        )
        self.session.add(profile)
        await self.session.commit()
        await self.session.refresh(profile)
        
        # Save to ChromaDB
        style_concat = f"Structure: {extracted.structure} | Tone: {extracted.tone} | Pacing: {extracted.pacing} | Storytelling: {extracted.storytelling_technique} | Format: {extracted.formatting} | CTA: {extracted.cta_style}"
        vector_service.save_style_profile(str(profile.id), str(state.user_id), state.platform, style_concat)
        
        return state

    async def node_draft_generation(self, state: PipelineState) -> PipelineState:
        logger.info(f"Executing node_draft_generation (Retry: {state.retry_count})")
        if not self.client:
            return state

        pattern = state.extracted_pattern
        
        feedback_injection = ""
        if state.retry_count > 0 and state.quality_results:
            feedback_injection = f"""
            CRITICAL FEEDBACK FROM PREVIOUS ATTEMPT:
            Your previous drafts failed the quality check for this reason: {state.quality_results}
            You MUST fix this in your new drafts.
            """

        prompt = f"""
        You are an expert ghostwriter creating highly engaging {state.platform} posts.
        
        USER'S RAW THOUGHTS (The Substance):
        "{state.raw_thoughts}"
        
        STYLE CONSTRAINTS (The Scaffolding):
        - Structure: {pattern.structure}
        - Tone: {pattern.tone}
        - Pacing: {pattern.pacing}
        - Storytelling: {pattern.storytelling_technique}
        - Formatting: {pattern.formatting}
        - CTA: {pattern.cta_style}
        {feedback_injection}
        
        CRITICAL INSTRUCTIONS FOR NATIVE {state.platform.upper()} FORMATTING:
        1. Write a real social media post, NOT a corporate blog article.
        2. If the user does not specify a word limit or sentence count, keep the post concise (around 4-5 lines). Otherwise, strictly follow their requested length. Use line breaks to create whitespace.
        3. DO NOT use markdown headings like # or ## or ###.
        4. NEVER add promotional CTAs like "Contact sales", "Click the link", or "Book a demo" unless specifically requested in the raw thoughts. If a CTA is needed, end with a conversational question to drive engagement.
        5. Keep it authentic, human, and relatable. Avoid corporate jargon.
        6. Use a strong hook in the first line to grab attention.
        
        Write exactly 3 distinct draft variations combining the User's Substance with the Style Constraints.
        DO NOT hallucinate facts not provided by the user.
        DO NOT copy exact phrases from the style constraints.
        """

        # switched to flash as requested
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeneratedDrafts,
            )
        )
        await self._log_cost("draft_generation", response, state.generation_id)
        
        # Log Tokens/Cost
        if response.usage_metadata:
            logger.info(f"Draft Gen Token Usage - Prompt: {response.usage_metadata.prompt_token_count}, Output: {response.usage_metadata.candidates_token_count}")
        
        try:
            data = json.loads(response.text)
            state.drafts = GeneratedDrafts(**data)
        except Exception as e:
            logger.error(f"Failed to parse drafts JSON: {e}")
            state.error = "Failed to parse generated drafts."

        return state

    async def node_quality_check(self, state: PipelineState) -> PipelineState:
        logger.info("Executing node_quality_check")
        if not state.drafts:
            state.quality_results = "FAIL: No drafts to check."
            return state
            
        snippets = state.research_result.content_snippets if state.research_result else []
        drafts = [state.drafts.draft_1, state.drafts.draft_2, state.drafts.draft_3]
        
        # 1. Originality Check
        for i, draft in enumerate(drafts):
            is_original, reason = check_originality(draft, snippets)
            if not is_original:
                state.quality_results = f"Draft {i+1} failed originality: {reason}"
                return state
                
        # 2. Completeness Check via LLM
        if not self.client:
            state.quality_results = "PASS"
            return state
            
        prompt = f"""
        Analyze these 3 drafts. Do they all contain a clear Hook, a Body section, and a Call-To-Action (CTA) at the end?
        Draft 1: {state.drafts.draft_1}
        Draft 2: {state.drafts.draft_2}
        Draft 3: {state.drafts.draft_3}
        
        Respond strictly with "PASS" if all 3 have Hook/Body/CTA. If any is missing something, respond with "FAIL: [Reason]".
        """
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )
        await self._log_cost("quality_check", response, state.generation_id)
        
        if response.text and response.text.startswith("FAIL"):
            state.quality_results = response.text.strip()
        else:
            state.quality_results = "PASS"
            
        return state

    async def node_save_generation(self, state: PipelineState) -> PipelineState:
        logger.info("Executing node_save_generation")
        stmt = select(Generation).where(Generation.id == state.generation_id)
        result = await self.session.execute(stmt)
        generation = result.scalars().first()
        
        if generation:
            if state.drafts:
                generation.draft_1 = state.drafts.draft_1
                generation.draft_2 = state.drafts.draft_2
                generation.draft_3 = state.drafts.draft_3
                
                if state.retry_count > 2 and state.quality_results and not state.quality_results.startswith("PASS"):
                    generation.status = "needs_review"
                else:
                    generation.status = "editing"
                    
            if state.error:
                generation.status = "failed"
            
            self.session.add(generation)
            await self.session.commit()
            logger.info("Generation saved successfully.")
            
        return state
