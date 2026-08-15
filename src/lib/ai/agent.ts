import type { ChatMessage, GroundingInfo, LLMProvider } from "./types";
import type { AiRoutineOutput, QuizAnswer } from "@/lib/domain/types";
import { MAX_PRODUCT_PRICE } from "@/data/products";

/**
 * Lowest thinking budget the current Gemini models accept. They reject a budget
 * of 0 (400 INVALID_ARGUMENT) — thinking can't be disabled outright — so this is
 * the "as good as off" setting for mechanical calls.
 */
const MIN_THINKING_BUDGET = 1;

/** OpenAPI-subset schema mirroring {@link AiIngredient}. */
const INGREDIENT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    aka: { type: "string" },
    type: { type: "string" },
    what: { type: "string" },
    why: { type: "string" },
    gentle: { type: "boolean" },
    reasons: { type: "array", items: { type: "string" } },
  },
  required: ["name", "aka", "type", "what", "why", "gentle", "reasons"],
} as const;

/** OpenAPI-subset schema mirroring {@link AiRoutineStep}. */
const STEP_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string" },
    active: { type: "string", nullable: true },
    note: { type: "string" },
    spf: { type: "boolean" },
  },
  required: ["type", "active", "note"],
} as const;

/** OpenAPI-subset schema mirroring {@link AiShopProduct}. */
const PRODUCT_SCHEMA = {
  type: "object",
  properties: {
    stepType: { type: "string" },
    tier: { type: "string", enum: ["Budget", "Mid", "Premium"] },
    brand: { type: "string" },
    name: { type: "string" },
    price: { type: "string" },
    url: { type: "string" },
  },
  required: ["stepType", "tier", "brand", "name", "price"],
} as const;

/** OpenAPI-subset schema mirroring {@link AiRoutineOutput}. */
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    ingredients: { type: "array", items: INGREDIENT_SCHEMA },
    routine: {
      type: "object",
      properties: {
        am: { type: "array", items: STEP_SCHEMA },
        pm: { type: "array", items: STEP_SCHEMA },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["am", "pm", "notes"],
    },
    products: { type: "array", items: PRODUCT_SCHEMA },
  },
  required: ["ingredients", "routine", "products"],
} as const;

// Shared safety rules, applied in both steps so the grounded research is safe
// and the structuring step preserves that safety.
const SAFETY_RULES = `Safety rules:
- The user's skin type and sensitivity are already determined — respect them.
- ALWAYS include sunscreen in the morning and a hydrator somewhere.
- If the user is pregnant, planning, or breastfeeding, EXCLUDE retinoids and \
other actives best avoided then, and note it.
- Introduce actives (retinoids, exfoliating acids, vitamin C) cautiously; note \
frequency and conflicts (don't combine a retinoid and an acid the same night).
- Brands are EXAMPLES of the right kind of product, never endorsements. Include a \
brief note that this is general guidance, not medical advice.`;

/**
 * The price ceiling on suggested products. Our users are building a first
 * routine, so a $180 serum is noise, not an option - and a pick we won't show is
 * a wasted pick, since `ShopView` drops anything over the cap at render. Hence
 * telling the model up front, so all three picks per step are usable.
 */
const PRICE_RULES = `Price limit:
- NEVER suggest a product that costs more than $${MAX_PRODUCT_PRICE} (USD, or the local \
equivalent). This is a hard limit - a pricier product is not an option for this \
audience, however good it is.
- "Premium" here means the top of a beginner's budget (roughly \
$35-$${MAX_PRODUCT_PRICE}), NOT luxury skincare.
- Prefer well-reviewed, widely sold products people can actually re-buy.`;

/**
 * House style for the copy the model writes. Only the dash rule really matters:
 * an em dash is the tell readers pick up on as "an AI wrote this", and all of
 * our own hardcoded copy uses plain hyphens, so the model's should match.
 * `stripLongDashes()` in `lib/ai/result.ts` enforces it deterministically -
 * prompt for the habit, enforce for the guarantee.
 */
const STYLE_RULES = `Writing style:
- Write plainly, the way a knowledgeable person would talk, not like marketing copy.
- Use ONLY the plain hyphen "-" for punctuation. NEVER use an em dash or an en \
dash. Prefer a comma, a full stop or brackets where you would reach for one.
- Write number ranges with a hyphen (SPF 30-50, 2-3 nights a week).`;

