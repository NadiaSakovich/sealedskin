import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const KEY = process.env.GEMINI_API_KEY;
const ROOT = "/Users/nodi_melamori/Projects/sealedskin/design-drafts/snuffy-portrait";
const RAW = path.join(ROOT, "raw-fix2");
const VENV = "/private/tmp/claude-502/-Users-nodi-melamori-Projects-sealedskin/aba1c12e-4941-46f7-84a1-b379735ee308/scratchpad/venv/bin/python";
fs.mkdirSync(RAW, { recursive: true });

const LEAD = `Paint this picture on a background of solid pure magenta #FF00FF (RGB 255,0,255), edge to edge, all four corners. The background must be MAGENTA, never white, never cream, never grey. This is a chroma-key backdrop and it is the single most important instruction in this prompt.\n\n`;

const STYLE = `Minimal single-weight line drawing. Clean confident outlines in deep pine green #243f39, with a few flat fills of pale mint #eaf1e6 and one sage green #7a9e54 accent on the spectacle frames. Sparse and elegant, like a fine editorial spot illustration.`;

const CHARACTER = `Snuffy: a cute, friendly harbour seal who works as a cosmetologist. He wears round spectacles that make him look clever and bookish, and a clinician's off-white lab coat with a notched lapel collar, buttoned, the sleeves ending at his front flippers. He is the mascot of a skincare website, so he must read as warm, competent and reassuring - never goofy, never slapstick. Calm gentle expression with a soft closed-mouth smile, whiskers, big dark friendly eyes behind the glasses.`;

// Two separate failures to guard against at once: the first line-art render gave
// him a spare pair of hind flippers, and the fix for that turned his rear into a
// long curling mermaid tail. So state the limb COUNT and the body SHAPE both.
const ANATOMY = `ANATOMY - COUNT THE LIMBS, THIS IS CRITICAL. Snuffy is a seal and he has EXACTLY FOUR flippers in total, no more. Two FRONT flippers: these are the ones holding the cream jar at his chest, emerging from his lab coat sleeves, and they are the only limbs on the upper half of his body. Two HIND flippers: these are joined together at the very end of his body, side by side, spread open like one small fan, and they are the only limbs on the lower half of his body. Between his chest and that fan there is nothing but the smooth unbroken curve of his body: NO legs, NO feet, NO knees, NO arms, NO third pair of flippers, NO extra flipper poking out at the side, NO limb emerging from under the coat or from the middle of his body. Do NOT draw a flipper resting on the ground on one side and a separate tail on the other side - that is wrong and makes him look like he has too many limbs. Total limb count: 2 front + 2 hind = 4.`;

const BODY = `BODY SHAPE - EQUALLY CRITICAL. Snuffy is a SEAL, not a mermaid and not a fish. His body is stout, plump, heavy and barrel-shaped, widest at his middle, and it tapers only gently towards the back. The rear of his body is SHORT and THICK and rests along the ground. He must NOT have a long, slender, curving, tapering mermaid tail or fish tail. There is no narrow waist and no eel-like curl. The hind flippers are SMALL compared to the bulk of his body - a modest fan lying flat on the ground at the end of a thick body, never a big sweeping fish fin. Think of a real harbour seal hauled out on a rock: a heavy rounded sausage of an animal with little flippers at the end.`;

const POSE = `FULL BODY, head to hind flippers, the ENTIRE seal visible inside the frame with nothing cropped off. He sits upright facing the viewer, propped on his heavy lower body, which lies along the ground and curves gently to one side, ending in the one small fan of hind flippers. In his two front flippers, held in front of his chest, he holds a small squat round jar of face cream: a plain pale mint ceramic pot with a simple lid, completely blank, no label, no writing, no logo.`;

const PALETTE = `Colour palette for the SEAL AND HIS COAT ONLY, use only these: deep pine green #243f39 for outlines and darks, sage/olive green #7a9e54 as the accent, pale mint #eaf1e6, off-white #f6faf8, muted grey-green #5a716b. No blue, no pink, no bright saturated colour, no neon, no yellow.`;

const FRAME = `Tall vertical portrait format, 3:4, taller than it is wide. Snuffy is centred with clear breathing room on all four sides and fills most of the height. No text, no lettering, no signature, no watermark, no border, no frame. ABSOLUTELY NO rectangular panel, card, box, plaque or backing shape behind or around him - he floats directly on the flat magenta, which reaches all four corners unbroken. No floor, no ground line, no cast shadow on the background, no props or scenery other than the cream jar.`;

