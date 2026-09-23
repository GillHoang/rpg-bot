function skipWhitespace(text, offset) {
	while (offset < text.length && /\s/.test(text[offset])) offset++;
	return offset;
}

function closesLink(text, offset) {
	if (text[offset] === ')') return true;
	const tail = skipWhitespace(text, offset);
	if (tail === offset) return false;
	if (text[tail] === ')') return true;
	if (text[tail] !== '"') return false;
	const endTitle = text.indexOf('"', tail + 1);
	return endTitle !== -1 && text[skipWhitespace(text, endTitle + 1)] === ')';
}

function destination(text) {
	if (text[0] === '<') {
		const end = text.indexOf('>');
		return end > 1 && closesLink(text, end + 1) ? text.slice(1, end) : null;
	}
	let end = 0;
	while (end < text.length && text[end] !== ')' && !/\s/.test(text[end])) end++;
	return end > 0 && closesLink(text, end) ? text.slice(0, end) : null;
}

/** Inline links/images with bare or <angle> destinations and optional quoted titles.
 * Each disjoint segment is scanned a bounded number of times, including malformed input.
 */
export function inlineLinkDestinations(source) {
	const segments = source.split('](');
	const links = [];
	for (let index = 1; index < segments.length; index++) {
		if (segments[index - 1].lastIndexOf('[') === -1) continue;
		const link = destination(segments[index]);
		if (link !== null) links.push(link);
	}
	return links;
}