/**
 * How to read the "Region preference" answer. The user is choosing where the
 * BRAND comes from — the quiz options say so ("North American brands",
 * "European pharmacy & heritage brands") — but the label alone is easy to read
 * as a market instead, and since essentially every major brand is sold in every
 * major market, that reading makes the preference a no-op. It's how La
 * Roche-Posay (French) and COSRX (Korean) ended up in "US & Canada" routines.
 * So the test is stated explicitly, with counter-examples, and the "unless no
 * option exists" escape hatch is replaced by "say so" — the shop UI already
 * renders a step with no picks rather than hiding it.
 */
const REGION_RULES = `Regional preference — apply this literally:
The user's region preference is about where the BRAND ITSELF originates — the \
country the brand was founded in and is identified with. It is NOT about where a \
product can be bought. Almost every well-known brand is sold worldwide, so \
availability is never the test.
- "Korean & Asian" means brands founded in Korea, Japan, China or Taiwan (COSRX, \
Beauty of Joseon, Hada Labo, Anua, Round Lab).
- "US & Canada" means brands founded in the United States or Canada (CeraVe, \
Cetaphil, Vanicream, Neutrogena, Paula's Choice, The Ordinary, e.l.f.). European \
houses — La Roche-Posay, Vichy, Bioderma, Avene, Eucerin, Garnier — do NOT count, \
even though they are sold everywhere in North America. Korean brands such as \
COSRX, Heimish or Beauty of Joseon do NOT count either.
- "European" means brands founded in Europe (La Roche-Posay, Bioderma, Avene, \
Vichy, Eucerin, The INKEY List, Medik8). North American brands — CeraVe, \
Cetaphil, The Ordinary (Canadian), Paula's Choice — do NOT count.
- "No preference" means any origin; give a deliberate spread across regions.
Every single product you list must pass this test. Check each brand's country of \
origin before listing it. If you genuinely cannot find a suitable in-region brand \
for a step, list fewer products for that step and say why — do NOT quietly \
substitute an out-of-region brand.`;

// STEP 1 — grounded research. We deliberately ask for PROSE (not JSON): Gemini's
// Google Search grounding reliably corrupts JSON-shaped output, but free-form
// prose is unaffected, and this is where the live web data (current products,
// prices, latest guidance) is gathered.
const RESEARCH_SYSTEM = `You are an expert skincare consultant with Google Search.
Search the web to ground your answer in CURRENT, real information: actual \
available products (with approximate prices) for the user's region, and recent \
dermatology guidance on the relevant ingredients. Search whenever it improves \
accuracy or recency.

Write a thorough brief in PLAIN PROSE (do NOT use JSON or code blocks). Cover:
1. Hero ingredients/actives to look for and why they suit THIS user.
2. An ordered AM and PM routine (cleanser -> treatments -> moisturizer -> SPF in \
the morning), sized to the user's commitment level (minimal = essentials only; \
balanced = one targeted serum; thorough = layered), with a short note per step. \
If a double cleanse suits the PM routine, write it as TWO separate steps — an \
oil/balm cleanser, then a water-based cleanser — never a single "double cleanse" \
step, so each can have its own products.
3. For each routine step, give EXACTLY THREE current example products — ideally \
one Budget, one Mid, and one Premium; if you can't find three distinct price \
tiers, still give three options (repeating a tier is fine). Each needs a brand, \
product name, an approximate price, and a tier (Budget/Mid/Premium).

${PRICE_RULES}

${REGION_RULES}

${SAFETY_RULES}

${STYLE_RULES}`;

// STEP 2 — structure the brief into the exact schema. No grounding here, so the
// structured-output decoder produces clean, valid JSON.
const STRUCTURE_SYSTEM = `You convert a skincare brief into structured data.
Use ONLY the information in the brief; do not invent new products. Include EVERY \
product mentioned in the brief (the brief aims for three per routine step), with \
ONE exception: DROP any product priced above $${MAX_PRODUCT_PRICE}, which is over \
our limit and will not be shown. For \
each shop product, set "stepType" to EXACTLY match the "type" of the routine step \
it belongs to, so it can be grouped under that step. If the brief describes a \
double cleanse, emit it as two separate routine steps (an oil/balm cleanser then \
a water-based cleanser), never a single "double cleanse" step. Preserve the \
brief's safety guidance in the routine notes. Output ONLY data matching the \
provided schema.

${SAFETY_RULES}

${STYLE_RULES}`;

/**
 * Extra rules appended to BOTH system prompts when the user picked the "minimal"
 * commitment level. A minimal routine is capped at 3 steps per half of the day,
 * and the morning ends on a single moisturising sunscreen — splitting moisturiser
 * and SPF into two steps is redundant when the whole point is fewer steps, but SPF
 * itself is non-negotiable. Enforced deterministically in `lib/ai/result.ts` too,
 * since the model doesn't always comply.
 */
