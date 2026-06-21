"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SKIN_TYPE_QUESTIONS } from "../data/questions";
import { SKIN_CONCERNS } from "../data/concerns";
import { SKIN_GOALS, COMMITMENT_LEVELS, REGIONS } from "../data/goals";
import { needsSummary, AGE_LABELS } from "../data/actives";
import { analyzeSkin } from "../lib/analysis";
import type { AnswerStyle, Profile, RegionId } from "../types";

import { Shell } from "./layout/Shell";
import { Button } from "./ui/Button";
import { Arrow } from "./ui/Arrow";
import { PhotoSlot } from "./ui/PhotoSlot";
import { AnswerCard } from "./quiz/AnswerCard";
import { ConcernGrid, PriorityList } from "./quiz/ConcernGrid";
import { CommitmentPicker } from "./quiz/GoalGrid";
import { AnalysisView } from "./quiz/AnalysisView";
import { FinaleScreen } from "./quiz/FinaleScreen";
import { NeedsSummary } from "./results/NeedsSummary";
import { IngredientsView } from "./results/IngredientsView";
import { RoutineView } from "./results/RoutineView";
import { ShopView } from "./results/ShopView";
import { SaveRoutine } from "./results/SaveRoutine";
import { ModelPicker, DEFAULT_AI_MODEL } from "./results/ModelPicker";
import { GroundingSources } from "./results/GroundingSources";
import {
  buildAiResult,
  buildLocalResult,
  type RoutineResult,
} from "../lib/ai/result";
import type { SaveQuizRequest, QuizAnswer, AiRoutineOutput } from "../lib/domain/types";
import type { GroundingInfo } from "../lib/ai/types";

// Locked configuration (Tweaks removed).
const CONFIG: { answerStyle: AnswerStyle; autoAdvance: boolean } = { answerStyle: "cards", autoAdvance: false };

/** Reveal-from-hidden wrapper so a throttled timeline never leaves content invisible. */
function Screen({ screenKey, dir, children }: { screenKey: string; dir: "fwd" | "back"; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
    setShown(false);
    const id = window.setTimeout(() => setShown(true), 30);
    return () => clearTimeout(id);
  }, [screenKey]);
  return (
    <div
      className="transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]"
      style={{ opacity: shown ? 1 : 0, transform: shown ? "translateX(0)" : `translateX(${dir === "back" ? "-16px" : "16px"})` }}
    >
      {children}
    </div>
  );
}

const eyebrowClass = "font-mono text-[11.5px] tracking-[0.13em] uppercase text-ss-accent-ink mb-3";
const introH1Class = "font-head font-semibold text-[29px] leading-[1.13] tracking-[-0.025em] text-ss-ink mx-auto mb-[14px] max-w-[430px] [text-wrap:balance]";
const introPClass = "text-[16px] leading-[1.55] text-ss-ink-soft max-w-[410px] mx-auto mb-[30px] [text-wrap:pretty]";
const qH2Class = "font-head font-semibold text-[25px] leading-[1.18] tracking-[-0.02em] text-ss-ink m-0 mb-2 [text-wrap:balance]";
const qHelpClass = "text-[14.5px] leading-[1.5] text-ss-ink-soft m-0 [text-wrap:pretty]";

function CountPill({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`shrink-0 font-mono text-[12px] px-3 py-[6px] rounded-full whitespace-nowrap border ${
        active ? "bg-ss-accent-tint text-ss-accent-ink border-transparent" : "bg-transparent text-ss-ink-faint border-ss-hairline"
      }`}
    >
      {children}
    </span>
  );
}

