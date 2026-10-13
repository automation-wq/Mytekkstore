"""Generates the 15 premium TV lifestyle pictures in prompts.json, one file each, with Google's Gemini image models.

    py -3 generate_tv_images.py              generate what is missing (needs GEMINI_API_KEY in .env or the environment)
    py -3 generate_tv_images.py --dry-run    show what would be sent, make nothing, needs no key
    py -3 generate_tv_images.py --force      regenerate everything, even pictures that already exist
    py -3 generate_tv_images.py --only 3 7   just these prompt ids

Output: output/tv_lifestyle_images/tv_lifestyle_NN.png plus prompts.json (a copy of what was used) and generation_log.json.
Nothing is reported as generated unless the API returned image bytes that decode as a real picture of the expected size.
Then, in the website: cd ../../web && npm run lifestyle && npm run build (web/lifestyle.js maps the pictures to the site's slots).
"""
import argparse, base64, io, json, os, sys, time, urllib.error, urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "output" / "tv_lifestyle_images"
PROMPTS = HERE / "prompts.json"
REFS = HERE / "references"                      # optional: the client's three reference pictures (jpg/png), sent along as visual guidance
API = "https://generativelanguage.googleapis.com/v1beta"
DEFAULT_MODEL = "gemini-nano-banana-2.1"        # Google's current image model (docs, Oct 2026); older: gemini-2.5-flash-image
ASPECT, SIZE = "16:9", "2K"
MIN_W, MIN_H = 1024, 576                        # smaller than this is not a usable 16:9 picture


def load_env():
    """.env next to this file, KEY=value lines; the real environment wins."""
    env = HERE / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def references():
    if not REFS.exists():
        return []
    out = []
    for p in sorted(REFS.iterdir()):
        if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
            mime = "image/png" if p.suffix.lower() == ".png" else "image/webp" if p.suffix.lower() == ".webp" else "image/jpeg"
            out.append({"type": "image", "mime_type": mime, "data": base64.b64encode(p.read_bytes()).decode()})
    return out[:14]


def request(url, body, key, timeout=180):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", "x-goog-api-key": key})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def find_image(node):
    """The first base64 picture anywhere in the response (the Interactions API and generateContent nest it differently)."""
    if isinstance(node, dict):
        if isinstance(node.get("data"), str) and len(node["data"]) > 1000 and (node.get("type") == "image" or "mime_type" in node or "mimeType" in node):
            return node["data"]
        for k in ("inlineData", "inline_data"):
            if isinstance(node.get(k), dict) and isinstance(node[k].get("data"), str):
                return node[k]["data"]
        for v in node.values():
            found = find_image(v)
            if found:
                return found
    elif isinstance(node, list):
        for v in node:
            found = find_image(v)
            if found:
                return found
    return None


def generate(prompt, key, model, refs):
    """Returns PNG/JPEG bytes. Interactions API first (current docs); the classic generateContent shape for the older model."""
    if model.startswith("gemini-2.5"):
        body = {"contents": [{"parts": [{"text": prompt}] + [{"inline_data": {"mime_type": r["mime_type"], "data": r["data"]}} for r in refs]}],
                "generationConfig": {"responseModalities": ["IMAGE"], "imageConfig": {"aspectRatio": ASPECT}}}
        data = request(f"{API}/models/{model}:generateContent", body, key)
    else:
        body = {"model": model, "input": [{"type": "text", "text": prompt}] + refs,
                "response_format": {"type": "image", "mime_type": "image/png", "aspect_ratio": ASPECT, "image_size": SIZE}}
        data = request(f"{API}/interactions", body, key)
    b64 = find_image(data)
    if not b64:
        raise RuntimeError("the API answered without a picture: " + json.dumps(data)[:300])
    return base64.b64decode(b64)


def valid(path):
    """Real picture, landscape, big enough. Pillow when installed, else a PNG/JPEG header check."""
    raw = path.read_bytes()
    try:
        from PIL import Image
        with Image.open(io.BytesIO(raw)) as im:
            im.verify()
        with Image.open(io.BytesIO(raw)) as im:
            w, h = im.size
        return (w >= MIN_W and h >= MIN_H and w > h), f"{w}x{h}"
    except ImportError:
        ok = raw[:8] == b"\x89PNG\r\n\x1a\n" or raw[:3] == b"\xff\xd8\xff"
        return (ok and len(raw) > 50_000), "header only (pip install pillow for a size check)"
    except Exception as e:
        return False, str(e)


