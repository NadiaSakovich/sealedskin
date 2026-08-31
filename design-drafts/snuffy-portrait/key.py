"""Punch the magenta chroma key out to real alpha, de-fringe, trim, fit to 3:4.

Same approach as the avatar run (Gemini paints a checkerboard when asked for a
transparent background, so we key a flat #FF00FF backdrop), but vectorised with
numpy because these frames are 1792x2400 rather than 1024 square, and padded
back into a 3:4 portrait instead of a square.
"""
import json, os
import numpy as np
from PIL import Image

RAW = "/Users/nodi_melamori/Projects/sealedskin/design-drafts/snuffy-portrait/raw"
OUT = "/Users/nodi_melamori/Projects/sealedskin/design-drafts/snuffy-portrait"
W, H = 1200, 1600          # 3:4
FILL = 0.96                # how much of the canvas height the subject takes

def process(path, out_path):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # "Keyness": magenta is high red + high blue, low green.
    k = np.minimum(r, b) - g

    # Alpha ramps over the key range so anti-aliased edges stay soft.
    LO, HI = 40, 120
    alpha = np.clip(255.0 * (HI - k) / (HI - LO), 0, 255).astype(np.uint8)

    # De-fringe: partly transparent edge pixels carry magenta spill, so pull
    # green up to min(r,b) there or every edge keeps a pink halo.
    edge = (alpha < 250) & (k > 0)
    m = np.minimum(r, b)
    g2 = np.where(edge, np.maximum(g, m), g)
    r2 = np.where(edge, np.minimum(r, g2), r)
    b2 = np.where(edge, np.minimum(b, g2), b)
    rgb = np.stack([r2, g2, b2], axis=-1).astype(np.uint8)

    out = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")

    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    ow, oh = out.size

    # Fit the subject into the 3:4 canvas by whichever axis binds first.
    scale = min(W * FILL / ow, H * FILL / oh)
    nw, nh = max(1, int(round(ow * scale))), max(1, int(round(oh * scale)))
    out = out.resize((nw, nh), Image.LANCZOS)

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    canvas.paste(out, ((W - nw) // 2, (H - nh) // 2), out)
    canvas.save(out_path, "PNG", optimize=True)

    clear = float((np.asarray(canvas)[..., 3] < 8).mean())
    return {"file": os.path.basename(out_path),
            "kb": round(os.path.getsize(out_path) / 1024),
            "transparentPct": round(clear * 100, 1),
            "subject": f"{nw}x{nh}"}

meta = json.load(open(os.path.join(RAW, "_meta.json")))
rows = []
for v in meta:
    if v.get("error"):
        print(f"{v['id']:24s} SKIPPED ({v['error']})")
        continue
    res = process(v["file"], os.path.join(OUT, v["id"] + ".png"))
    res["id"] = v["id"]; res["label"] = v["label"]
    rows.append(res)
    print(f"{res['id']:24s} {res['kb']:5d}KB  transparent {res['transparentPct']:5.1f}%  subject {res['subject']}")
json.dump(rows, open(os.path.join(OUT, "_options.json"), "w"), indent=2)
