import { normalizeArtStyle, type ArtStyle } from '@/lib/art-styles'

const ART_STYLE_PROMPTS: Record<ArtStyle, { label: string; promptEn: string }> = {
    manga: {
        label: 'Manga',
        promptEn: 'Japanese manga illustration style, hand-drawn 2D art, clean black ink linework, cel-shaded coloring, large expressive anime eyes, stylized proportions. This is a DRAWN ILLUSTRATION, NOT a photograph. No photorealism, no real human faces.',
    },
    manhua: {
        label: 'Manhua',
        promptEn: 'Chinese manhua illustration style, 2D hand-drawn art, traditional ink wash painting influence, elegant flowing linework, detailed character designs with traditional East Asian aesthetics, muted watercolor palette. This is a DRAWN ILLUSTRATION in manhua comic style, NOT a photograph. No photorealism, no real human faces, no 3D rendering.',
    },
    manhwa: {
        label: 'Manhwa',
        promptEn: 'Korean manhwa illustration style, polished 2D digital line art, clean contour work, expressive character acting, luminous colors, and dramatic cinematic staging. This is a DIGITAL ILLUSTRATION, NOT a photograph. No photorealism, no real human faces.',
    },
    comic: {
        label: 'Comic',
        promptEn: 'American comic book illustration style, bold flat colors, heavy black ink outlines, dynamic action poses, strong shadows, halftone dot patterns. This is a DRAWN COMIC ILLUSTRATION, NOT a photograph. No photorealism.',
    },
    webtoon: {
        label: 'Webtoon',
        promptEn: 'Korean webtoon digital illustration style, soft gradient coloring, smooth 2D digital painting, beautiful diffused lighting, semi-realistic anime proportions. This is a DIGITAL ILLUSTRATION, NOT a photograph. No photorealism.',
    },
}

const LEGACY_ART_STYLE_PROMPTS: Record<string, string> = {
    realistic: 'Realistic cinematic look, real-world scene fidelity, rich colors, clean and refined image quality, dramatic cinematic lighting',
}

export function getArtStylePrompt(artStyle: string): string {
    const normalizedArtStyle = normalizeArtStyle(artStyle)

    if (normalizedArtStyle) {
        return ART_STYLE_PROMPTS[normalizedArtStyle].promptEn
    }

    return LEGACY_ART_STYLE_PROMPTS[artStyle] ?? ART_STYLE_PROMPTS.manga.promptEn
}

