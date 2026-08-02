import { NextResponse } from "next/server";
import { createProvider } from "@/lib/ai";
import { buildRoutine } from "@/lib/ai/agent";
import type { QuizAnswer } from "@/lib/domain/types";

// firebase-admin isn't used here, but the Gemini call + grounding wants the
// Node runtime (longer timeouts, full fetch), not the edge runtime.
export const runtime = "nodejs";

// The two-step grounded pipeline takes ~11s (3.5-flash-lite) to ~18s (3.6-flash),
// so this route needs a much longer budget than a normal request. Pinned
// explicitly rather than relying on the host's default, which has changed
// before; 60s leaves headroom without letting a wedged call hang for minutes.
// If this is ever too low the symptom is silent: the fetch fails and the quiz
// falls back to the local routine logic.
export const maxDuration = 60;

/**
 * Models the UI is allowed to request. Anything else falls back to the env /
 * provider default — the client can't make us call an arbitrary model.
 */
const ALLOWED_MODELS = ["gemini-3.5-flash-lite", "gemini-3.6-flash"];

/**
 * POST /api/routine
 * Body: { answers: QuizAnswer[], model?: string }
 * Returns: { output: AiRoutineOutput, grounding?: GroundingInfo, model: string }
 */
export async function POST(req: Request) {
  let body: { answers?: QuizAnswer[]; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { answers } = body;
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json(
      { error: "`answers` must be a non-empty array" },
      { status: 400 },
    );
  }

  const model =
    typeof body.model === "string" && ALLOWED_MODELS.includes(body.model)
      ? body.model
      : undefined;

  try {
    const provider = createProvider(model);
    const { output, grounding } = await buildRoutine(provider, answers);
    return NextResponse.json({
      output,
      grounding,
      model: `${provider.id}:${provider.model}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
