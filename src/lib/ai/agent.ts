import type { ChatMessage, GroundingInfo, LLMProvider } from "./types";
import type { AiRoutineOutput, QuizAnswer } from "@/lib/domain/types";

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
balanced = one targeted serum; thorough = layered), with a short note per step.
3. For each routine step, 1-3 current example products available in the user's \
region, each with brand, product name, an approximate price, and a rough tier \
(Budget/Mid/Premium).

${SAFETY_RULES}`;

// STEP 2 — structure the brief into the exact schema. No grounding here, so the
// structured-output decoder produces clean, valid JSON.
const STRUCTURE_SYSTEM = `You convert a skincare brief into structured data.
Use ONLY the information in the brief; do not invent new products. For each shop \
product, set "stepType" to EXACTLY match the "type" of the routine step it belongs \
to, so it can be grouped under that step. Preserve the brief's safety guidance in \
the routine notes. Output ONLY data matching the provided schema.

${SAFETY_RULES}`;

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

  const research: ChatMessage[] = [
    { role: "system", content: RESEARCH_SYSTEM },
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
    { role: "system", content: STRUCTURE_SYSTEM },
    {
      role: "user",
      content: `User profile (for reference):\n${profile}\n\nSkincare brief to structure:\n\n${brief.text}\n\nReturn JSON matching the schema.`,
    },
  ];
  const structured = await provider.generate(structure, {
    temperature: 0.2,
    responseSchema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
    // Structuring is mechanical — no deep reasoning needed; skip thinking so the
    // second call is fast.
    thinkingBudget: 0,
  });

  try {
    return { output: parseRoutineJson(structured.text), grounding: brief.grounding };
  } catch {
    throw new Error(
      `Could not parse routine JSON from model output: ${structured.text.slice(0, 500)}`,
    );
  }
}
