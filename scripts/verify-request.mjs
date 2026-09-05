/**
 * Protocol-level verification for the PP-OCR plugin.
 *
 * Replicates src/ocr.ts buildMultipart() + recognizeImage() using plain
 * Node fetch (browser CORS does not apply here) and asserts that the
 * PP-OCR Flask service (server.py) accepts the request and returns the
 * expected JSON contract: { success: true, data: [{text, confidence}] }.
 *
 * Usage: node scripts/verify-request.mjs <image> [url]
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const imagePath = process.argv[2] ?? 'Q2.jpg';
const url = process.argv[3] ?? 'http://127.0.0.1:5000/ocr';

// --- mirror of src/ocr.ts ----------------------------------------------
const MIME_BY_EXT = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	bmp: 'image/bmp',
	webp: 'image/webp',
};

function mimeFromFilename(filename) {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function buildMultipart(field, filename, mime, data) {
	const boundary =
		'----ObsidianPpOcrBoundary' +
		Date.now().toString(16) +
		Math.random().toString(16).slice(2);
	const encoder = new TextEncoder();
	const head = encoder.encode(
		`--${boundary}\r\n` +
			`Content-Disposition: form-data; name="${field}"; filename="${filename}"\r\n` +
			`Content-Type: ${mime}\r\n\r\n`,
	);
	const tail = encoder.encode(`\r\n--${boundary}--\r\n`);

	const file = new Uint8Array(data);
	const body = new Uint8Array(head.length + file.length + tail.length);
	body.set(head, 0);
	body.set(file, head.length);
	body.set(tail, head.length + file.length);

	return {
		body: body.buffer,
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

async function recognizeImage(url, data, filename) {
	const { body, contentType } = buildMultipart(
		'image',
		filename,
		mimeFromFilename(filename),
		data,
	);
	const response = await fetch(url, {
		method: 'POST',
		body,
		headers: { 'Content-Type': contentType },
	});
	if (response.status >= 400) {
		throw new Error(`OCR service returned HTTP ${response.status}`);
	}
	const json = await response.json();
	if (!json.success) {
		throw new Error(json.error ?? 'Unknown OCR service error');
	}
	return json.data ?? [];
}
// -----------------------------------------------------------------------

const data = readFileSync(imagePath);
const filename = basename(imagePath);
console.log(`POST ${filename} (${data.length} bytes) -> ${url}`);

const items = await recognizeImage(url, data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), filename);

if (!Array.isArray(items) || items.length === 0) {
	console.error('FAIL: expected a non-empty items array');
	process.exit(1);
}
for (const item of items) {
	if (typeof item.text !== 'string' || typeof item.confidence !== 'number') {
		console.error('FAIL: bad item shape', item);
		process.exit(1);
	}
}

console.log(`PASS: contract OK, ${items.length} item(s). First lines:`);
for (const item of items.slice(0, 5)) {
	console.log(`  [${item.confidence.toFixed(4)}] ${item.text}`);
}