const MINIMAL_RULES = `

Minimal routine — the user asked to keep it minimal. These rules OVERRIDE the \
general guidance above:
- The morning routine must have AT MOST 3 steps, and the evening routine AT MOST \
3 steps. Fewer is fine; do not pad them to reach 3.
- The LAST morning step must ALWAYS be a MOISTURISING SUNSCREEN: one product that \
moisturises AND gives broad-spectrum SPF 30-50. Do NOT emit a separate moisturiser \
step and a separate sunscreen step in the morning — for this user they are a single \
step. Name that step exactly "Moisturising sunscreen".
- Every product suggested for that step must genuinely be a hydrating/moisturising \
SPF (an SPF fluid, lotion or moisturiser with SPF), not a bare sunscreen.
- Keep the evening to a SINGLE cleanse — no double cleanse — so it fits in 3 steps.`;

/** Did the user pick the "minimal" commitment level? (See COMMITMENT_LEVELS.) */
function wantsMinimal(answers: QuizAnswer[]): boolean {
  const a = answers.find((x) => x.questionId === "commitment");
  const value = Array.isArray(a?.answer) ? a.answer.join(" ") : a?.answer ?? "";
  return /minimal/i.test(value);
}

function formatAnswers(answers: QuizAnswer[]): string {
  return answers
    .map((a) => {
      const value = Array.isArray(a.answer) ? a.answer.join(", ") : a.answer;
      return `- ${a.question}: ${value}`;
    })
    .join("\n");
}

/** Escape stray control characters that appear inside JSON string literals. */
function sanitizeJson(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (escaped) {
      out += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      out += ch;
      continue;
    }
    if (inString && code < 0x20) {
      out += ch === "\n" ? "\\n" : ch === "\t" ? "\\t" : ch === "\r" ? "\\r" : "";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Parse the model's JSON, tolerating code fences and stray control characters. */
function parseRoutineJson(raw: string): AiRoutineOutput {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let text = fence ? fence[1] : raw;
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) text = obj[0];
  try {
    return JSON.parse(text) as AiRoutineOutput;
  } catch {
    return JSON.parse(sanitizeJson(text)) as AiRoutineOutput;
  }
}

export interface BuildRoutineResult {
  output: AiRoutineOutput;
  grounding?: GroundingInfo;
}

/**
 * Run the skincare agent in two steps so we get BOTH live grounding and clean
 * structured output (Gemini can't reliably do both in one call):
 *   1. grounded prose research (current products, latest guidance) + sources,
 *   2. structure that brief into the routine schema (no grounding).
 * Works with any {@link LLMProvider}; the model is swappable via config.
 */
export async function buildRoutine(
  provider: LLMProvider,
  answers: QuizAnswer[],
): Promise<BuildRoutineResult> {
  const profile = formatAnswers(answers);
  // Appended to both steps so the research gathers the right products AND the
  // structuring step keeps the shape.
  const minimalRules = wantsMinimal(answers) ? MINIMAL_RULES : "";

  const research: ChatMessage[] = [
    { role: "system", content: RESEARCH_SYSTEM + minimalRules },
    {
      role: "user",
      content: `Here is the user's profile and quiz answers:\n\n${profile}\n\nResearch and write their personalized skincare brief.`,
    },
  ];
  const brief = await provider.generate(research, {
    temperature: 0.6,
    grounding: true,
    // Cap reasoning on the research step: a small budget still triggers web
    // searches and produces a full brief, but ~30% faster than uncapped thinking.
    thinkingBudget: 512,
  });

  const structure: ChatMessage[] = [
    { role: "system", content: STRUCTURE_SYSTEM + minimalRules },
    {
      role: "user",
      content: `User profile (for reference):\n${profile}\n\nSkincare brief to structure:\n\n${brief.text}\n\nReturn JSON matching the schema.`,
    },
  ];
  const structured = await provider.generate(structure, {
    temperature: 0.2,
    responseSchema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
    // Structuring is mechanical — no deep reasoning needed, so keep thinking as
    // low as the model allows. NOT 0: gemini-3.5-flash-lite and gemini-3.6-flash
    // reject `thinkingBudget: 0` with a 400 (thinking can't be switched off on
    // them); 1 is the minimum they accept and is effectively the same thing.
    thinkingBudget: MIN_THINKING_BUDGET,
  });

  try {
    return { output: parseRoutineJson(structured.text), grounding: brief.grounding };
  } catch {
    throw new Error(
      `Could not parse routine JSON from model output: ${structured.text.slice(0, 500)}`,
    );
  }
}