export default function SkinQuiz() {
  const QS = SKIN_TYPE_QUESTIONS;
  // Stage 1 asks the diagnostic skin questions; the pregnancy question moves to
  // Stage 3 (Preferences), since it's personal context, not skin behaviour.
  const SKIN_QS = QS.filter((q) => q.id !== "pregnancy");
  const PREG_Q = QS.find((q) => q.id === "pregnancy")!;
  const CONCERNS = SKIN_CONCERNS;
  const GOALS = SKIN_GOALS;
  const LEVELS = COMMITMENT_LEVELS;
  const N = SKIN_QS.length;

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [concerns, setConcerns] = useState<string[]>([]);
  const [topConcerns, setTopConcerns] = useState<string[]>([]);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [region, setRegion] = useState<RegionId | null>(null);
  const advanceRef = useRef<number | undefined>(undefined);

  // AI routine build (Gemini + grounding). Computed once on "Build my routine"
  // (and on model switch); the results screens read the stored result.
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_AI_MODEL);
  const [aiResult, setAiResult] = useState<RoutineResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Step map: 0 intro · 1..N skin Qs · S2 (intro,pick,priority,analysis) · S3 (commit,region,pregnancy) · finale · results
  const S2_INTRO = N + 1;
  const S2_PICK = N + 2;
  const S2_PRIORITY = N + 3;
  const S2_DONE = N + 4;
  const S3_COMMIT = N + 5;
  const S3_REGION = N + 6;
  const S3_PREG = N + 7;
  const FINISH = N + 8;
  const R_NEEDS = N + 9;
  const R_INGREDIENTS = N + 10;
  const R_ROUTINE = N + 11;
  const R_SHOP = N + 12;

  const hasPriority = concerns.length >= 2;

  useEffect(() => () => clearTimeout(advanceRef.current), []);

  function go(next: number, direction: "fwd" | "back" = "fwd") {
    clearTimeout(advanceRef.current);
    setDir(direction);
    setStep(next);
  }
  function select(qid: string, optId: string) {
    setAnswers((a) => ({ ...a, [qid]: optId }));
    if (CONFIG.autoAdvance) {
      clearTimeout(advanceRef.current);
      advanceRef.current = window.setTimeout(() => {
        setDir("fwd");
        setStep((s) => Math.min(s + 1, S2_INTRO));
      }, 360);
    }
  }
  function toggleConcern(id: string) {
    setConcerns((cur) => {
      if (cur.includes(id)) {
        setTopConcerns((tc) => tc.filter((x) => x !== id));
        return cur.filter((c) => c !== id);
      }
      return [...cur, id];
    });
  }
  function toggleTopConcern(id: string) {
    setTopConcerns((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id]));
  }

  // Progress segments + fill.
  let stageIndex = 0, fraction = 0;
  if (step === 0) { stageIndex = 0; fraction = 0; }
  else if (step <= N) { stageIndex = 0; fraction = (step - 1) / N + (answers[SKIN_QS[step - 1]?.id] ? 1 / N : 0); }
  else if (step === S2_INTRO) { stageIndex = 1; fraction = 0.05; }
  else if (step === S2_PICK) { stageIndex = 1; fraction = concerns.length ? 0.55 : 0.25; }
  else if (step === S2_PRIORITY) { stageIndex = 1; fraction = topConcerns.length ? 0.92 : 0.72; }
  else if (step === S2_DONE) { stageIndex = 2; fraction = 0.06; }
  else if (step === S3_COMMIT) { stageIndex = 2; fraction = commitment ? 0.42 : 0.22; }
  else if (step === S3_REGION) { stageIndex = 2; fraction = region ? 0.64 : 0.5; }
  else if (step === S3_PREG) { stageIndex = 2; fraction = answers["pregnancy"] ? 0.92 : 0.76; }
  else { stageIndex = 2; fraction = 1; }

  // Header right label.
  let headerRight: string;
  if (step === 0) headerRight = "Skin type";
  else if (step <= N) headerRight = `${step} / ${N}`;
  else if (step <= S2_PRIORITY) headerRight = "Concerns";
  else if (step === S2_DONE) headerRight = "Analysis";
  else if (step <= S3_PREG) headerRight = "Preferences";
  else if (step === FINISH) headerRight = "Profile";
  else headerRight = "Your routine";

  function buildProfile(): { analysis: ReturnType<typeof analyzeSkin>; profile: Profile } {
    const analysis = analyzeSkin(answers, QS, concerns, topConcerns, CONCERNS);
    const ageQ = QS.find((q) => q.id === "age");
    const ageOpt = ageQ && ageQ.options.find((o) => o.id === answers["age"]);
    const pregQ = QS.find((q) => q.id === "pregnancy");
    const pregOpt = pregQ && pregQ.options.find((o) => o.id === answers["pregnancy"]);
    const topList = (topConcerns.length ? topConcerns : concerns.slice(0, 1))
      .map((id) => CONCERNS.find((c) => c.id === id))
      .filter(Boolean) as typeof CONCERNS;
    const level = LEVELS.find((l) => l.id === commitment);
    const profile: Profile = {
      type: analysis.type,
      typeLabel: analysis.typeLabel,
      sensitivity: analysis.sensitivity,
      age: ageOpt?.age ?? null,
      pregnancy: pregOpt?.preg ?? null,
      concernIds: concerns,
      topConcerns,
      topConcernLabels: topList.map((c) => c.label),
      topConcernLabel: topList[0] ? topList[0].label : null,
      concernCount: concerns.length,
      goalIds: [],
      commitment,
      commitmentLabel: level ? level.label : null,
      region: region || "none",
      regionLabel: (REGIONS.find((r) => r.id === region) || ({} as { label?: string })).label || null,
    };
    return { analysis, profile };
  }

  // Flatten the quiz state into labeled Q/A pairs for the agent prompt.
  function toQuizAnswers(): QuizAnswer[] {
    const out: QuizAnswer[] = [];
    QS.forEach((q) => {
      const optId = answers[q.id];
      if (!optId) return;
      const opt = q.options.find((o) => o.id === optId);
      out.push({ questionId: q.id, question: q.topic, answer: opt?.label ?? optId });
    });
    const concernLabels = concerns.map((id) => CONCERNS.find((c) => c.id === id)?.label ?? id);
    if (concernLabels.length) out.push({ questionId: "concerns", question: "Skin concerns", answer: concernLabels });
    const topLabels = topConcerns.map((id) => CONCERNS.find((c) => c.id === id)?.label ?? id);
    if (topLabels.length) out.push({ questionId: "topConcerns", question: "Top priority concerns", answer: topLabels });
    const lvl = LEVELS.find((l) => l.id === commitment);
    if (lvl) out.push({ questionId: "commitment", question: "Routine commitment", answer: lvl.label });
    const reg = REGIONS.find((r) => r.id === region);
    if (reg) out.push({ questionId: "region", question: "Region preference", answer: reg.label });
    return out;
  }

  // Build the routine via the AI agent; fall back to local logic on any failure.
  async function startBuild(targetModel: string) {
    setBuilding(true);
    setAiError(null);
    const { analysis, profile } = buildProfile();
    try {
      const res = await fetch("/api/routine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: toQuizAnswers(), model: targetModel }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Build failed (${res.status})`);
      }
      const data = (await res.json()) as {
        output: AiRoutineOutput;
        grounding?: GroundingInfo;
        model: string;
      };
      setAiResult(buildAiResult(data.output, profile, analysis, data.grounding));
    } catch (err) {
      // Soft-fail: show a locally built routine so the user is never stuck.
      setAiResult(buildLocalResult(profile, analysis, CONCERNS, GOALS));
      setAiError(err instanceof Error ? err.message : "AI unavailable — showing a standard routine.");
    } finally {
      setBuilding(false);
    }
  }

  // The result the four results screens render. Prefers the stored AI result;
  // builds locally if the user somehow reaches results without a build.
  function getResult(): RoutineResult {
    if (aiResult) return aiResult;
    const { analysis, profile } = buildProfile();
    return buildLocalResult(profile, analysis, CONCERNS, GOALS);
  }

  // Small control bar shown atop every results screen: the model switch + a
  // note on whether this routine is AI- or locally-built.
  const resultsTopBar = (source: "ai" | "local") => (
    <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
      <ModelPicker
        value={selectedModel}
        onChange={(m) => { setSelectedModel(m); startBuild(m); }}
        busy={building}
      />
      <span className="font-mono text-[11px] text-ss-ink-faint">
        {source === "ai" ? "Personalised by AI" : aiError ? "Standard routine · AI unavailable" : "Standard routine"}
      </span>
    </div>
  );

  const shellProps = { stageIndex, fraction, headerRight };

  // ---- Intro ----
  if (step === 0) {
    return (
      <Shell {...shellProps}>
        <Screen screenKey="intro" dir={dir}>
          <div className="text-center pt-2 pb-1">
            <div className="flex justify-center mb-[26px]"><div className="w-[132px]"><PhotoSlot label="Healthy glowing skin" src="/quiz/intro-skin.jpg" radius={18} /></div></div>
            <div className={eyebrowClass}>Stage 1 of 3 · Skin type</div>
            <h1 className="font-head font-semibold text-[30px] leading-[1.12] tracking-[-0.025em] text-ss-ink mx-auto mb-[14px] max-w-[420px] [text-wrap:balance]">
              Let&rsquo;s figure out your skin type
            </h1>
            <p className="text-[16px] leading-[1.55] text-ss-ink-soft max-w-[400px] mx-auto mb-[30px] [text-wrap:pretty]">
              A few quick questions about how your skin behaves day to day. There are no wrong answers — just pick what sounds most like you.
            </p>
            <Button onClick={() => go(1)}>Start <Arrow /></Button>
            <div className="mt-4 text-[13px] text-ss-ink-faint">Takes about 1 minute</div>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 2 intro ----
  if (step === S2_INTRO) {
    return (
      <Shell {...shellProps}>
        <Screen screenKey="s2-intro" dir={dir}>
          <div className="text-center pt-2 pb-1">
            <div className="flex justify-center mb-[26px]"><div className="w-[132px]"><PhotoSlot label="Identifying skin concerns" src="/quiz/intro-concerns.jpg" radius={18} /></div></div>
            <div className={eyebrowClass}>Stage 2 of 3 · Concerns</div>
            <h1 className={introH1Class}>What would you like to improve?</h1>
            <p className={introPClass}>
              Your skin type is set. Now tell us the concerns you actually notice — pick as many or as few as feel true.
              This is what your routine will target.
            </p>
            <div className="flex gap-[10px] justify-center flex-wrap">
              <Button variant="ghost" onClick={() => go(N, "back")}><Arrow back /> Back</Button>
              <Button onClick={() => go(S2_PICK)}>Continue <Arrow /></Button>
            </div>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 2 concerns ----
  if (step === S2_PICK) {
    return (
      <Shell {...shellProps}>
        <Screen screenKey="s2-pick" dir={dir}>
          <div className="mb-[18px] flex items-end justify-between gap-4">
            <div>
              <div className={eyebrowClass}>Concerns</div>
              <h2 className={qH2Class}>What would you like to work on?</h2>
              <p className={qHelpClass}>Select all that apply — there&rsquo;s no limit, and you can skip any.</p>
            </div>
            <CountPill active={!!concerns.length}>{concerns.length} selected</CountPill>
          </div>
          <ConcernGrid concerns={CONCERNS} selected={concerns} onToggle={toggleConcern} />
          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => go(S2_INTRO, "back")}><Arrow back /> Back</Button>
            <Button onClick={() => go(hasPriority ? S2_PRIORITY : S2_DONE)} disabled={concerns.length === 0}>Continue <Arrow /></Button>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 2 priority ----
  if (step === S2_PRIORITY) {
    const chosen = CONCERNS.filter((c) => concerns.includes(c.id));
    return (
      <Shell {...shellProps}>
        <Screen screenKey="s2-priority" dir={dir}>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className={eyebrowClass}>Concerns</div>
              <h2 className={qH2Class}>Which matter most right now?</h2>
              <p className={qHelpClass}>Choose up to three — we&rsquo;ll put these at the centre of your routine.</p>
            </div>
            <CountPill active={!!topConcerns.length}>{topConcerns.length} / 3</CountPill>
          </div>
          <PriorityList concerns={chosen} value={topConcerns} onToggle={toggleTopConcern} max={3} />
          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => go(S2_PICK, "back")}><Arrow back /> Back</Button>
            <Button onClick={() => go(S2_DONE)} disabled={topConcerns.length === 0}>Continue <Arrow /></Button>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 2 analysis ----
  if (step === S2_DONE) {
    const result = analyzeSkin(answers, QS, concerns, topConcerns, CONCERNS);
    return (
      <Shell {...shellProps}>
        <Screen screenKey="analysis" dir={dir}>
          <AnalysisView
            result={result}
            onContinue={() => go(S3_COMMIT)}
            onBack={() => go(hasPriority ? S2_PRIORITY : S2_PICK, "back")}
            onEditSkin={() => go(1, "back")}
          />
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 3 commitment ----
  if (step === S3_COMMIT) {
    return (
      <Shell {...shellProps}>
        <Screen screenKey="s3-commit" dir={dir}>
          <div className="mb-5">
            <div className={eyebrowClass}>Stage 3 of 3 · Preferences</div>
            <h2 className={qH2Class}>How involved should your routine be?</h2>
            <p className={qHelpClass}>This sets how many steps we&rsquo;ll recommend — you can change it later.</p>
          </div>
          <CommitmentPicker levels={LEVELS} value={commitment} onChange={setCommitment} />
          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => go(S2_DONE, "back")}><Arrow back /> Back</Button>
            <Button onClick={() => go(S3_REGION)} disabled={!commitment}>Continue <Arrow /></Button>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 3 region ----
  if (step === S3_REGION) {
    return (
      <Shell {...shellProps}>
        <Screen screenKey="s3-region" dir={dir}>
          <div className="mb-5">
            <div className={eyebrowClass}>Preferences</div>
            <h2 className={qH2Class}>Any preference on where your skincare comes from?</h2>
            <p className={qHelpClass}>We&rsquo;ll lean your product suggestions toward this — it doesn&rsquo;t change the routine itself.</p>
          </div>
          <CommitmentPicker levels={REGIONS} value={region} onChange={(v) => setRegion(v as RegionId)} />
          <div className="flex items-center justify-between mt-6">
            <Button variant="ghost" onClick={() => go(S3_COMMIT, "back")}><Arrow back /> Back</Button>
            <Button onClick={() => go(S3_PREG)} disabled={!region}>Continue <Arrow /></Button>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Stage 3 pregnancy & nursing ----
  if (step === S3_PREG) {
    const selected = answers[PREG_Q.id];
    return (
      <Shell {...shellProps}>
        <Screen screenKey="s3-preg" dir={dir}>
          <div className="mb-[22px]">
            <div className={eyebrowClass}>Preferences</div>
            <h2 className={qH2Class}>{PREG_Q.title}</h2>
            <p className={qHelpClass}>{PREG_Q.help}</p>
          </div>
          <div className="grid gap-[10px] grid-cols-1">
            {PREG_Q.options.map((opt) => (
              <AnswerCard key={opt.id} option={opt} selected={selected === opt.id} onClick={() => select(PREG_Q.id, opt.id)} style="cards" />
            ))}
          </div>
          <div className="flex items-center justify-between mt-[26px]">
            <Button variant="ghost" onClick={() => go(S3_REGION, "back")}><Arrow back /> Back</Button>
            <Button onClick={() => go(FINISH)} disabled={!selected}>See my profile <Arrow /></Button>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Finale ----
  if (step === FINISH) {
    const chosenConcerns = CONCERNS.filter((c) => concerns.includes(c.id));
    const level = LEVELS.find((l) => l.id === commitment);
    return (
      <Shell {...shellProps}>
        <Screen screenKey="finish" dir={dir}>
          <FinaleScreen
            QS={QS}
            answers={answers}
            chosenConcerns={chosenConcerns}
            topConcerns={topConcerns}
            level={level}
            onBuild={() => { startBuild(selectedModel); go(R_NEEDS); }}
            onEditSkin={() => go(1, "back")}
            onEditConcerns={() => go(S2_PICK, "back")}
            onEditRoutine={() => go(S3_COMMIT, "back")}
            onBack={() => go(S3_PREG, "back")}
          />
        </Screen>
      </Shell>
    );
  }

  // ---- Results: building (AI call in flight) ----
  if (building && step >= R_NEEDS) {
    return (
      <Shell {...shellProps}>
        <Screen screenKey="r-building" dir={dir}>
          <div className="py-16 text-center">
            <div className="mx-auto mb-6 w-9 h-9 rounded-full border-[3px] border-ss-hairline border-t-ss-accent animate-spin" />
            <div className="font-head font-semibold text-[20px] text-ss-ink mb-1">Building your routine</div>
            <p className="text-[14.5px] text-ss-ink-soft max-w-[320px] mx-auto [text-wrap:pretty]">
              Consulting current products and the latest ingredient guidance — this takes a few seconds.
            </p>
          </div>
        </Screen>
      </Shell>
    );
  }

  // ---- Results: needs ----
  if (step === R_NEEDS) {
    const result = getResult();
    const { analysis, profile } = result;
    const summary = needsSummary(profile, analysis);
    const chips = [
      { label: `${profile.typeLabel} skin`, solid: true },
      profile.sensitivity === "high" && { label: "Sensitive", solid: false },
      profile.age && { label: AGE_LABELS[profile.age].replace("in your ", "").replace("under 20", "Under 20"), solid: false },
      ...profile.topConcernLabels.map((l) => ({ label: l, solid: false })),
      profile.commitmentLabel && { label: profile.commitmentLabel, solid: false },
      profile.region !== "none" && profile.regionLabel && { label: profile.regionLabel, solid: false },
    ].filter(Boolean) as { label: string; solid?: boolean }[];
    return (
      <Shell {...shellProps}>
        <Screen screenKey="r-needs" dir={dir}>
          {resultsTopBar(result.source)}
          <NeedsSummary chips={chips} paragraph={summary.paragraph} needs={summary.needs} onContinue={() => go(R_INGREDIENTS)} onBack={() => go(FINISH, "back")} />
        </Screen>
      </Shell>
    );
  }

  // ---- Results: ingredients ----
  if (step === R_INGREDIENTS) {
    const result = getResult();
    return (
      <Shell {...shellProps}>
        <Screen screenKey="r-ingredients" dir={dir}>
          {resultsTopBar(result.source)}
          <IngredientsView picked={result.picked} sensitive={result.profile.sensitivity === "high"} onContinue={() => go(R_ROUTINE)} onBack={() => go(R_NEEDS, "back")} />
          {result.source === "ai" && result.grounding && <GroundingSources grounding={result.grounding} />}
        </Screen>
      </Shell>
    );
  }

  // ---- Results: routine ----
  if (step === R_ROUTINE) {
    const result = getResult();
    return (
      <Shell {...shellProps}>
        <Screen screenKey="r-routine" dir={dir}>
          {resultsTopBar(result.source)}
          <RoutineView routine={result.routine} onContinue={() => go(R_SHOP)} onBack={() => go(R_INGREDIENTS, "back")} />
          {result.source === "ai" && result.grounding && <GroundingSources grounding={result.grounding} />}
        </Screen>
      </Shell>
    );
  }

  // ---- Results: shop ----
  if (step === R_SHOP) {
    const result = getResult();
    const { analysis, profile, routine } = result;
    const savePayload: SaveQuizRequest = {
      submission: { answers, concerns, topConcerns, commitment, region },
      result: { profile, analysis, routine },
    };
    return (
      <Shell {...shellProps}>
        <Screen screenKey="r-shop" dir={dir}>
          {resultsTopBar(result.source)}
          <ShopView
            routine={routine}
            region={profile.region}
            regionLabel={profile.regionLabel}
            productsByType={result.productsByType}
            onBack={() => go(R_ROUTINE, "back")}
            onRestart={() => { setAnswers({}); setConcerns([]); setTopConcerns([]); setCommitment(null); setRegion(null); setAiResult(null); setAiError(null); go(0, "back"); }}
            saveSlot={<SaveRoutine payload={savePayload} />}
          />
          {result.source === "ai" && result.grounding && <GroundingSources grounding={result.grounding} />}
        </Screen>
      </Shell>
    );
  }

  // ---- Question screen (1..N) ----
  const qIndex = step - 1;
  const q = SKIN_QS[qIndex];
  const selected = answers[q.id];

  return (
    <Shell {...shellProps}>
      <Screen screenKey={q.id} dir={dir}>
        <div className="mb-[22px]">
          <div className="font-mono text-[11.5px] tracking-[0.12em] uppercase text-ss-accent-ink mb-3">Question {qIndex + 1} of {N}</div>
          <h2 className="font-head font-semibold text-[25px] leading-[1.18] tracking-[-0.02em] text-ss-ink m-0 mb-2 [text-wrap:balance]">{q.title}</h2>
          <p className="text-[14.5px] leading-[1.5] text-ss-ink-soft m-0 [text-wrap:pretty]">{q.help}</p>
        </div>

        <div className="grid gap-[10px] grid-cols-1">
          {q.options.map((opt) => (
            <AnswerCard
              key={opt.id}
              option={opt}
              selected={selected === opt.id}
              onClick={() => select(q.id, opt.id)}
              style={q.noPhoto && CONFIG.answerStyle === "photos" ? "cards" : CONFIG.answerStyle}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-[26px]">
          <Button variant="ghost" onClick={() => go(step - 1, "back")}><Arrow back /> Back</Button>
          <Button onClick={() => go(step + 1, "fwd")} disabled={!selected}>Continue <Arrow /></Button>
        </div>
      </Screen>
    </Shell>
  );
}
