import { NextResponse } from "next/server";
import { createProvider } from "@/lib/ai";
import { buildRoutine } from "@/lib/ai/agent";
import type { QuizAnswer } from "@/lib/domain/types";
import {
  logger,
  flushLogs,
  userContext,
  readAnonId,
  errorData,
} from "@/lib/logger";
import { optionalUser } from "@/lib/firebase/optionalUser";

// firebase-admin isn't used here, but the Gemini call + grounding wants the
// Node runtime (longer timeouts, full fetch), not the edge runtime.
export const runtime = "nodejs";

// The two-step grounded pipeline takes ~12s (3.5-flash-lite) to ~13s (3.7-flash),
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
const ALLOWED_MODELS = ["gemini-3.5-flash-lite", "gemini-3.7-flash"];

/** Pull a couple of answers worth logging, without dumping the whole quiz. */
function answerSummary(answers: QuizAnswer[]) {
  const find = (id: string) => answers.find((a) => a.questionId === id)?.answer;
  return {
    answerCount: answers.length,
    commitment: find("commitment") ?? null,
    region: find("region") ?? null,
  };
}

/**
 * POST /api/routine
 * Body: { answers: QuizAnswer[], model?: string }
 * Returns: { output: AiRoutineOutput, grounding?: GroundingInfo, model: string }
 *
 * Open to signed-out users — the quiz does not require an account. Any
 * Authorization header is verified purely so the logs carry a real uid; it is
 * never required, and a bad token degrades to anonymous rather than failing.
 */
export async function POST(req: Request) {
  const startedAt = Date.now();
  const anonId = readAnonId(req);
  const who = await optionalUser(req);
  const user = userContext({ uid: who?.uid, email: who?.email, anonId });

  let body: { answers?: QuizAnswer[]; model?: string };
  try {
    body = await req.json();
  } catch {
    logger.warn("routine.badRequest", { ...user, reason: "invalid JSON body" });
    await flushLogs();
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { answers } = body;
  if (!Array.isArray(answers) || answers.length === 0) {
    logger.warn("routine.badRequest", { ...user, reason: "empty answers" });
    await flushLogs();
    return NextResponse.json(
      { error: "`answers` must be a non-empty array" },
      { status: 400 },
    );
  }

  const model =
    typeof body.model === "string" && ALLOWED_MODELS.includes(body.model)
      ? body.model
      : undefined;

  const summary = answerSummary(answers);
  logger.info("routine.start", { ...user, requestedModel: model ?? null, ...summary });

  try {
    const provider = createProvider(model);
    const { output, grounding } = await buildRoutine(provider, answers);

    logger.info("routine.success", {
      ...user,
      ...summary,
      model: `${provider.id}:${provider.model}`,
      durationMs: Date.now() - startedAt,
      ingredientCount: output.ingredients?.length ?? 0,
      amSteps: output.routine?.am?.length ?? 0,
      pmSteps: output.routine?.pm?.length ?? 0,
      groundingSources: grounding?.sources?.length ?? 0,
    });
    await flushLogs();

    return NextResponse.json({
      output,
      grounding,
      model: `${provider.id}:${provider.model}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // The client soft-falls back to the local routine, so the user sees no
    // error — which is exactly why this needs to be loud in the logs.
    logger.error("routine.failed", {
      ...user,
      ...summary,
      requestedModel: model ?? null,
      durationMs: Date.now() - startedAt,
      ...errorData(err),
    });
    await flushLogs();
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
