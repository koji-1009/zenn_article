import { danger, fail, message, warn } from "danger";
import { createLinter, loadTextlintrc } from "textlint";

async function main() {
	// Load textlint configuration
	const descriptor = await loadTextlintrc();
	const linter = createLinter({ descriptor });

	// Get the list of changed files
	const files = [...danger.git.modified_files, ...danger.git.created_files];

	// Filter markdown files in one pass
	const targetFiles = files.filter((file) => file.endsWith(".md"));

	// Lint all files in parallel and wait for all results
	const allResults = await Promise.all(
		targetFiles.map((file) =>
			linter.lintFiles([file]).then((results) => ({ file, results })),
		),
	);

	// Map severity to reporter
	const severityMap = [message, warn, fail];

	for (const { file, results } of allResults) {
		for (const result of results) {
			for (const m of result.messages) {
				const reporter = severityMap[m.severity] || message;
				reporter(m.message, file, m.loc?.start?.line);
			}
		}
	}
}

main();
