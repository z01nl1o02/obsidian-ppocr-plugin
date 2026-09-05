import { MarkdownView, Menu, Notice, Plugin, TFile } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	PpOcrSettings,
	PpOcrSettingTab,
	serverUrl,
} from './settings';
import { recognizeImage } from './ocr';
import { resolveImageFile } from './image';

export default class PpOcrPlugin extends Plugin {
	settings: PpOcrSettings = { ...DEFAULT_SETTINGS };

	async onload() {
		await this.loadSettings();

		// Right-click menu on rendered images (live preview & reading mode).
		this.registerDomEvent(activeDocument, 'contextmenu', (evt: MouseEvent) => {
			this.showImageContextMenu(evt);
		});

		this.addSettingTab(new PpOcrSettingTab(this.app, this));
	}

	onunload() {}

	private showImageContextMenu(evt: MouseEvent) {
		const target = evt.target as HTMLElement | null;
		const img = target?.closest?.('img') as HTMLImageElement | null;
		if (!img) return;

		const menu = new Menu();
		menu.addItem((item) => {
			item.setTitle('OCR')
				.setIcon('scan-text')
				.onClick(async () => {
					const file = resolveImageFile(this.app, img);
					if (!file) {
						new Notice('PP-OCR: not a local vault image, skipped.');
						return;
					}
					await this.ocrVaultFile(file);
				});
		});
		menu.showAtMouseEvent(evt);
	}

	private async ocrVaultFile(file: TFile) {
		try {
			new Notice(`PP-OCR: recognizing ${file.name} …`);
			const data = await this.app.vault.readBinary(file);
			const items = await recognizeImage(
				serverUrl(this.settings),
				data,
				file.name,
			);

			const text = items.map((entry) => entry.text).join('\n');
			if (!text.trim()) {
				new Notice('PP-OCR: no text recognized.');
				return;
			}
			await this.insertOrCopyResult(text, items.length);
		} catch (error) {
			new Notice(
				`PP-OCR failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Insert the OCR text at the cursor in the active editor.
	 * Falls back to the clipboard when no editable editor is available
	 * (e.g. the active pane is in reading mode).
	 */
	private async insertOrCopyResult(text: string, count: number) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.getMode() === 'source') {
			// Wrap the result in horizontal rules with blank lines so it stays
			// visually separate from surrounding content. The leading blank
			// line is required: a `---` directly below a text line would turn
			// that line into an H2 heading (setext heading) in Markdown.
			view.editor.replaceSelection(`\n---\n${text}\n---\n`);
			new Notice(`PP-OCR: inserted ${count} text block(s).`);
			return;
		}

		await navigator.clipboard.writeText(text);
		new Notice(
			view
				? 'PP-OCR: reading mode active, result copied to clipboard.'
				: `PP-OCR: ${count} text block(s) copied to clipboard.`,
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<PpOcrSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