export const PROMPTS = {
  analyzeStory: `/no_think
You are a story analyst for comic/manga creation. Output ONLY valid JSON, no explanations.

Analyze the following story text and extract:
1. **Characters**: EVERY character who has a name in the text. Include ALL of them — protagonist, supporting, minor, even briefly mentioned characters.
2. **Locations**: Each distinct location/setting with visual description.

CRITICAL: The story text may be in Chinese, Vietnamese, Korean, or other languages. You MUST:
- Read the FULL text carefully from start to end
- Extract EVERY person with a name (e.g. 李清秋/Lý Thanh Thu, 张悟春/Trương Ngộ Xuân, etc.)
- A character counts if they have a proper name (not just "他/hắn/he")
- Count how many named characters you found. If you found fewer than 3 in a text longer than 500 characters, re-read the text — you likely missed some.
- For characters whose appearance is not explicitly described, infer reasonable defaults from context (age, role, setting era)

Output as JSON:
{
  "characters": [
    {
      "name": "string — use the ORIGINAL name as it appears in the text",
      "aliases": "string or null — include alternative name forms, titles, or nicknames (e.g. 'Đại sư huynh', 'Tam sư đệ')",
      "description": "concise visual description for image generation (50-80 words). Focus on unique visual traits NOT already in identityAnchor. Infer from context if not described (martial arts → robes, age → face/build).",
      "identityAnchor": {
        "ageRange": "e.g. '16-year-old teenager', 'mid-30s man', '10-year-old girl', '15-year-old boy'",
        "gender": "male | female | other",
        "bodyBuild": "e.g. 'slim teenager', 'tall lean adult', 'small child', 'sturdy young man'",
        "hairSignature": "hair color + length + style. If not described, use era-appropriate default (e.g. 'long black hair tied in a topknot' for wuxia)",
        "faceSignature": "key facial features. If not described, infer from age/personality (e.g. young + timid → 'round gentle face, soft features')",
        "outfitDefault": "default outfit. If not described, infer from setting (e.g. martial arts sect → 'white and blue sect robes')"
      }
    }
  ],
  "locations": [
    { "name": "string", "description": "detailed visual description of the place" }
  ]
}

RULES:
- You MUST extract ALL named characters. Missing a character is a CRITICAL FAILURE.
- identityAnchor fields are CRITICAL for character consistency across pages
- ageRange must clearly indicate the character's apparent age — look for age clues like "十六岁/mười sáu tuổi" or "十岁/mười tuổi"
- gender must match the story's description — look for pronouns like "他/hắn" (male) or "她" (female)
- For martial arts / wuxia / xianxia settings: default hair to long black, default outfit to traditional robes
- outfitDefault should describe their most common clothing
- List the protagonist/main character FIRST, then others in order of importance

Story text:
`,

  splitToPagesWithPanels: `/no_think
You are a manga storyboard artist. Output ONLY valid JSON array, no explanations.

Given a story text, split it into EXACTLY {page_count} sequential pages suitable for a comic. For each page, describe the visual panels that make up that page.

IMPORTANT:
- You MUST output exactly {page_count} pages. No more, no less.
- Each page should have 3-7 panels that together tell that page's part of the story.
- Each panel description should be detailed enough for image generation.
- Panel descriptions should describe the VISUAL scene: character poses, expressions, environment, lighting.

For each page, provide:
- summary: one-line summary of what happens on this page
- content: the original text content for this page
- characters: array of character names present on this page
- location: the location/setting name
- dialogue: array of dialogue lines (if any)
- sceneContext: {
    timeOfDay: "morning" | "afternoon" | "evening" | "night",
    weather: "clear" | "rainy" | "cloudy" | "snowy" | "foggy",
    dominantMood: overall emotional tone (e.g. "peaceful", "tense", "melancholic", "joyful"),
    colorTone: dominant color feeling (e.g. "warm golden", "cool blue", "muted grey", "vibrant"),
    pageRole: "setup" | "rising" | "climax" | "falling" | "resolution"
  }
- panels: array of panel descriptions for this page

For each panel, provide:
- description: detailed visual scene description for image generation. MUST NOT include any text, speech bubbles, or written words — visual scene ONLY.
- shotType: "close-up" | "medium" | "wide" | "extreme-wide" | "over-shoulder" | "bird-eye"
- sourceExcerpt: translate the EXACT 1-2 original story sentences this panel visualizes into English. This is the narrative anchor.
- mustKeep: array of 2-4 factual constraints that MUST remain true in the final image (e.g. "boy is 12 years old", "peaceful indoor scene", "no weapons present")
- mood: emotional tone like "peaceful", "tense", "joyful", "melancholic"
- lighting: light description like "warm afternoon sunlight", "dim candlelight", "harsh fluorescent"
- characters: array of character names visible
- location: location name
- dialogue: the dialogue or narration text for this panel (will be displayed as text BELOW the panel image, NOT inside the image). null if no dialogue.

Output as JSON array:
[
  {
    "summary": "string",
    "content": "string",
    "characters": ["string"],
    "location": "string",
    "dialogue": [{ "speaker": "string", "text": "string" }],
    "sceneContext": {
      "timeOfDay": "string",
      "weather": "string",
      "dominantMood": "string",
      "colorTone": "string",
      "pageRole": "string"
    },
    "panels": [
      {
        "description": "detailed visual scene description (NO text, NO speech bubbles)",
        "shotType": "close-up | medium | wide | extreme-wide | over-shoulder | bird-eye",
        "sourceExcerpt": "faithful English translation of matching story sentences",
        "mustKeep": ["constraint 1", "constraint 2"],
        "mood": "emotional tone",
        "lighting": "lighting description",
        "characters": ["character names visible"],
        "location": "location name",
        "dialogue": "text to display below this panel, or null"
      }
    ]
  }
]

CRITICAL RULES:
- sourceExcerpt must be a FAITHFUL English translation of the original text, NOT a creative reinterpretation
- mustKeep must include constraints that PREVENT common hallucinations (e.g. if scene is quiet, include "no combat, no weapons")
- description must be consistent with sourceExcerpt — if they conflict, rewrite description to match sourceExcerpt
- If a detail is ambiguous in the source text, omit it instead of inventing

Characters in this story: {characters}

Story text:
`,

  buildPageImagePrompt: `You are an expert Webtoon Panel Artist. Create a natural-language image prompt for a SINGLE webtoon panel image.

Art style: {style}

== GLOBAL SCENE CONTEXT ==
{scene_context}

== CHARACTER IDENTITY ANCHORS (maintain these appearances EXACTLY) ==
{character_canon}

== PANEL DATA ==
{enriched_panel_blocks}

== COMPOSITION TASK ==
Create ONE portrait-orientation (1024×1536) panel image:
1. Use sourceExcerpt as your PRIMARY reference for what happens
2. Use description for visual composition guidance
3. Respect mustKeep constraints — these are NON-NEGOTIABLE
4. Match mood and lighting from panel data

== CRITICAL LAWS (NON-NEGOTIABLE) ==
1. ABSOLUTE TRUTH: sourceExcerpt is the ultimate narrative truth. If description conflicts with sourceExcerpt, rewrite to match the excerpt.
2. ZERO HALLUCINATION: DO NOT add combat, weapons, magic, romance, or injuries UNLESS explicitly stated in sourceExcerpt. Keep static scenes static!
3. STRICT ANCHORS: Enforce every mustKeep rule. Never alter a character's age, gender, body build, hairstyle, or key outfit markers.
4. NO TEXT: Do NOT include any text, speech bubbles, words, sound effects, captions, letters, or any writing in the image. The image must contain ONLY visual elements.
5. If unsure about a detail, describe it neutrally rather than inventing.

Output ONLY the English descriptive prompt. Max 1500 characters.
Focus on composition, character expressions, and lighting.`,
}
