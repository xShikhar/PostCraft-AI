from app.services.pipeline.state import GraphState, ExtractedPattern, GeneratedDrafts

PATTERN_EXTRACTION_PROMPT = """
You are an expert ghostwriter and content analyst.

Analyze these highly successful past {platform} posts:
{historical_bias}

Extract the underlying structural patterns, tone, and pacing. Ignore the specific subject matter, 
focus entirely on the writing style and mechanics.

Additionally, consider these research snippets about the current topic to ensure the style is appropriate:
{snippets_text}

Return your analysis in the required structured format.
"""

# New concrete lead-gen rules for draft generation
LEAD_GEN_RULES = """
- If the user provides a profile context suggesting they offer a service or product: The CTA MUST drive DMs or profile visits. Frame it as an invitation (e.g. "Send me a DM if you're struggling with X"), not a hard pitch.
- If the user is building authority/personal brand (or profile context is absent): The CTA MUST drive saves/shares or ask a specific, opinion-eliciting question (e.g. "What's the one metric you track for X?").
- If the user is job-seeking/networking: The CTA MUST invite connection requests or specific expertise-relevant replies.
- FORBIDDEN CTAs: Do NOT use bare "Thoughts?", "Agree?", or "Let me know in the comments." Do NOT use generic engagement bait unconnected to a real outcome.
"""

ENGAGEMENT_RULES = """
- Specific numbers and claims outperform vague ones.
- A stated (mild) disagreement with common wisdom outperforms neutral takes.
- Open loops in the first line (a claim that needs the rest of the post to make sense) outperform front-loaded conclusions.
"""

LINKEDIN_PLATFORM_GUIDANCE = """
Platform: LinkedIn
Format for professional yet conversational tone. Use whitespace effectively (line breaks). Avoid excessive emojis.
"""

X_PLATFORM_GUIDANCE = """
Platform: X (Twitter)
Format for a threaded or short punchy tweet style. Maximize impact in the first 280 characters.
"""

DRAFT_GENERATION_PROMPT = f"""
You are an expert ghostwriter generating highly engaging content.

TOPIC: {{topic}}
RAW THOUGHTS: {{raw_thoughts}}
USER PROFILE CONTEXT: {{profile_context}}

RESEARCH CONTEXT:
{{snippets_text}}

STRUCTURAL & STYLISTIC PATTERNS TO FOLLOW:
Structure: {{structure}}
Tone: {{tone}}
Pacing: {{pacing}}
Storytelling: {{storytelling_technique}}
Formatting: {{formatting}}
CTA Style: {{cta_style}}

PLATFORM GUIDANCE:
{{platform_guidance}}

ENGAGEMENT RULES:
{ENGAGEMENT_RULES}

LEAD-GEN CTA RULES:
{LEAD_GEN_RULES}

IMPORTANT STYLE OVERRIDE:
If the stylistic patterns conflict with the Lead-Gen CTA rules or Engagement rules, the Lead-Gen and Engagement rules ALWAYS WIN. You have permission to deviate from the historical style to ensure a strong, conversion-focused CTA.

Generate 3 distinct drafts. 
Draft 1, Draft 2, and Draft 3 MUST take genuinely different angles or use different hooks. Do not just reword the same post three times.
"""

QUALITY_CHECK_PROMPT = f"""
You are an expert content reviewer. Evaluate these drafts against the following standards.

Check 1: Structural Completeness
Does the post have a clear hook, body, and conclusion/CTA?

Check 2: Lead-Gen CTA Quality
Does the CTA follow these rules?
{LEAD_GEN_RULES}
Bare "Thoughts?", "Agree?", or "Let me know in the comments" MUST FAIL.

DRAFTS TO EVALUATE:
Draft 1:
{{draft_1}}

Draft 2:
{{draft_2}}

Draft 3:
{{draft_3}}

If any draft fails, provide specific feedback in `failed_drafts`.
Example feedback: "Draft 2's CTA 'What do you think?' is generic engagement bait with no conversion mechanism. Replace with a CTA that invites DMs about [topic] or asks a specific question tied to the user's expertise."

Return the results in the required structured format.
"""

def build_pattern_prompt(state: GraphState, historical_bias: str, snippets_text: str) -> str:
    return PATTERN_EXTRACTION_PROMPT.format(
        platform=state.get('platform', 'unknown'),
        topic=state.get('topic', ''),
        historical_bias=historical_bias,
        snippets_text=snippets_text
    )

def build_draft_prompt(state: GraphState, pattern: ExtractedPattern, snippets_text: str) -> str:
    platform = state.get('platform', '').lower()
    platform_guidance = LINKEDIN_PLATFORM_GUIDANCE if platform == "linkedin" else X_PLATFORM_GUIDANCE
    
    return DRAFT_GENERATION_PROMPT.format(
        topic=state.get('topic', ''),
        raw_thoughts=state.get('raw_thoughts', ''),
        profile_context=state.get('profile_context') or "None provided",
        snippets_text=snippets_text,
        structure=pattern.structure,
        tone=pattern.tone,
        pacing=pattern.pacing,
        storytelling_technique=pattern.storytelling_technique,
        formatting=pattern.formatting,
        cta_style=pattern.cta_style,
        platform_guidance=platform_guidance
    )

def build_quality_prompt(state: GraphState, drafts_obj: GeneratedDrafts) -> str:
    return QUALITY_CHECK_PROMPT.format(
        draft_1=drafts_obj.draft_1,
        draft_2=drafts_obj.draft_2,
        draft_3=drafts_obj.draft_3
    )
