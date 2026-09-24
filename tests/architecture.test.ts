import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../src/', import.meta.url));

function sources(directory = root): ts.SourceFile[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return sources(path);
		return entry.name.endsWith('.ts')
			? [ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true)]
			: [];
	});
}

function runtimeImports(source: ts.SourceFile): string[] {
	return source.statements.flatMap((node) => {
		if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) return [];
		const clause = node.importClause;
		if (clause?.isTypeOnly) return [];
		const bindings = clause?.namedBindings;
		if (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every((e) => e.isTypeOnly))
			return [];
		return [node.moduleSpecifier.text];
	});
}

const files = sources();
const pathOf = (file: ts.SourceFile) => relative(root, file.fileName).replaceAll('\\', '/');

describe('application dependency boundaries', () => {
	it('keeps SQL and runtime database imports in infrastructure or database entry points', () => {
		const violations = files.flatMap((file) => {
			const path = pathOf(file);
			if (/^(modules\/[^/]+\/infrastructure|db|seed|scripts)\//.test(path)) return [];
			return runtimeImports(file)
				.filter(
					(dependency) =>
						dependency.startsWith('drizzle-orm') || /\/db\/(client|schema)\.js$/.test(dependency),
				)
				.map((dependency) => `${path}: ${dependency}`);
		});
		expect(violations).toEqual([]);
	});

	it('keeps domain rules independent of infrastructure, Discord, and environment setup', () => {
		const violations = files
			.filter((file) => pathOf(file).includes('/domain/'))
			.flatMap((file) =>
				runtimeImports(file)
					.filter(
						(dependency) =>
							/\/(application|infrastructure|persistence|presentation|discord|db|app)\//.test(
								dependency,
							) ||
							/\/shared\/config\/env\.js$/.test(dependency) ||
							dependency === 'discord.js' ||
							dependency.startsWith('drizzle-orm'),
					)
					.map((dependency) => `${pathOf(file)}: ${dependency}`),
			);
		expect(violations).toEqual([]);
	});

	it('does not construct hidden application collaborators inside use cases or command methods', () => {
		const violations: string[] = [];
		for (const file of files.filter((source) => /^modules\/[^/]+\/(application|presentation)\//.test(pathOf(source)))) {
			const visit = (node: ts.Node): void => {
				if (ts.isMethodDeclaration(node) && node.body) {
					const inspect = (child: ts.Node): void => {
						if (
							ts.isNewExpression(child) &&
							ts.isIdentifier(child.expression) &&
							/(Service|Repository|Coordinator|Controller|Factory|BattleEngine)$/.test(
								child.expression.text,
							)
						) {
							const { line } = file.getLineAndCharacterOfPosition(child.getStart());
							violations.push(`${pathOf(file)}:${line + 1}: ${child.expression.text}`);
						}
						ts.forEachChild(child, inspect);
					};
					inspect(node.body);
				}
				ts.forEachChild(node, visit);
			};
			visit(file);
		}
		expect(violations).toEqual([]);
	});
});
