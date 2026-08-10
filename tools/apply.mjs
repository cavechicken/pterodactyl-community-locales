#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { localizeAdminViews } from './blade-localize.mjs';
import { writePhpCatalog } from './catalog-to-php.mjs';
import { packRoot, readJson } from './lib.mjs';

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

function mergeLocale(base, overrides, name) {
    const unknown = Object.keys(overrides).filter((key) => !(key in base));
    if (unknown.length > 0) fail(`${name} overrides contain unknown keys: ${unknown.join(', ')}`);
    return { ...base, ...overrides };
}

function cloneGermanNamespaces(panelRoot, locale) {
    const german = path.join(panelRoot, 'resources/lang/de');
    const target = path.join(panelRoot, `resources/lang/${locale}`);
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(german, target, { recursive: true });
}

const panelRoot = path.resolve(process.argv[2] || '');
if (!panelRoot || !fs.existsSync(path.join(panelRoot, 'artisan'))) {
    fail('usage: node tools/apply.mjs /path/to/staged-panel');
}
if (fs.existsSync(path.join(panelRoot, '.env'))) {
    fail('refusing to patch a tree containing .env; apply only to a clean protected staging copy');
}

const upstream = readJson('upstream.json');
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

copy('overrides/resources/scripts/i18n.ts', panelRoot, 'resources/scripts/i18n.ts');
copy('overrides/resources/scripts/components/server/users/PermissionTitleBox.tsx', panelRoot, 'resources/scripts/components/server/users/PermissionTitleBox.tsx');
copy('overrides/resources/scripts/components/server/users/PermissionRow.tsx', panelRoot, 'resources/scripts/components/server/users/PermissionRow.tsx');
copy('tools/babel-plugin-pterodactyl-i18n.cjs', panelRoot, '.pterodactyl-german/tools/babel-plugin-pterodactyl-i18n.cjs');
copy('catalog/frontend.en.json', panelRoot, '.pterodactyl-german/catalog/frontend.en.json');
copy('catalog/frontend.de.json', panelRoot, '.pterodactyl-german/catalog/frontend.de.json');
copy('catalog/frontend-contexts.json', panelRoot, '.pterodactyl-german/catalog/frontend-contexts.json');
copy('release.json', panelRoot, '.pterodactyl-german/release.json');

let babel = fs.readFileSync(babelFile, 'utf8');
babel = babel.replace(
    "module.exports = function (api) {",
    "const germanLocalization = require.resolve('./.pterodactyl-german/tools/babel-plugin-pterodactyl-i18n.cjs');\n\nmodule.exports = function (api) {",
);
babel = babel.replace(
    "const plugins = [",
    "const plugins = [[germanLocalization, { panelRoot: __dirname }],",
);
if (!babel.includes('germanLocalization')) fail('could not patch Babel configuration');
fs.writeFileSync(babelFile, babel);

const frontendEn = readJson('catalog/frontend.en.json');
const frontendDe = readJson('catalog/frontend.de.json');
const frontendSwg = mergeLocale(frontendDe, readJson('catalog/frontend.swg.overrides.json'), 'Swabian frontend');
const frontendBar = mergeLocale(frontendDe, readJson('catalog/frontend.bar.overrides.json'), 'Bavarian frontend');
const adminEn = readJson('catalog/admin.en.json');
const adminDe = readJson('catalog/admin.de.json');
const adminSwg = mergeLocale(adminDe, readJson('catalog/admin.swg.overrides.json'), 'Swabian admin');
const adminBar = mergeLocale(adminDe, readJson('catalog/admin.bar.overrides.json'), 'Bavarian admin');
writePhpCatalog(frontendEn, path.join(panelRoot, 'resources/lang/en/frontend.php'));
writePhpCatalog(frontendDe, path.join(panelRoot, 'resources/lang/de/frontend.php'));
writePhpCatalog(adminEn, path.join(panelRoot, 'resources/lang/en/admin.php'));
writePhpCatalog(adminDe, path.join(panelRoot, 'resources/lang/de/admin.php'));
cloneGermanNamespaces(panelRoot, 'swg');
cloneGermanNamespaces(panelRoot, 'bar');
writePhpCatalog(frontendSwg, path.join(panelRoot, 'resources/lang/swg/frontend.php'));
writePhpCatalog(frontendBar, path.join(panelRoot, 'resources/lang/bar/frontend.php'));
writePhpCatalog(adminSwg, path.join(panelRoot, 'resources/lang/swg/admin.php'));
writePhpCatalog(adminBar, path.join(panelRoot, 'resources/lang/bar/admin.php'));

copy('overrides/app/Traits/Helpers/AvailableLanguages.php', panelRoot, 'app/Traits/Helpers/AvailableLanguages.php');
copy('overrides/app/Http/Controllers/Base/LanguageController.php', panelRoot, 'app/Http/Controllers/Base/LanguageController.php');
copy('overrides/app/Http/Requests/Base/LocaleRequest.php', panelRoot, 'app/Http/Requests/Base/LocaleRequest.php');
copy('overrides/resources/views/partials/language-selector.blade.php', panelRoot, 'resources/views/partials/language-selector.blade.php');
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
console.log(`Applied English, German, Swabian, and Bavarian localization to staged Panel ${upstream.version}.`);
console.log(`Administration source replacements: ${adminReplacements}`);
