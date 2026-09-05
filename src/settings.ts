import { App, PluginSettingTab, Setting } from 'obsidian';
import type PpOcrPlugin from './main';

export interface PpOcrSettings {
	/** Hostname or IP of the PP-OCR Flask service. */
	host: string;
	/** Port of the PP-OCR Flask service. */
	port: string;
}

export const DEFAULT_SETTINGS: PpOcrSettings = {
	host: '127.0.0.1',
	port: '5000',
};

/** Full URL of the /ocr endpoint, with defaults applied for empty values. */
export function serverUrl(settings: PpOcrSettings): string {
	const host = settings.host.trim() || DEFAULT_SETTINGS.host;
	const port = settings.port.trim() || DEFAULT_SETTINGS.port;
	return `http://${host}:${port}/ocr`;
}

export class PpOcrSettingTab extends PluginSettingTab {
	plugin: PpOcrPlugin;
	private urlEl: HTMLElement | null = null;

	constructor(app: App, plugin: PpOcrPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName('OCR service').setHeading();

		new Setting(containerEl)
			.setName('Server address')
			.setDesc('Hostname or IP of the OCR service, e.g. 127.0.0.1')
			.addText((text) =>
				text
					.setPlaceholder('127.0.0.1')
					.setValue(this.plugin.settings.host)
					.onChange(async (value) => {
						this.plugin.settings.host = value.trim();
						await this.plugin.saveSettings();
						this.updateUrl();
					}),
			);

		new Setting(containerEl)
			.setName('Server port')
			.setDesc('Port of the OCR service, e.g. 5000')
			.addText((text) =>
				text
					.setPlaceholder('5000')
					.setValue(this.plugin.settings.port)
					.onChange(async (value) => {
						this.plugin.settings.port = value.trim();
						await this.plugin.saveSettings();
						this.updateUrl();
					}),
			);

		this.urlEl = containerEl.createEl('p');
		this.updateUrl();
	}

	private updateUrl(): void {
		if (!this.urlEl) return;
		const url = serverUrl(this.plugin.settings);
		this.urlEl.empty();
		this.urlEl.createSpan({ text: 'OCR endpoint: ' });
		this.urlEl.createEl('code', { text: url });
		const portOk = /^\d+$/.test(this.plugin.settings.port.trim() || DEFAULT_SETTINGS.port);
		if (!portOk) {
			this.urlEl.createSpan({ text: '  (port must be a number)', cls: 'ppocr-warning' });
		}
	}
}
