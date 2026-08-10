'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PACK_ROOT = path.resolve(__dirname, '..');

function readJson(file) {
    return JSON.parse(fs.readFileSync(path.join(PACK_ROOT, file), 'utf8'));
}

function normalizeFilename(filename, panelRoot) {
    return path.relative(panelRoot, filename).split(path.sep).join('/');
}

module.exports = function pterodactylLocalePlugin({ types: t }) {
    const english = readJson('catalog/frontend.en.json');
    const contexts = readJson('catalog/frontend-contexts.json');
    const sourceToKey = new Map();

    for (const [key, source] of Object.entries(english)) {
        // Permission labels intentionally reuse ordinary interface words such
        // as “Files” and “Delete”. Source transformation can safely use the
        // first equivalent key while runtime permission lookups retain their
        // more specific dynamic keys.
        if (!sourceToKey.has(source)) sourceToKey.set(source, key);
    }

    const translatedAttributes = new Set(contexts.translatedJsxAttributes || []);
    const translatedObjectProperties = new Set(contexts.translatedObjectProperties || []);
    const translatedCallMethods = contexts.translatedCallMethods || {};

    function translationCall(key, source, state, interpolation = []) {
        return t.callExpression(
            t.memberExpression(t.identifier(state.pterodactylI18nImport || '__pteroI18n'), t.identifier('t')),
            [
                t.stringLiteral(`frontend:${key}`),
                t.objectExpression([
                    t.objectProperty(t.identifier('defaultValue'), t.stringLiteral(source)),
                    ...interpolation.map((value, index) => t.objectProperty(t.identifier(`value${index}`), value)),
                ]),
            ],
        );
    }

    function ensureImport(programPath, state) {
        if (state.pterodactylI18nImport) return;

        for (const node of programPath.node.body) {
            if (!t.isImportDeclaration(node) || node.source.value !== '@/i18n') continue;
            const defaultSpecifier = node.specifiers.find((item) => t.isImportDefaultSpecifier(item));
            if (defaultSpecifier) {
                state.pterodactylI18nImport = defaultSpecifier.local.name;
                return;
            }
        }

        programPath.unshiftContainer(
            'body',
            t.importDeclaration(
                [t.importDefaultSpecifier(t.identifier('__pteroI18n'))],
                t.stringLiteral('@/i18n'),
            ),
        );
        state.pterodactylI18nImport = '__pteroI18n';
    }

    function markAndTranslate(pathToReplace, source, state) {
        const key = sourceToKey.get(source);
        if (!key) return false;
        ensureImport(pathToReplace.findParent((candidate) => candidate.isProgram()), state);
        pathToReplace.replaceWith(translationCall(key, source, state));
        state.pterodactylI18nChanged = true;
        return true;
    }

    function isAllowedRouteProperty(pathToLiteral, state) {
        const parent = pathToLiteral.parentPath;
        if (!parent || !parent.isObjectProperty() || parent.node.computed) return false;
        const key = parent.get('key');
        const propertyName = key.isIdentifier() ? key.node.name : key.isStringLiteral() ? key.node.value : null;
        if (!propertyName) return false;

        if (translatedObjectProperties.has(propertyName)) return true;

        const panelRoot = path.resolve(state.opts.panelRoot || process.cwd());
        const relative = normalizeFilename(state.file.opts.filename, panelRoot);
        return (contexts.routeProperties[relative] || []).includes(propertyName);
    }

    function translatedCallArgument(pathToLiteral) {
        const call = pathToLiteral.parentPath;
        if (!call || !call.isCallExpression()) return false;
        const index = call.node.arguments.indexOf(pathToLiteral.node);
        const callee = call.get('callee');
        if (!callee.isMemberExpression() || callee.node.computed) return false;
        const property = callee.get('property');
        if (!property.isIdentifier()) return false;
        const positions = translatedCallMethods[property.node.name];
        return Array.isArray(positions) && positions.includes(index);
    }

    function templateSource(node) {
        return node.quasis.map((quasi, index) => {
            const suffix = index < node.expressions.length ? `{{value${index}}}` : '';
            return `${quasi.value.cooked ?? quasi.value.raw}${suffix}`;
        }).join('').replace(/\s+/g, ' ').trim();
    }

    function isSafeJsxLiteral(pathToLiteral) {
        let cursor = pathToLiteral.parentPath;
        while (cursor) {
            if (cursor.isJSXExpressionContainer()) {
                const attribute = cursor.parentPath;
                if (!attribute || !attribute.isJSXAttribute()) return true;
                const name = attribute.get('name');
                return name.isJSXIdentifier() && translatedAttributes.has(name.node.name);
            }
            if (
                !cursor.isConditionalExpression() &&
                !cursor.isLogicalExpression() &&
                !cursor.isArrayExpression()
            ) {
                return false;
            }
            cursor = cursor.parentPath;
        }
        return false;
    }

    return {
        name: 'pterodactyl-source-i18n',
        visitor: {
            Program: {
                enter(_path, state) {
                    state.pterodactylI18nImport = null;
                    state.pterodactylI18nChanged = false;
                },
            },

            JSXText(pathToText, state) {
                const raw = pathToText.node.value;
                const source = raw.replace(/\s+/g, ' ').trim();
                if (!source || !sourceToKey.has(source)) return;

                ensureImport(pathToText.findParent((candidate) => candidate.isProgram()), state);
                const replacement = [];
                if (/^\s/.test(raw)) replacement.push(t.jsxText(' '));
                replacement.push(t.jsxExpressionContainer(translationCall(sourceToKey.get(source), source, state)));
                if (/\s$/.test(raw)) replacement.push(t.jsxText(' '));
                pathToText.replaceWithMultiple(replacement);
                state.pterodactylI18nChanged = true;
            },

            JSXAttribute(pathToAttribute, state) {
                const name = pathToAttribute.get('name');
                const value = pathToAttribute.get('value');
                if (!name.isJSXIdentifier() || !translatedAttributes.has(name.node.name)) return;
                if (!value.isStringLiteral()) return;

                const source = value.node.value.trim();
                const key = sourceToKey.get(source);
                if (!key) return;
                ensureImport(pathToAttribute.findParent((candidate) => candidate.isProgram()), state);
                value.replaceWith(t.jsxExpressionContainer(translationCall(key, source, state)));
                state.pterodactylI18nChanged = true;
            },

            StringLiteral(pathToLiteral, state) {
                const source = pathToLiteral.node.value.trim();
                if (!sourceToKey.has(source)) return;

                if (isSafeJsxLiteral(pathToLiteral)) {
                    markAndTranslate(pathToLiteral, source, state);
                    return;
                }

                if (isAllowedRouteProperty(pathToLiteral, state)) {
                    markAndTranslate(pathToLiteral, source, state);
                    return;
                }

                if (translatedCallArgument(pathToLiteral)) markAndTranslate(pathToLiteral, source, state);
            },

            TemplateLiteral(pathToTemplate, state) {
                if (!isSafeJsxLiteral(pathToTemplate)) return;
                const source = templateSource(pathToTemplate.node);
                const key = sourceToKey.get(source);
                if (!key) return;
                ensureImport(pathToTemplate.findParent((candidate) => candidate.isProgram()), state);
                pathToTemplate.replaceWith(translationCall(key, source, state, pathToTemplate.node.expressions));
                state.pterodactylI18nChanged = true;
            },
        },
    };
};
