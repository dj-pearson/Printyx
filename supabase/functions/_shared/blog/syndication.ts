// Per-platform syndication specs (US-BLOG-043..051)
//
// One registry entry per syndication target. Each spec carries the system prompt
// that turns a blog post into a platform-native variant, the variant_type stored
// on blog_distributions, and whether the model should emit structured JSON (for
// threads/carousels/pins where the UI renders multiple cards) or plain text.
//
// Kept declarative so adding a platform is a data change, not new control flow.

export interface SyndicationSpec {
  platform: string;
  variantType: string;
  /** When true, the prompt asks for a JSON array; result lands in content_json. */
  structured: boolean;
  /** Short human label for the UI. */
  label: string;
  system: string;
}

const BASE_RULES =
  'You repurpose a blog post into platform-native content. Preserve the facts, ' +
  'numbers, and key takeaways. Do not invent statistics. Match the platform tone. ';

export const SYNDICATION_SPECS: Record<string, SyndicationSpec> = {
  // US-BLOG-043
  newsletter: {
    platform: 'newsletter',
    variantType: 'email',
    structured: true,
    label: 'Email newsletter',
    system:
      BASE_RULES +
      'Produce an email newsletter. Respond ONLY with JSON ' +
      '{ "subject": "<=70 chars", "preheader": "<=110 chars", "body_markdown": "<email body>", "cta": "<call to action>" }.',
  },
  // US-BLOG-044
  x: {
    platform: 'x',
    variantType: 'thread',
    structured: true,
    label: 'X / Twitter thread',
    system:
      BASE_RULES +
      'Produce an X (Twitter) thread of 5-8 tweets. Hook first, payoff last, one ' +
      'idea per tweet, each <=270 chars, no hashtags except the final tweet. ' +
      'Respond ONLY with a JSON array of tweet strings.',
  },
  // US-BLOG-045
  linkedin: {
    platform: 'linkedin',
    variantType: 'long_form',
    structured: false,
    label: 'LinkedIn post',
    system:
      BASE_RULES +
      'Produce a LinkedIn long-form post: a strong first line (the "hook" shown ' +
      'before "see more"), short paragraphs with line breaks, a personal/professional ' +
      'framing, and 3-5 relevant hashtags at the end. Return plain text only.',
  },
  // US-BLOG-046 (Facebook)
  facebook: {
    platform: 'facebook',
    variantType: 'post',
    structured: false,
    label: 'Facebook post',
    system:
      BASE_RULES +
      'Produce a conversational Facebook post (2-4 short paragraphs) ending with a ' +
      'question to drive comments, plus a link placeholder {{post_url}}. Return plain text.',
  },
  // US-BLOG-046 (Instagram — carousel)
  instagram_carousel: {
    platform: 'instagram',
    variantType: 'carousel',
    structured: true,
    label: 'Instagram carousel',
    system:
      BASE_RULES +
      'Produce an Instagram carousel of 6-8 slides. Slide 1 is the hook, last slide ' +
      'is the CTA. Respond ONLY with a JSON array of ' +
      '{ "slide": <n>, "headline": "<short>", "body": "<=180 chars" }. Also keep it skimmable.',
  },
  // US-BLOG-046 (Instagram — Reel script)
  instagram_reel: {
    platform: 'instagram',
    variantType: 'reel',
    structured: true,
    label: 'Instagram Reel script',
    system:
      BASE_RULES +
      'Produce a 30-45s Reel script. Respond ONLY with JSON ' +
      '{ "hook": "<first 3s>", "beats": ["<spoken line>", ...], "on_screen_text": ["..."], "cta": "<end card>" }.',
  },
  // US-BLOG-047
  tiktok: {
    platform: 'tiktok',
    variantType: 'reel',
    structured: true,
    label: 'TikTok / Shorts script',
    system:
      BASE_RULES +
      'Produce a 30-60s TikTok / YouTube Shorts script optimized for retention: a ' +
      'pattern-interrupt hook in the first 2 seconds, 3-5 fast beats, an open loop. ' +
      'Respond ONLY with JSON { "hook": "...", "beats": ["..."], "on_screen_text": ["..."], "cta": "..." }.',
  },
  // US-BLOG-048
  pinterest: {
    platform: 'pinterest',
    variantType: 'pin',
    structured: true,
    label: 'Pinterest pins',
    system:
      BASE_RULES +
      'Produce 4 Pinterest pin variations targeting different search intents. ' +
      'Respond ONLY with a JSON array of ' +
      '{ "title": "<=100 chars", "description": "<=500 chars, keyword-rich", "image_concept": "<visual idea>" }.',
  },
  // US-BLOG-049
  reddit: {
    platform: 'reddit',
    variantType: 'post',
    structured: true,
    label: 'Reddit post (rule-aware)',
    system:
      BASE_RULES +
      'Produce a Reddit post for a relevant subreddit. CRITICAL: Reddit hates ' +
      'marketing. No salesy language, no emojis, no hashtags. Lead with genuine ' +
      'value or a real question; disclose any affiliation plainly. Respond ONLY with ' +
      'JSON { "suggested_subreddits": ["..."], "title": "<title>", "body_markdown": "<post>", "self_promo_disclosure": "<one line>" }.',
  },
  // US-BLOG-050 (Hacker News)
  hackernews: {
    platform: 'hackernews',
    variantType: 'post',
    structured: true,
    label: 'Hacker News submission',
    system:
      BASE_RULES +
      'Produce a Hacker News submission: a factual, non-clickbait title (no ' +
      '"You won\'t believe", no emojis) and an optional first comment giving ' +
      'context. Respond ONLY with JSON { "title": "<=80 chars", "first_comment": "<context>" }.',
  },
  // US-BLOG-050 (Medium)
  medium: {
    platform: 'medium',
    variantType: 'long_form',
    structured: false,
    label: 'Medium article',
    system:
      BASE_RULES +
      'Adapt the post into a Medium article: a compelling subtitle, narrative intro, ' +
      'section subheads, and a canonical-source note at the bottom. Return markdown.',
  },
  // US-BLOG-050 (Substack)
  substack: {
    platform: 'substack',
    variantType: 'long_form',
    structured: false,
    label: 'Substack issue',
    system:
      BASE_RULES +
      'Adapt the post into a Substack issue with a personal editorial voice, a ' +
      'clear subject-style title line, and a subscriber CTA at the end. Return markdown.',
  },
  // US-BLOG-051
  slack: {
    platform: 'slack',
    variantType: 'snippet',
    structured: false,
    label: 'Slack / Discord snippet',
    system:
      BASE_RULES +
      'Produce a short community snippet (3-5 sentences) suitable for a Slack or ' +
      'Discord channel: friendly, no hard sell, with a single link placeholder ' +
      '{{post_url}}. Return plain text.',
  },
};

export const SYNDICATION_PLATFORMS = Object.keys(SYNDICATION_SPECS);

export function getSyndicationSpec(key: string): SyndicationSpec | null {
  return SYNDICATION_SPECS[key] ?? null;
}
