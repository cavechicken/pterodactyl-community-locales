import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';
import { transformSync } from '@babel/core';

const require = createRequire(import.meta.url);
const plugin = require('../tools/babel-plugin-pterodactyl-i18n.cjs');
const panelRoot = '/tmp/pterodactyl-panel-fixture';

function transform(source, relative = 'resources/scripts/components/Test.tsx') {
    return transformSync(source, {
        filename: path.join(panelRoot, relative),
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: [[plugin, { panelRoot }]],
    }).code;
}

test('translates catalogued JSX while leaving runtime data untouched', () => {
    const output = transform(`
        const View = ({ serverName }) => <><h1>Settings</h1><span>{serverName}</span><button title="Save">Save</button></>;
    `);
    assert.match(output, /import __pteroI18n from "@\/i18n"/);
    assert.match(output, /frontend:settings/);
    assert.match(output, /frontend:save/);
    assert.match(output, /\{serverName\}/);
});

test('translates only explicitly allowed route properties', () => {
    const output = transform(
        `export default [{ path: '/settings', name: 'Settings', permission: 'settings' }];`,
        'resources/scripts/routers/routes.ts',
    );
    assert.match(output, /name: __pteroI18n\.t\("frontend:settings"/);
    assert.match(output, /permission: 'settings'|permission: "settings"/);
    assert.match(output, /path: '\/settings'|path: "\/settings"/);
});

test('does not translate strings hidden inside arbitrary JSX callbacks', () => {
    const output = transform(`const View = () => <span>{items.map(() => 'Save')}</span>;`);
    assert.doesNotMatch(output, /frontend:save/);
});

test('reuses an existing i18n import', () => {
    const output = transform(`import i18n from '@/i18n'; const View = () => <span>Save</span>;`);
    assert.equal((output.match(/from ['"]@\/i18n['"]/g) || []).length, 1);
    assert.match(output, /i18n\.t\("frontend:save"/);
    assert.doesNotMatch(output, /__pteroI18n\.t/);
});

test('translates visible JSX properties without changing operational attributes', () => {
    const output = transform(`const View = () => <Field name={'password'} className={'form-control'} label={'Password'} />;`);
    assert.match(output, /frontend:password/);
    assert.match(output, /name=(?:['"]password['"]|\{['"]password['"]\})/);
    assert.match(output, /className=(?:['"]form-control['"]|\{['"]form-control['"]\})/);
});

test('translates tooltip content attributes', () => {
    const output = transform(`const View = () => <Tooltip placement={'bottom'} content={'Search'} />;`);
    assert.match(output, /frontend:ui_search_/);
    assert.match(output, /placement=(?:['"]bottom['"]|\{['"]bottom['"]\})/);
});

test('translates conditional text in a JSX expression', () => {
    const output = transform(`const View = ({ editing }) => <button>{editing ? 'Save' : 'Create'}</button>;`);
    assert.match(output, /frontend:save/);
    assert.match(output, /frontend:create/);
});
