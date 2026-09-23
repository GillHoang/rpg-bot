import { expect, it } from 'vitest';
import { inlineLinkDestinations } from '../scripts/markdown-link-destinations.mjs';

it('extracts file links, images, angle destinations and quoted titles', () => {
	expect(
		inlineLinkDestinations(
			'[guide](docs/guide.md#intro) ![image](image.png) [space](<docs/my guide.md> "Title") [web](https://example.com "Site")',
		),
	).toEqual(['docs/guide.md#intro', 'image.png', 'docs/my guide.md', 'https://example.com']);
});

it('rejects incomplete links without losing a following valid link', () => {
	expect(inlineLinkDestinations('[bad](file "unfinished\n[ok](README.md) [bad](<missing)')).toEqual(['README.md']);
});

it('handles large malformed bracket and destination runs without backtracking', () => {
	const malformed = '['.repeat(200_000) + '](' + 'x'.repeat(200_000) + '\n[ok](README.md)';
	expect(inlineLinkDestinations(malformed)).toEqual(['README.md']);
}, 1000);
