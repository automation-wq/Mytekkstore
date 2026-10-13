# 15 premium TV lifestyle pictures

Generates the fifteen pictures described in `prompts.json` (one file each, 16:9, no people, no text) with Google's Gemini image
model, then feeds them into the website's lifestyle slots. The three reference pictures the client supplied (white studio, warm
living room, cinematic studio) already live in the site as `public/img/p34.jpg`, `life-room.jpg` and `life-cinema.jpg`; drop copies
into `references/` here and they are sent along as visual guidance.

## Setup (Windows)

```
cd tools\tv-images
py -3 -m pip install -r requirements.txt        (optional: Pillow for size checks and 16:9 cropping)
copy .env.example .env                          then paste your key into .env
```

Free key: https://aistudio.google.com/apikey (Google AI Studio). Keys are read from `.env` or the environment only; nothing is
hard-coded. `.env` is git-ignored.

## Run

```
py -3 generate_tv_images.py --dry-run           shows the 15 jobs, calls nothing, needs no key
py -3 generate_tv_images.py                     makes every picture that is missing
py -3 generate_tv_images.py --force             makes all 15 again
py -3 generate_tv_images.py --only 3 14         just those prompt ids
```

Output goes to `output/tv_lifestyle_images/`: `tv_lifestyle_01.png` … `tv_lifestyle_15.png`, a copy of `prompts.json`, and
`generation_log.json` with one entry per picture (generated / kept / failed, attempts, error text). Temporary errors (rate limit,
5xx, network) are retried with back-off; existing good pictures are kept unless `--force`; a file is only counted as generated
when the API returned bytes that open as a real landscape picture of at least 1024×576.

## Into the website

```
cd ..\..\web
npm run lifestyle      copies the pictures to public/img/life-NN.jpg (+ WebP sizes) and fills src/lifestyle.json
npm run build          the home page, category page, product galleries and A+ sections pick them up
```

Which picture goes where is the `SLOTS` table in `web/lifestyle.js` (hero, Latest Launches, Shop by Size/OS/Resolution, product
gallery room and cinema views, A+ sections, category banner). Edit a prompt in `prompts.json` and rerun with `--only <id>` to
replace one picture.

## Provider notes

- Model: `gemini-nano-banana-2.1` through the Interactions API (`POST /v1beta/interactions`, header `x-goog-api-key`), with
  `response_format` `{type: image, aspect_ratio: 16:9, image_size: 2K}` and up to 14 reference pictures in `input`. Set
  `GEMINI_IMAGE_MODEL=gemini-2.5-flash-image` to use the older model through `generateContent` instead.
- The script reads the picture from wherever the response nests it (`data` on an image block, or `inlineData.data`), so a
  response-shape change on Google's side does not break it silently: a reply without picture bytes is logged as a failure.
- Another provider (OpenAI Images, Stability, Higgsfield) is a different `generate()` function; the prompts and the website hook
  stay the same.
