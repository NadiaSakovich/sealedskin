import { NextResponse } from "next/server";
import { createProvider } from "@/lib/ai";
import { buildRoutine } from "@/lib/ai/agent";
import type { QuizAnswer } from "@/lib/domain/types";

// firebase-admin isn't used here, but the Gemini call + grounding wants the
// Node runtime (longer timeouts, full fetch), not the edge runtime.
export const runtime = "nodejs";

/**
 * Models the UI is allowed to request. Anything else falls back to the env /
 * provider default — the client can't make us call an arbitrary model.
 */
const ALLOWED_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash"];

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
