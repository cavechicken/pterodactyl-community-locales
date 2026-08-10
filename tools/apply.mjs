#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { localizeAdminViews } from './blade-localize.mjs';
import { writePhpCatalog } from './catalog-to-php.mjs';
import { packRoot, readJson } from './lib.mjs';
import { phpString, readLocaleManifest, resolveLocaleCatalogs } from './locales.mjs';

function fail(message) {
    console.error(`ERROR: ${message}`);
    process.exit(1);
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copy(relativeSource, root, relativeTarget = relativeSource) {
    const source = path.join(packRoot, relativeSource);
    const target = path.join(root, relativeTarget);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    fs.copyFileSync(source, target);
    fs.chmodSync(target, 0o644);
}

function copyRendered(relativeSource, root, relativeTarget, replacements) {
    const source = path.join(packRoot, relativeSource);
    const target = path.join(root, relativeTarget);
    let content = fs.readFileSync(source, 'utf8');
    for (const [marker, replacement] of Object.entries(replacements)) {
        if (content.includes(marker)) content = content.replaceAll(marker, replacement);
    }
    if (/__PTERO_I18N_[A-Z_]+__/.test(content)) fail(`unresolved template marker in ${relativeSource}`);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    fs.writeFileSync(target, content, { mode: 0o644 });
}

function patchFile(root, relative, expectedHash, replacements) {
    const target = path.join(root, relative);
    if (sha256(target) !== expectedHash) fail(`upstream source hash differs for ${relative}`);
    let source = fs.readFileSync(target, 'utf8');
    for (const [needle, replacement] of replacements) {
        if (!source.includes(needle)) fail(`could not locate pinned patch point in ${relative}: ${needle}`);
        source = source.replace(needle, replacement);
    }
    fs.writeFileSync(target, source);
}

function ensureLocaleNamespace(panelRoot, locale, baseLocale) {
    const target = path.join(panelRoot, `resources/lang/${locale}`);
    if (fs.existsSync(target)) return;
    if (!baseLocale) fail(`Panel has no namespace for ${locale} and locales.json defines no baseLocale`);
    const base = path.join(panelRoot, `resources/lang/${baseLocale}`);
    if (!fs.existsSync(base)) fail(`base namespace does not exist for ${locale}: ${baseLocale}`);
    fs.cpSync(base, target, { recursive: true });
}

const panelRoot = path.resolve(process.argv[2] || '');
if (!panelRoot || !fs.existsSync(path.join(panelRoot, 'artisan'))) {
    fail('usage: node tools/apply.mjs /path/to/staged-panel');
}
if (fs.existsSync(path.join(panelRoot, '.env'))) {
    fail('refusing to patch a tree containing .env; apply only to a clean protected staging copy');
}

const upstream = readJson('upstream.json');
const localeManifest = readLocaleManifest();
const localeCatalogs = resolveLocaleCatalogs(localeManifest);
const localeCodes = localeManifest.locales.map((locale) => locale.code);
const tsString = (value) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const localeType = localeCodes.map(tsString).join(' | ');
const localeNames = localeManifest.locales.map((locale) => (
    `        ${phpString(locale.code)} => ['english' => ${phpString(locale.englishName)}, 'native' => ${phpString(locale.nativeName)}],`
)).join('\n');
const selectorLanguages = localeManifest.locales.map((locale) => (
    `            ${phpString(locale.code)} => ['short' => ${phpString(locale.badge)}, ` +
    `'name' => ${phpString(locale.nativeName)}, 'description' => __('frontend.${locale.descriptionKey}')],`
)).join('\n');
const fallbackLines = localeManifest.locales.map((locale) => (
    `            ${locale.code}: [${locale.fallbacks.map(tsString).join(', ')}],`
));
fallbackLines.push(`            default: [${tsString(localeManifest.defaultLocale)}],`);
const templateValues = {
    __PTERO_I18N_DEFAULT_LOCALE__: tsString(localeManifest.defaultLocale),
    __PTERO_I18N_SUPPORTED_LOCALE_TYPE__: localeType,
    __PTERO_I18N_SUPPORTED_LOCALES__: `[${localeCodes.map(tsString).join(', ')}]`,
    __PTERO_I18N_FALLBACKS__: `{\n${fallbackLines.join('\n')}\n        }`,
    __PTERO_I18N_LOCALE_ALLOWLIST__: `[${localeCodes.map(phpString).join(', ')}]`,
    __PTERO_I18N_LANGUAGE_NAMES__: `[\n${localeNames}\n    ]`,
    __PTERO_I18N_LANGUAGE_SELECTOR__: `[\n${selectorLanguages}\n        ]`,
};
const config = fs.readFileSync(path.join(panelRoot, 'config/app.php'), 'utf8');
if (!config.includes(`'version' => '${upstream.version}'`)) fail(`expected Panel ${upstream.version}`);

const expectedBabelHash = '4c36460bc3d64135065bcee8e3dca99d6913381cb5a19fd915aca9b1a6e23eea';
const babelFile = path.join(panelRoot, 'babel.config.js');
if (sha256(babelFile) !== expectedBabelHash) fail('upstream Babel configuration hash differs from Panel 1.15.0');
const expectedI18nHash = '6897afb5a65f6be593c11bec24e0f43eeb755966d00e9af19d18a4b887b16de8';
const i18nFile = path.join(panelRoot, 'resources/scripts/i18n.ts');
if (sha256(i18nFile) !== expectedI18nHash) fail('upstream i18n source hash differs from Panel 1.15.0');
if (sha256(path.join(panelRoot, 'app/Traits/Helpers/AvailableLanguages.php')) !== '63e60b971311ba1a7e654432c1e65582781b6295ed8d8a633dee2bdd1df42428') {
    fail('upstream language helper hash differs from Panel 1.15.0');
}
if (sha256(path.join(panelRoot, 'app/Http/Requests/Base/LocaleRequest.php')) !== 'a3e1c705b469a280f6b4100856ed7f9ff2cdddef92e4df8024d70bba0de2c1fd') {
    fail('upstream locale request hash differs from Panel 1.15.0');
}

copyRendered('overrides/resources/scripts/i18n.ts', panelRoot, 'resources/scripts/i18n.ts', templateValues);
copy('overrides/resources/scripts/components/server/users/PermissionTitleBox.tsx', panelRoot, 'resources/scripts/components/server/users/PermissionTitleBox.tsx');
copy('overrides/resources/scripts/components/server/users/PermissionRow.tsx', panelRoot, 'resources/scripts/components/server/users/PermissionRow.tsx');
copy('tools/babel-plugin-pterodactyl-i18n.cjs', panelRoot, '.pterodactyl-locales/tools/babel-plugin-pterodactyl-i18n.cjs');
copy('locales.json', panelRoot, '.pterodactyl-locales/locales.json');
copy('catalog/frontend.en.json', panelRoot, '.pterodactyl-locales/catalog/frontend.en.json');
copy('catalog/frontend-contexts.json', panelRoot, '.pterodactyl-locales/catalog/frontend-contexts.json');

let babel = fs.readFileSync(babelFile, 'utf8');
babel = babel.replace(
    "module.exports = function (api) {",
    "const localeLocalization = require.resolve('./.pterodactyl-locales/tools/babel-plugin-pterodactyl-i18n.cjs');\n\nmodule.exports = function (api) {",
);
babel = babel.replace(
    "const plugins = [",
    "const plugins = [[localeLocalization, { panelRoot: __dirname }],",
);
if (!babel.includes('localeLocalization')) fail('could not patch Babel configuration');
fs.writeFileSync(babelFile, babel);

for (const locale of localeManifest.locales) {
    ensureLocaleNamespace(panelRoot, locale.code, locale.baseLocale);
    writePhpCatalog(localeCatalogs[locale.code].frontend, path.join(panelRoot, `resources/lang/${locale.code}/frontend.php`));
    writePhpCatalog(localeCatalogs[locale.code].admin, path.join(panelRoot, `resources/lang/${locale.code}/admin.php`));
}

copyRendered('overrides/app/Traits/Helpers/AvailableLanguages.php', panelRoot, 'app/Traits/Helpers/AvailableLanguages.php', templateValues);
copy('overrides/app/Http/Controllers/Base/LanguageController.php', panelRoot, 'app/Http/Controllers/Base/LanguageController.php');
copyRendered('overrides/app/Http/Requests/Base/LocaleRequest.php', panelRoot, 'app/Http/Requests/Base/LocaleRequest.php', templateValues);
copyRendered('overrides/resources/views/partials/language-selector.blade.php', panelRoot, 'resources/views/partials/language-selector.blade.php', templateValues);
copy('overrides/public/assets/ptero-i18n-locale.css', panelRoot, 'public/assets/ptero-i18n-locale.css');

patchFile(panelRoot, 'resources/scripts/components/server/users/EditSubuserModal.tsx', '3ec840e4ae0fa6525e79c864db9daa020b0001787f5ed5cb1c71ddae86dd2c09', [
    ["import ModalContext from '@/context/ModalContext';", "import ModalContext from '@/context/ModalContext';\nimport i18n from '@/i18n';"],
    [
        '<p css={tw`text-sm text-neutral-400 mb-4`}>{permissions[key].description}</p>',
        '<p css={tw`text-sm text-neutral-400 mb-4`}>\n' +
            '                                    {i18n.t(`frontend:permissionGroupDescription_${key}`, {\n' +
            '                                        defaultValue: permissions[key].description,\n' +
            '                                    })}\n' +
            '                                </p>',
    ],
]);

patchFile(panelRoot, 'routes/base.php', '8b253307bef97c90884f96eb1c14dc8e020b0568f8276ae8f71109434cd01c16', [[
    "Route::get('/locales/locale.json', Base\\LocaleController::class)",
    "Route::post('/account/language', Base\\LanguageController::class)->name('account.language');\n\nRoute::get('/locales/locale.json', Base\\LocaleController::class)",
]]);

patchFile(panelRoot, 'resources/views/templates/wrapper.blade.php', '855f4aebfee7b4853d4603916e5eb549dcd77cbaf1a63e6d3b4eaa04d8f8f692', [
    ['<link rel="shortcut icon" href="/favicons/favicon.ico">', '<link rel="shortcut icon" href="/favicons/favicon.ico">\n            <link rel="stylesheet" href="/assets/ptero-i18n-locale.css?v=1">'],
    [
        '                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};',
        '                    window.PterodactylUser = {!! json_encode(Auth::user()->toVueObject()) !!};\n' +
            '                    window.PterodactylLocale = {!! json_encode(__(\'frontend\'), JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) !!};',
    ],
    ["        @section('scripts')", "        @include('partials.language-selector')\n        @section('scripts')"],
]);

patchFile(panelRoot, 'resources/views/layouts/admin.blade.php', '2dcba41aeb6a54edc0e42048dcdda50bbf59289dfd50d17cfdd4f3a7b9e45d96', [
    ['<link rel="shortcut icon" href="/favicons/favicon.ico">', '<link rel="shortcut icon" href="/favicons/favicon.ico">\n        <link rel="stylesheet" href="/assets/ptero-i18n-locale.css?v=1">'],
    ['            <footer class="main-footer">', "            @include('partials.language-selector')\n            <footer class=\"main-footer\">"],
]);

for (const relative of ['resources/views/templates/wrapper.blade.php', 'resources/views/layouts/admin.blade.php']) {
    const target = path.join(panelRoot, relative);
    const source = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, source.replace('<html>', '<html lang="{{ str_replace(\'_\', \'-\', app()->getLocale()) }}">'));
}

const adminReplacements = localizeAdminViews(panelRoot);
const releaseMetadata = {
    ...readJson('release.json'),
    upstream: upstream.version,
    locales: localeCodes,
    frontendCatalogEntries: Object.keys(localeCatalogs[localeManifest.defaultLocale].frontend).length,
    adminCatalogEntries: Object.keys(localeCatalogs[localeManifest.defaultLocale].admin).length,
    adminSourceReplacements: adminReplacements,
};
const metadataTarget = path.join(panelRoot, '.pterodactyl-locales/release.json');
fs.writeFileSync(metadataTarget, `${JSON.stringify(releaseMetadata, null, 2)}\n`, { mode: 0o644 });
console.log(`Applied ${localeCodes.join(', ')} localization to staged Panel ${upstream.version}.`);
console.log(`Administration source replacements: ${adminReplacements}`);
