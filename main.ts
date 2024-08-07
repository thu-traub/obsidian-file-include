import { MarkdownRenderer, Plugin, TFile, TFolder, View, normalizePath } from 'obsidian';
import { resolvePath } from './util';


export default class IncludeFilePlugin extends Plugin {
	async onload() {
		this.registerMarkdownCodeBlockProcessor("include", async (source, el, ctx) => {
			let markdown: string;
			let include_path: string;
			try {
				// Get the section information.
				const sectionInfo = ctx.getSectionInfo(el);
				if (sectionInfo == null) {
					throw Error("Could not retrieve section information.");
				}

				let content : string = "";
				const src : string = source.trim();

				if (src.startsWith("http://") || src.startsWith("https://")) {

					// Load the content from a URL.
					// The server must have CORS enabled.

					let response: Response;							// HTTP Response object.
					let httperr: string | undefined = undefined;	// HTTP error message. If any.

					try {
						// Fetch the file using GER and a custom User-Agent.
						response = await fetch(src, {
							method: "GET",
							headers: {
								"User-Agent": "Obsidian Include File Plugin",
								"Accept": "*/*"
							},
						});

						if (!response.ok) {
							// load httperr message with status code and status text.
							httperr = `"${src}" could not be loaded. ${response.status} ${response.statusText}.`;
						} else {
							// load content with the response text.
							content = await response.text();
						}
						
					} catch (error) {
						// Here we end up if there is no network connection or the CORS headers are not set.
						console.log(error);
						httperr = `"${src}" could not be loaded.\n${error}. Network or CORS headers problem.`;
					}

					if (httperr !== undefined) {
						throw Error(httperr);
					}

				} else {
					
					// Resolve the file relative to the current document.
					include_path = normalizePath(resolvePath(normalizePath(src), ctx.sourcePath));

					// Load the content.
					const include_file = this.app.vault.getAbstractFileByPath(include_path);
					if (include_file == null) {
						throw Error(`"${source}" could not be found.`);
					} else if (include_file instanceof TFolder) {
						throw Error(`"${source}" is a folder.`);
					} else if (!(include_file instanceof TFile)) {
						throw Error(`"${source}" is not a file.`);
					}

					content = await this.app.vault.read(include_file);
				}

				// Determine the language if any.
				const startLine = sectionInfo.text.split(/\n/)[sectionInfo.lineStart];
				const lang = startLine.match(/include(?:[:\s]+(?<lang>\w+))?/)?.groups?.lang;

				// Prepare the markdown content.
				markdown = ["```", lang, "\n", content.trim(), "\n```"].join("");
			} catch (error) {
				// Show an error message.
				let message: string;
				if (error instanceof Error) {
					message = error.message;
				} else {
					message = String(error);
				}
				markdown = `> [!error] ${message}`;
				include_path = "unresolved";
			}

			// Render the content or abort with a simple error message if there is no active view.
			const view = this.app.workspace.getActiveViewOfType(View);
			if (view == null) {
				el.createSpan({text: "There is no active view for rendering markdown."});
			} else {
				await MarkdownRenderer.renderMarkdown(markdown, el, ctx.sourcePath, view);
			}
		});
	}

	onunload() { }
}
