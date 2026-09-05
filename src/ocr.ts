import { requestUrl } from 'obsidian';

export interface OcrItem {
	text: string;
	confidence: number;
}

const MIME_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	gif: 'image/gif',
	bmp: 'image/bmp',
	webp: 'image/webp',
};

export function mimeFromFilename(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? '';
	return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

/**
 * Build a multipart/form-data body.
 *
 * Obsidian's requestUrl does not support FormData, so the multipart
 * payload is assembled manually. The result matches what
 * `requests.post(url, files={'image': ...})` produces for the
 * PP-OCR Flask service (server.py).
 */
export function buildMultipart(
	field: string,
	filename: string,
	mime: string,
	data: ArrayBuffer,
): { body: ArrayBuffer; contentType: string } {
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

/**
 * Send an image to the PP-OCR service and return the recognized items.
 * Throws on network errors and non-successful responses.
 */
export async function recognizeImage(
	url: string,
	data: ArrayBuffer,
	filename: string,
): Promise<OcrItem[]> {
	const { body, contentType } = buildMultipart(
		'image',
		filename,
		mimeFromFilename(filename),
		data,
	);

	const response = await requestUrl({
		url,
		method: 'POST',
		body,
		headers: { 'Content-Type': contentType },
		throw: false,
	});

	if (response.status >= 400) {
		throw new Error(`OCR service returned HTTP ${response.status}`);
	}

	const json = response.json as {
		success?: boolean;
		error?: string;
		data?: OcrItem[];
	};
	if (!json.success) {
		throw new Error(json.error ?? 'Unknown OCR service error');
	}

	return json.data ?? [];
}
