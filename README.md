# PP-OCR for Obsidian

An Obsidian plugin that runs OCR on images via a self-hosted
[PP-OCR](https://github.com/PaddlePaddle/PaddleOCR) Flask service and
inserts the recognized text into your document.

![demo](https://img.shields.io/badge/OCR-PP--OCRv6-blue)

## Features

- Right-click any rendered image (live preview / reading mode) and choose
  **OCR** — the recognized text is inserted at the editor cursor, wrapped
  in `---` horizontal rules (with blank lines) so it stays visually
  separate from the rest of the note.
- Configurable OCR service address and port.
- Falls back to the clipboard when the active pane is in reading mode.

## Requirements

A running instance of the companion Flask service (`server.py` in the
parent repository), which accepts `POST /ocr` multipart uploads and
returns:

```json
{ "success": true, "data": [{ "text": "...", "confidence": 0.99 }] }
```

Start it with:

```bash
conda activate ppocr
python server.py            # listens on 0.0.0.0:5000
```

## Install (manual)

```bash
npm install
npm run build               # produces main.js
```

Copy `main.js`, `manifest.json` (and `styles.css` if present) to:

```
<Vault>/.obsidian/plugins/ppocr-plugin/
```

Then enable **PP-OCR** under **Settings → Community plugins**.

## Configure

**Settings → PP-OCR**:

| Option         | Default    | Description                          |
| -------------- | ---------- | ------------------------------------ |
| Server address | `127.0.0.1` | Hostname or IP of the OCR service |
| Server port    | `5000`     | Port of the OCR service              |

## Usage

1. Open a note containing an embedded image (e.g. `![[Q2.jpg]]`).
2. Right-click the image.
3. Select **OCR**.
4. The recognized text is inserted at the cursor between two `---`
   separator lines (or copied to the clipboard in reading mode).

## Privacy

This plugin sends the clicked image to the OCR service address you
configure. No data is sent anywhere else. Self-host the service to keep
everything on your own machine/network.

## Verification

`scripts/verify-request.mjs` replays the plugin's exact multipart
request against the service and validates the response contract:

```bash
python python-packages/server.py &          # in the ppocr conda env
node scripts/verify-request.mjs Q2.jpg http://127.0.0.1:5000/ocr
# PASS: contract OK, N item(s).
```

Note: run only **one** instance of `server.py` — a second instance that
fails to bind still loads the Paddle models and can exhaust memory
(~2 GB each), making the running service fail mid-inference.

## Development

```bash
npm run dev       # esbuild watch
npm run build     # type-check + production bundle
npm run lint      # eslint (obsidianmd rules)
```
