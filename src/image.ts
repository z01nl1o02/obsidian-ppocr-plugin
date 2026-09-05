import { App, TFile } from 'obsidian';

const IMAGE_EXTENSIONS = new Set([
	'png',
	'jpg',
	'jpeg',
	'gif',
	'bmp',
	'webp',
]);

export function isImageFile(file: TFile): boolean {
	return IMAGE_EXTENSIONS.has(file.extension.toLowerCase());
}

/**
 * Resolve the vault file behind a rendered <img> element.
 *
 * Obsidian serves vault images through `app://<id>/<encoded-path>`
 * resource URLs, so we match against `vault.getResourcePath()` first,
 * then fall back to decoding the URL back into a vault path and,
 * finally, to a unique basename match.
 */
export function resolveImageFile(
	app: App,
	img: HTMLImageElement,
): TFile | null {
	const raw = img.getAttribute('src') ?? '';
	if (!raw || /^[a-z]+:\/\//i.test(raw) && !raw.startsWith('app://')) {
		return null;
	}

	// 1) exact match against vault resource paths
	for (const file of app.vault.getFiles()) {
		if (!isImageFile(file)) continue;
		try {
			if (app.vault.getResourcePath(file) === raw) return file;
		} catch {
			// ignore unreadable candidates
		}
	}

	// 2) decode the app:// URL back into a vault-relative path
	try {
		const url = new URL(raw);
		const path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
		const candidate = app.vault.getAbstractFileByPath(path);
		if (candidate instanceof TFile && isImageFile(candidate)) {
			return candidate;
		}
	} catch {
		// not a parsable app:// URL
	}

	// 3) unique basename match
	const rawPath = raw.split('?')[0] ?? raw;
	const basename = decodeURIComponent(rawPath.split('/').pop() ?? '');
	if (basename) {
		const hits = app.vault
			.getFiles()
			.filter((file) => isImageFile(file) && file.name === basename);
		if (hits.length === 1) return hits[0] ?? null;
	}

	return null;
}