const KEYNOTE = `CRITICAL BACKGROUND INSTRUCTION: the entire background behind Snuffy must be one completely flat, uniform, solid pure magenta colour, hex #FF00FF, RGB 255 0 255. Absolutely uniform - no gradient, no texture, no checkerboard, no pattern, no vignette, no shadow falling onto it. The magenta is a chroma-key that will be removed, so no part of Snuffy, his glasses, his coat, the jar or his shadow may be magenta or pinkish, and there must be no magenta glow or halo around him.`;

const TEXT_PROMPT = [STYLE, CHARACTER, ANATOMY, BODY, POSE, PALETTE, FRAME, KEYNOTE].join(" ");

// The gouache render already got the anatomy right, so hand it back as a pose
// reference rather than describing the same thing a third time.
const REF_PROMPT = [
  `The attached picture is the CORRECT reference for Snuffy's anatomy, proportions and pose. Redraw that exact same seal, in that exact same pose, at that same camera angle, but in a completely different drawing style.`,
  STYLE,
  `Keep from the reference: the stout heavy seal body, the way his lower body lies along the ground and curves to one side, the single small fan of hind flippers at the end of it, the two front flippers holding the cream jar at his chest, the lab coat, the round spectacles and the friendly expression.`,
  ANATOMY,
  `Change from the reference: his fur is now PALE - off-white #f6faf8 and pale mint #eaf1e6 - described by fine pine green outlines rather than by painted grey-green fill. Flat and linear, no painterly shading, no gouache texture, no brush strokes.`,
  PALETTE, FRAME, KEYNOTE,
].join(" ");

function keyObeyed(file) {
  return execFileSync(VENV, ["-c", `
from PIL import Image
im = Image.open(${JSON.stringify(file)}).convert("RGB"); w,h = im.size; p = im.load()
ok = all(min(c[0],c[2]) - c[1] > 120 for c in (p[2,2], p[w-3,2], p[2,h-3], p[w-3,h-3]))
print("OK" if ok else "NO")`]).toString().trim() === "OK";
}

const REF = fs.readFileSync(path.join(ROOT, "raw", "02-soft-gouache.jpg")).toString("base64");

const JOBS = [];
for (let n = 1; n <= 4; n++) JOBS.push({ id: `txt-${n}`, prompt: TEXT_PROMPT, ref: false });
for (let n = 1; n <= 4; n++) JOBS.push({ id: `ref-${n}`, prompt: REF_PROMPT, ref: true });

const meta = [];
for (const job of JOBS) {
  const file = path.join(RAW, `${job.id}.jpg`);
  let done = false;
  for (let attempt = 1; attempt <= 3 && !done; attempt++) {
    process.stdout.write(`${job.id} attempt ${attempt} ... `);
    const parts = job.ref
      ? [{ inline_data: { mime_type: "image/jpeg", data: REF } }, { text: LEAD + job.prompt }]
      : [{ text: LEAD + job.prompt + "\n\nRemember: solid magenta #FF00FF background; exactly four flippers; a stout heavy seal body, never a long mermaid tail." }];
    let res;
    try {
      res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({ contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4", imageSize: "2K" } } }),
      });
    } catch (e) { console.log("fetch error", e.message); continue; }
    if (!res.ok) { console.log("FAILED", res.status, (await res.text()).slice(0, 160)); continue; }
    const got = (await res.json())?.candidates?.[0]?.content?.parts ?? [];
    const d = got.map((p) => p.inline_data ?? p.inlineData).find(Boolean);
    if (!d) { console.log("no image"); continue; }
    const tmp = path.join(RAW, `${job.id}.candidate.jpg`);
    fs.writeFileSync(tmp, Buffer.from(d.data, "base64"));
    if (keyObeyed(tmp)) { fs.renameSync(tmp, file); console.log("magenta OK"); done = true; }
    else { fs.unlinkSync(tmp); console.log("background not magenta, retrying"); }
  }
  meta.push({ id: job.id, label: job.ref ? "Line art from the gouache pose" : "Line art, stout body", prompt: job.prompt, file, error: done ? undefined : "no usable key" });
}
fs.writeFileSync(path.join(RAW, "_meta.json"), JSON.stringify(meta, null, 2));
console.log("\ndone");
