import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const emoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3|✦|<a?:\w+:\d+>/u;
const vietnamese = /[À-ÖØ-öø-ÿĂăĐđĨĩŨũƠơƯư\u1EA0-\u1EF9]/u;
const prose = /[a-zA-Z]{2,} [a-zA-Z]{2,}/;
const displayMethods = new Set(['setLabel', 'setDescription', 'setTitle', 'setPlaceholder', 'setContent']);

/** Narrow exceptions for technical strings, never a file-wide suppression. */
const technicalStrings = new Map([
	['src/db/schema.ts', new Set(['set null'])],
	['src/repositories/QuestRepository.ts', new Set(['no key update'])],
	['src/services/SummonService.ts', new Set(['Deity Pull'])], // Persisted audit action.
	['src/utils/errorWebhook.ts', new Set(['[REDACTED WEBHOOK]'])], // Redaction marker.
]);

function isSql(node) {
	for (let parent = node.parent; parent; parent = parent.parent) {
		if (ts.isTaggedTemplateExpression(parent) && parent.tag.getText() === 'sql') return true;
		if (ts.isCallExpression(parent) && parent.expression.getText() === 'sql.raw') return true;
	}
	return false;
}

function isTechnicalString(node, file, value) {
	if (technicalStrings.get(file)?.has(value) || isSql(node)) return true;
	if (file === 'src/render/ProfileCardRenderer.ts' && /^(?:bold |italic )?\d+px sans-serif$/.test(value)) return true;
	// Persisted audit details are not display copy; changing them can affect consumers.
	if (file === 'src/services/LootService.ts' && /^(Open |Rune bag )$/.test(value)) return true;
	if (file === 'src/services/ResetService.ts' && /^(reset | users)$/.test(value)) return true;
	return false;
}

/** Inspect parsed literals, including escaped Unicode and template parts; ignore comments and regexes. */
export function findTextViolations(source, file) {
	file = file.replaceAll('\\', '/');
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const violations = [];
	const report = (node, reason) => {
		const { line, character } = tree.getLineAndCharacterOfPosition(node.getStart());
		violations.push(`${file}:${line + 1}:${character + 1}: ${reason}`);
	};
	const inText = file.startsWith('src/text/');
	function visit(node) {
		if (inText && ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			const clause = node.importClause;
			const bindings = clause?.namedBindings;
			const typeOnly =
				clause?.isTypeOnly ||
				(!clause?.name &&
					bindings &&
					ts.isNamedImports(bindings) &&
					bindings.elements.every((entry) => entry.isTypeOnly));
			const target = posix.normalize(posix.join(posix.dirname(file), node.moduleSpecifier.text));
			if (!typeOnly && (!node.moduleSpecifier.text.startsWith('.') || !target.startsWith('src/text/'))) {
				report(node, 'Text modules must not depend on runtime code outside src/text.');
			}
		}
		if (
			ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node) ||
			ts.isTemplateHead(node) ||
			ts.isTemplateMiddle(node) ||
			ts.isTemplateTail(node)
		) {
			const value = node.text;
			if (file !== 'src/text/icons.ts' && emoji.test(value)) report(node, 'Move emoji to src/text/icons.ts.');
			if (!inText && !isTechnicalString(node, file, value)) {
				const parent = node.parent;
				const displayLiteral =
					ts.isCallExpression(parent) &&
					ts.isPropertyAccessExpression(parent.expression) &&
					displayMethods.has(parent.expression.name.text);
				if (vietnamese.test(value) || prose.test(value) || (displayLiteral && /\p{L}/u.test(value))) {
					report(node, 'Move display/diagnostic text to a named src/text module.');
				}
			}
		}
		if (
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.name.text === 'toLocaleString' &&
			file !== 'src/text/format.ts'
		) {
			report(node, 'Use formatNumber from src/text/format.ts.');
		}
		if (
			!inText &&
			ts.isCallExpression(node) &&
			ts.isPropertyAccessExpression(node.expression) &&
			node.expression.expression.getText(tree) === 'logger'
		) {
			const message = node.arguments.at(-1);
			if (
				message &&
				(ts.isStringLiteral(message) ||
					ts.isNoSubstitutionTemplateLiteral(message) ||
					ts.isTemplateExpression(message))
			) {
				report(message, 'Move log messages and stable log event names to src/text/diagnostics.ts.');
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return violations;
}

export function checkTextBoundaries(root) {
	const walk = (directory) =>
		readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
			const file = join(directory, entry.name);
			if (entry.isDirectory()) return walk(file);
			return entry.name.endsWith('.ts')
				? findTextViolations(readFileSync(file, 'utf8'), relative(root, file))
				: [];
		});
	return walk(join(root, 'src'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const violations = checkTextBoundaries(fileURLToPath(new URL('../', import.meta.url)));
	if (violations.length) {
		console.error(violations.join('\n'));
		process.exitCode = 1;
	} else {
		console.log('Text and emoji boundaries passed.');
	}
}
