import fs from 'node:fs';
import path from 'node:path';
import { normalizeText, readJson, walk } from './lib.mjs';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceIndex() {
    const english = readJson('catalog/admin.en.json');
    const bySource = new Map();
    for (const [key, source] of Object.entries(english)) {
        const normalized = normalizeText(source);
        if (bySource.has(normalized)) throw new Error(`Duplicate admin catalog source: ${normalized}`);
        bySource.set(normalized, key);
    }
    return bySource;
}

function maskBladeExpressions(source) {
    return source.replace(
        /{{--[\s\S]*?--}}|{!![\s\S]*?!!}|{{[\s\S]*?}}|<\?php[\s\S]*?\?>|@php[\s\S]*?@endphp/g,
        (value) => value.replace(/[<>]/g, ' '),
    );
}

function translateTextNodes(source, bySource) {
    // Blade member access (for example, `$server->id`) contains a literal `>`.
    // Running the HTML text-node expression directly over the unmasked source
    // therefore starts a match inside an attribute and skips the visible text
    // that follows it. Mask only angle brackets inside protected Blade/PHP
    // expressions, keeping every offset stable, and apply replacements from
    // the end of the file back to the beginning.
    const masked = maskBladeExpressions(source);
    const replacements = [];
    const matcher = />([^<]*)</g;
    let match;

    while ((match = matcher.exec(masked))) {
        const start = match.index + 1;
        const end = start + match[1].length;
        const value = source.slice(start, end);
        const parts = value.split(/({!![\s\S]*?!!}|{{[\s\S]*?}}|@[A-Za-z_][A-Za-z0-9_]*(?:\s*\([^\n]*\))?)/g);
        let count = 0;
        const translated = parts.map((part) => {
            if (!part || /^(?:{!!|{{|@)/.test(part.trimStart())) return part;
            const leading = part.match(/^\s*/)?.[0] || '';
            const trailing = part.match(/\s*$/)?.[0] || '';
            const content = part.slice(leading.length, part.length - trailing.length || undefined);
            const key = bySource.get(normalizeText(content));
            if (!key) return part;
            count += 1;
            return `${leading}{{ __('admin.${key}') }}${trailing}`;
        }).join('');

        if (count > 0) replacements.push({ start, end, translated, count });
    }

    let translatedSource = source;
    let count = 0;
    for (const replacement of replacements.reverse()) {
        translatedSource = `${translatedSource.slice(0, replacement.start)}${replacement.translated}${translatedSource.slice(replacement.end)}`;
        count += replacement.count;
    }
    return { source: translatedSource, count };
}

export function localizeAdminViews(panelRoot) {
    const bySource = sourceIndex();
    const roots = [
        path.join(panelRoot, 'resources/views/admin'),
        path.join(panelRoot, 'resources/views/partials/admin'),
    ];
    const files = roots.flatMap((root) => fs.existsSync(root) ? walk(root, (candidate) => candidate.endsWith('.blade.php')) : []);
    files.push(path.join(panelRoot, 'resources/views/layouts/admin.blade.php'));
    let replacements = 0;

    for (const file of [...new Set(files)].sort()) {
        const original = fs.readFileSync(file, 'utf8');
        let source = original;

        // Page titles and content headers are arguments, not rendered text nodes.
        source = source.replace(
            /@section\((['"])(title|content-header)\1\)(\s*)([^@<{][^@<]*?)(\s*)@endsection/g,
            (match, quote, slot, leading, value, trailing) => {
                const key = bySource.get(normalizeText(value));
                if (!key) return match;
                replacements += 1;
                return `@section(${quote}${slot}${quote})${leading}{{ __('admin.${key}') }}${trailing}@endsection`;
            },
        );

        source = source.replace(
            /@(section|yield)\((['"])(title|content-header)\2\s*,\s*(['"])([^'"]+)\4\)/g,
            (match, directive, quote, slot, valueQuote, value) => {
                const key = bySource.get(normalizeText(value));
                if (!key) return match;
                replacements += 1;
                return `@${directive}(${quote}${slot}${quote}, __('admin.${key}'))`;
            },
        );

        // Only static, exact text is replaced. Blade expressions and dynamic
        // values remain byte-for-byte intact while text around them is mapped.
        const textNodes = translateTextNodes(source, bySource);
        source = textNodes.source;
        replacements += textNodes.count;

        source = source.replace(
            /\b(aria-label|placeholder|title)=(['"])([^'"]+)\2/g,
            (match, attribute, quote, value) => {
                const key = bySource.get(normalizeText(value));
                if (!key) return match;
                replacements += 1;
                return `${attribute}=${quote}{{ __('admin.${key}') }}${quote}`;
            },
        );

        source = source.replace(
            /(<input\b[^>]*\btype=(['"])(?:button|submit)\2[^>]*\bvalue=)(['"])([^'"]+)(\3)/gi,
            (match, prefix, typeQuote, valueQuote, value, suffix) => {
                const key = bySource.get(normalizeText(value));
                if (!key) return match;
                replacements += 1;
                return `${prefix}${valueQuote}{{ __('admin.${key}') }}${suffix}`;
            },
        );

        if (source !== original) fs.writeFileSync(file, source);
    }
    return replacements;
}
