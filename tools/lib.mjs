import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

export const traverse = traverseModule.default || traverseModule;
export const packRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export function readJson(relative) {
    return JSON.parse(fs.readFileSync(path.join(packRoot, relative), 'utf8'));
}

export function walk(root, predicate) {
    const result = [];
    const pending = [root];
    while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (!['node_modules', 'public', 'storage', 'vendor'].includes(entry.name)) pending.push(absolute);
            } else if (predicate(absolute)) {
                result.push(absolute);
            }
        }
    }
    return result.sort();
}

export function normalizeText(value) {
    return value.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function looksLikeInterfaceText(value) {
    if (!/[A-Za-z]/.test(value)) return false;
    if (/^(?:https?:|\/|#|[A-Za-z0-9_.-]+\.(?:php|tsx?|jsx?|css|json|ya?ml))/.test(value)) return false;
    if (/^\.[A-Za-z0-9_/-]+$/.test(value)) return false;
    if (/^[A-Z0-9_.*:-]+$/.test(value) && !value.includes(' ')) return false;
    return true;
}

export function addCandidate(map, text, file, line, kind) {
    const normalized = normalizeText(text);
    if (!normalized || !looksLikeInterfaceText(normalized)) return;
    const occurrence = { file, line, kind };
    if (!map.has(normalized)) map.set(normalized, []);
    map.get(normalized).push(occurrence);
}

function objectPropertyName(candidatePath) {
    const parent = candidatePath.parentPath;
    if (!parent?.isObjectProperty() || parent.node.computed || parent.node.value !== candidatePath.node) return null;
    return parent.node.key.type === 'Identifier'
        ? parent.node.key.name
        : parent.node.key.type === 'StringLiteral'
            ? parent.node.key.value
            : null;
}

function isSafeJsxLiteral(candidatePath, translatedAttributes) {
    let cursor = candidatePath.parentPath;
    while (cursor) {
        if (cursor.isJSXExpressionContainer()) {
            const attribute = cursor.parentPath;
            if (!attribute?.isJSXAttribute()) return true;
            const name = attribute.get('name');
            return name.isJSXIdentifier() && translatedAttributes.has(name.node.name);
        }
        if (
            !cursor.isConditionalExpression() &&
            !cursor.isLogicalExpression() &&
            !cursor.isArrayExpression() &&
            !cursor.isTSAsExpression() &&
            !cursor.isTSNonNullExpression()
        ) return false;
        cursor = cursor.parentPath;
    }
    return false;
}

function translatedCallArgument(candidatePath, methods) {
    const call = candidatePath.parentPath;
    if (!call?.isCallExpression()) return null;
    const index = call.node.arguments.indexOf(candidatePath.node);
    const callee = call.get('callee');
    if (!callee.isMemberExpression() || callee.node.computed) return null;
    const property = callee.get('property');
    if (!property.isIdentifier()) return null;
    const positions = methods[property.node.name];
    return Array.isArray(positions) && positions.includes(index) ? property.node.name : null;
}

function templateSource(node) {
    return node.quasis.map((quasi, index) => {
        const suffix = index < node.expressions.length ? `{{value${index}}}` : '';
        return `${quasi.value.cooked ?? quasi.value.raw}${suffix}`;
    }).join('').replace(/\s+/g, ' ').trim();
}

export function extractFrontend(panelRoot) {
    const candidates = new Map();
    const contexts = readJson('catalog/frontend-contexts.json');
    const attributeNames = new Set(contexts.translatedJsxAttributes || []);
    const objectProperties = new Set(contexts.translatedObjectProperties || []);
    const callMethods = contexts.translatedCallMethods || {};
    const scriptRoot = path.join(panelRoot, 'resources/scripts');

    for (const filename of walk(scriptRoot, (file) => /\.tsx?$/.test(file))) {
        const relative = path.relative(panelRoot, filename).split(path.sep).join('/');
        const source = fs.readFileSync(filename, 'utf8');
        const ast = parse(source, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx', 'classProperties', 'dynamicImport', 'optionalChaining', 'nullishCoalescingOperator'],
        });

        traverse(ast, {
            JSXText(candidatePath) {
                addCandidate(candidates, candidatePath.node.value, relative, candidatePath.node.loc?.start.line, 'jsx-text');
            },
            JSXAttribute(candidatePath) {
                if (candidatePath.node.name.type !== 'JSXIdentifier') return;
                if (!attributeNames.has(candidatePath.node.name.name)) return;
                if (candidatePath.node.value?.type !== 'StringLiteral') return;
                addCandidate(
                    candidates,
                    candidatePath.node.value.value,
                    relative,
                    candidatePath.node.loc?.start.line,
                    `jsx-attribute:${candidatePath.node.name.name}`,
                );
            },
            ObjectProperty(candidatePath) {
                if (candidatePath.node.computed || candidatePath.node.value.type !== 'StringLiteral') return;
                const property = candidatePath.node.key.type === 'Identifier'
                    ? candidatePath.node.key.name
                    : candidatePath.node.key.type === 'StringLiteral'
                        ? candidatePath.node.key.value
                        : null;
                if (!property || (!objectProperties.has(property) && !(contexts.routeProperties[relative] || []).includes(property))) return;
                addCandidate(
                    candidates,
                    candidatePath.node.value.value,
                    relative,
                    candidatePath.node.loc?.start.line,
                    `property:${property}`,
                );
            },
            StringLiteral(candidatePath) {
                if (candidatePath.parentPath?.isJSXAttribute()) return;
                if (objectPropertyName(candidatePath)) return;
                const method = translatedCallArgument(candidatePath, callMethods);
                if (!isSafeJsxLiteral(candidatePath, attributeNames) && !method) return;
                addCandidate(
                    candidates,
                    candidatePath.node.value,
                    relative,
                    candidatePath.node.loc?.start.line,
                    method ? `call:${method}` : 'jsx-expression',
                );
            },
            TemplateLiteral(candidatePath) {
                if (!isSafeJsxLiteral(candidatePath, attributeNames)) return;
                addCandidate(
                    candidates,
                    templateSource(candidatePath.node),
                    relative,
                    candidatePath.node.loc?.start.line,
                    'jsx-template',
                );
            },
        });
    }
    return candidates;
}

export function extractAdmin(panelRoot) {
    const candidates = new Map();
    const dynamicBoundary = '__CAVETOWN_DYNAMIC_BOUNDARY__';
    const viewRoots = [
        path.join(panelRoot, 'resources/views/admin'),
        path.join(panelRoot, 'resources/views/partials/admin'),
    ];
    const viewFiles = viewRoots.flatMap((root) => fs.existsSync(root) ? walk(root, (file) => file.endsWith('.blade.php')) : []);
    viewFiles.push(path.join(panelRoot, 'resources/views/layouts/admin.blade.php'));
    const tagText = />([^<]*)</g;
    const translatedAttribute = /\b(?:aria-label|placeholder|title)=(['"])(.*?)\1/g;
    const buttonValue = /<input\b[^>]*\btype=(['"])(?:button|submit)\1[^>]*\bvalue=(['"])(.*?)\2/gi;
    const titleDirective = /@(section|yield)\(\s*['"](?:title|content-header)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;

    for (const filename of [...new Set(viewFiles)].sort()) {
        const relative = path.relative(panelRoot, filename).split(path.sep).join('/');
        const source = fs.readFileSync(filename, 'utf8')
            .replace(/{{--[\s\S]*?--}}/g, '')
            .replace(/<style\b[\s\S]*?<\/style>/gi, '')
            // Inline administration JavaScript needs an explicit source patch.
            // It is deliberately excluded from the HTML text extractor rather
            // than being mistaken for one enormous text node.
            .replace(/<script\b[\s\S]*?<\/script>/gi, '')
            .replace(/<\?php[\s\S]*?\?>/g, '')
            .replace(/@php[\s\S]*?@endphp/g, '')
            .replace(/{!![\s\S]*?!!}/g, dynamicBoundary)
            .replace(/{{[\s\S]*?}}/g, dynamicBoundary)
            .replace(/@[A-Za-z_][A-Za-z0-9_]*(?:\s*\([^\n]*\))?/g, dynamicBoundary);
        const lineAt = (offset) => source.slice(0, offset).split('\n').length;
        let match;

        while ((match = tagText.exec(source))) {
            const parts = match[1].split(dynamicBoundary);
            for (const part of parts) {
                addCandidate(candidates, part, relative, lineAt(match.index), 'blade-text');
            }
        }
        while ((match = translatedAttribute.exec(source))) {
            addCandidate(candidates, match[2], relative, lineAt(match.index), 'blade-attribute');
        }
        while ((match = buttonValue.exec(source))) {
            addCandidate(candidates, match[3], relative, lineAt(match.index), 'blade-button');
        }
        while ((match = titleDirective.exec(source))) {
            addCandidate(candidates, match[2], relative, lineAt(match.index), `blade-${match[1]}`);
        }
    }
    return candidates;
}

export function serializableCandidates(map) {
    return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
