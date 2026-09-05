from app.services.pipeline.state import GraphState, ExtractedPattern, GeneratedDrafts

# Banned AI tells — these are the most common giveaway phrases from GPT-style models.
# If any of these appear in a draft, the substance gate will fail it.
BANNED_AI_TELLS = [
    "In today's fast-paced world",
    "Let me be clear",
    "Here's the thing",
    "Game-changer",
    "Without further ado",
    "Dive in",
    "unlock your potential",
    "elevate your",
    "harness the power of",
    "In conclusion",
    "At the end of the day",
    "It is what it is",
    "Let's dive in",
    "Are you ready to",
    "Here's why",
    "unleash",
    "leverage",  # over-used in corporate AI posts
    "robust solution",
    "in the world of",
    "the truth is",
    "navigate the complexities",
]

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

# Voice rules: what a specific human writer sounds like vs. what an AI assistant sounds like.
VOICE_RULES = """
- Write like a specific human with a point of view, not like an AI trying to sound like a thought leader.
- Vary sentence length deliberately — mix short punchy sentences with longer ones. Never default to uniform medium-length sentences.
- Prefer concrete over abstract. "I lost $4,200 in 3 weeks" beats "I experienced significant financial challenges."
- Take a position. Disagree with something. A post that everyone agrees with is forgettable.
- Have an opinion the reader might find slightly contrarian. If the reader can't disagree with you, you haven't said anything.
- Open with a hook that creates a curiosity gap or names a specific moment. Never start with "I" followed by a generic statement of intent ("I want to talk about", "I think we need to discuss").
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
You are an expert ghostwriter generating highly engaging content. The writer you're ghosting for is a specific human with a specific voice — your job is to sound like them, not like a generic AI assistant.

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

VOICE RULES (non-negotiable):
{VOICE_RULES}

ENGAGEMENT RULES:
{ENGAGEMENT_RULES}

LEAD-GEN CTA RULES:
{LEAD_GEN_RULES}

BANNED PHRASES — DO NOT USE ANY OF THESE:
{', '.join(BANNED_AI_TELLS)}

Also AVOID these structural AI tells:
- Perfect three-part symmetry ("First... Second... Third...") unless the post genuinely has three points
- Em-dash-every-sentence cadence (using "—" as your default sentence break)
- Hollow motivational filler (sentences that sound deep but say nothing)
- Generic openers ("Have you ever wondered...", "What if I told you...", "Imagine this...")

IMPORTANT STYLE OVERRIDE:
If the stylistic patterns conflict with the Lead-Gen CTA rules, Voice rules, Engagement rules, or Banned phrases, those rules ALWAYS WIN. You have permission to deviate from the historical style to ensure the post sounds like a real human with a real point of view.

Generate 3 distinct drafts.
Draft 1, Draft 2, and Draft 3 MUST take genuinely different angles or use different hooks. Do not just reword the same post three times.
"""

QUALITY_CHECK_PROMPT = f"""
You are an expert content reviewer. Evaluate these drafts against the following standards. Be a tough, honest editor — your job is to catch the kind of generic, AI-flavored writing that nobody wants to read.

=== CHECK 1: Structural Completeness ===
Does the post have a clear hook, body, and conclusion/CTA?

=== CHECK 2: Lead-Gen CTA Quality ===
Does the CTA follow these rules?
{LEAD_GEN_RULES}
Bare "Thoughts?", "Agree?", or "Let me know in the comments" MUST FAIL.

=== CHECK 3: Substance / Originality of Thought ===
This is the most important check. A post can be structurally perfect and still be terrible if it says nothing specific.

FAIL a draft for any of these reasons:
- The post is generic motivational filler that sounds deep but says nothing
- It makes a claim without any specific number, concrete example, or anecdote
- It has no disagreeable point of view — anyone would agree with everything in it
- It opens with a generic AI-style hook ("Have you ever wondered...", "What if I told you...", "Imagine this...")
- It contains any of these banned phrases: {', '.join(BANNED_AI_TELLS)}
- It uses hollow filler like "leverage", "unlock your potential", "elevate your", "harness the power of"
- It exhibits AI structural tells: perfect three-part symmetry where unnatural, em-dash-every-sentence cadence, or sentences that sound deep but convey no information

PASS a draft only if it:
- Takes a clear position the reader could disagree with
- Contains at least one specific number, claim, or concrete moment
- Sounds like a specific human wrote it, not a language model
- Has substance behind its structure

Additionally, give an overall SUBSTANCE SCORE from 1-10 for the whole set (1 = pure filler, 10 = genuinely original and specific). Below 5 means the set as a whole is too generic.

DRAFTS TO EVALUATE:
Draft 1:
{{draft_1}}

Draft 2:
{{draft_2}}

Draft 3:
{{draft_3}}

If any draft fails, provide specific feedback in `failed_drafts` that names the actual problem (e.g. "Draft 2 opens with 'In today's fast-paced world' — replace with a specific moment or contrarian claim").
Set `failed_check` to one of: "structural_completeness", "lead_gen_cta", or "substance".

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