def crop_16_9(path):
    """Crops to 16:9 around the centre when the provider returned another shape (the TV sits in the middle of every prompt)."""
    try:
        from PIL import Image
    except ImportError:
        return
    with Image.open(path) as im:
        w, h = im.size
        if abs(w / h - 16 / 9) < 0.02:
            return
        if w / h > 16 / 9:
            nw = int(h * 16 / 9); box = ((w - nw) // 2, 0, (w - nw) // 2 + nw, h)
        else:
            nh = int(w * 9 / 16); box = (0, (h - nh) // 2, w, (h - nh) // 2 + nh)
        im.crop(box).save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="print the plan, call nothing")
    ap.add_argument("--force", action="store_true", help="regenerate pictures that already exist")
    ap.add_argument("--only", nargs="*", type=int, default=None, help="prompt ids to run")
    ap.add_argument("--model", default=None, help="image model id (default from GEMINI_IMAGE_MODEL or %s)" % DEFAULT_MODEL)
    ap.add_argument("--retries", type=int, default=4)
    a = ap.parse_args()

    load_env()
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    model = a.model or os.environ.get("GEMINI_IMAGE_MODEL", DEFAULT_MODEL)
    spec = json.loads(PROMPTS.read_text(encoding="utf-8"))
    items = [it for it in spec["images"] if not a.only or it["id"] in a.only]
    OUT.mkdir(parents=True, exist_ok=True)
    refs = references()
    log_path, log = OUT / "generation_log.json", {"started": datetime.now(timezone.utc).isoformat(), "model": model, "references": len(refs), "results": []}

    if not key and not a.dry_run:
        print("No GEMINI_API_KEY. Create a free key at https://aistudio.google.com/apikey, copy .env.example to .env, paste it there, run again.")
        print("To see the plan without a key: py -3 generate_tv_images.py --dry-run")
        sys.exit(2)

    ok = fail = skipped = 0
    for it in items:
        path = OUT / it["filename"]
        prompt = it["prompt"] + " " + spec.get("global", "")
        if path.exists() and not a.force:
            good, info = valid(path)
            if good:
                print(f"[{it['id']:02d}] kept     {it['filename']} ({info})"); skipped += 1
                log["results"].append({"id": it["id"], "file": it["filename"], "status": "kept", "info": info}); continue
        if a.dry_run:
            print(f"[{it['id']:02d}] would make {it['filename']} with {model} {ASPECT} {SIZE}, {len(refs)} reference picture(s): {it['title']}"); continue
        result = {"id": it["id"], "file": it["filename"], "title": it["title"], "status": "failed", "attempts": 0}
        for attempt in range(1, a.retries + 1):
            result["attempts"] = attempt
            try:
                print(f"[{it['id']:02d}] making   {it['filename']} (attempt {attempt})...", flush=True)
                path.write_bytes(generate(prompt, key, model, refs))
                crop_16_9(path)
                good, info = valid(path)
                if not good:
                    raise RuntimeError("the returned file is not a usable picture: " + info)
                result.update(status="generated", info=info, bytes=path.stat().st_size); ok += 1
                print(f"[{it['id']:02d}] done     {it['filename']} ({info}, {path.stat().st_size // 1024} KB)")
                break
            except urllib.error.HTTPError as e:
                text = e.read().decode(errors="replace")[:300]
                result["error"] = f"HTTP {e.code}: {text}"
                if e.code in (429, 500, 502, 503, 504) and attempt < a.retries:
                    wait = min(60, 5 * 2 ** attempt); print(f"      {result['error']} - waiting {wait}s"); time.sleep(wait); continue
                if e.code in (400, 401, 403, 404):
                    print(f"      {result['error']}"); break
            except (urllib.error.URLError, TimeoutError, ConnectionError, RuntimeError) as e:
                result["error"] = str(e)[:300]
                if attempt < a.retries:
                    wait = min(60, 5 * 2 ** attempt); print(f"      {result['error']} - waiting {wait}s"); time.sleep(wait); continue
        if result["status"] != "generated":
            fail += 1
            if path.exists() and not valid(path)[0]:
                path.unlink()
            print(f"[{it['id']:02d}] FAILED   {it['filename']}: {result.get('error', 'no picture')}")
        log["results"].append(result)
        log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")

    (OUT / "prompts.json").write_text(json.dumps(spec, indent=2), encoding="utf-8")
    log["finished"] = datetime.now(timezone.utc).isoformat(); log["summary"] = {"generated": ok, "kept": skipped, "failed": fail}
    log_path.write_text(json.dumps(log, indent=2), encoding="utf-8")
    if not a.dry_run:
        print(f"\n{ok} generated, {skipped} kept, {fail} failed. Log: {log_path}")
        if ok or skipped:
            print("Next: cd ../../web && npm run lifestyle && npm run build")
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
