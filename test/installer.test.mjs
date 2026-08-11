import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

for (const script of ['scripts/install.sh', 'scripts/install-release.sh', 'scripts/build-release.sh']) {
    test(`${script} has valid Bash syntax and usable help where applicable`, () => {
        const syntax = spawnSync('bash', ['-n', path.join(root, script)], { encoding: 'utf8' });
        assert.equal(syntax.status, 0, syntax.stderr);
        if (script.includes('install')) {
            const help = spawnSync(path.join(root, script), ['--help'], { encoding: 'utf8' });
            assert.equal(help.status, 0, help.stderr);
            assert.match(help.stdout, /--panel/);
        }
    });
}

test('release installer verifies identity before activating a Panel', () => {
    const source = read('scripts/install-release.sh');
    assert.match(source, /checksum must contain exactly one record/);
    assert.match(source, /checksum names a different archive/);
    assert.match(source, /composer\.lock/);
    assert.match(source, /tree-manifest\.mjs" check/);
    assert.match(source, /upstream-files\.json/);
    assert.match(source, /\.pterodactyl-locales\/release\.json/);
    assert.match(source, /another locale deployment holds the Panel lock/);
    assert.match(source, /archive_listing=\$\(tar --zstd -tf/);
    assert.match(source, /if ! post_code=\$\(http_code/);
    assert.doesNotMatch(source, /artisan["']?\s+migrate/);
});

test('source-tree manifest detects modified, missing, and extra Panel files', (context) => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ptero-tree-manifest.'));
    const panel = path.join(temporary, 'panel');
    const manifest = path.join(temporary, 'manifest.json');
    const tool = path.join(root, 'tools/tree-manifest.mjs');
    fs.mkdirSync(path.join(panel, 'config'), { recursive: true });
    fs.mkdirSync(path.join(panel, 'storage'), { recursive: true });
    fs.writeFileSync(path.join(panel, 'artisan'), 'fixture\n');
    fs.writeFileSync(path.join(panel, 'config/app.php'), 'original\n');
    fs.writeFileSync(path.join(panel, 'storage/runtime.log'), 'ignored\n');

    try {
        let result = spawnSync('node', [tool, 'write', panel, manifest], { encoding: 'utf8' });
        if (result.error?.code === 'EPERM') {
            context.skip('nested Node execution is blocked by this sandbox');
            return;
        }
        assert.equal(result.status, 0, result.stderr);

        fs.writeFileSync(path.join(panel, 'storage/runtime.log'), 'changed but ignored\n');
        result = spawnSync('node', [tool, 'check', panel, manifest], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);

        fs.writeFileSync(path.join(panel, 'config/app.php'), 'modified\n');
        result = spawnSync('node', [tool, 'check', panel, manifest], { encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /modified: config\/app\.php/);

        fs.writeFileSync(path.join(panel, 'config/app.php'), 'original\n');
        fs.writeFileSync(path.join(panel, 'extra.php'), 'unexpected\n');
        result = spawnSync('node', [tool, 'check', panel, manifest], { encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /unexpected: extra\.php/);

        fs.rmSync(path.join(panel, 'extra.php'));
        fs.rmSync(path.join(panel, 'config/app.php'));
        result = spawnSync('node', [tool, 'check', panel, manifest], { encoding: 'utf8' });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /missing: config\/app\.php/);
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
});

test('release installer retains and restores the complete previous tree', () => {
    const source = read('scripts/install-release.sh');
    assert.match(source, /restore_previous_panel/);
    assert.match(source, /mv -- "\$PANEL_DIR" "\$ROLLBACK_DIR"/);
    assert.match(source, /mv -- "\$ROLLBACK_DIR" "\$PANEL_DIR"/);
    assert.match(source, /trap on_error ERR/);
    assert.match(source, /No database migration is performed/);
});

test('one-command installer pins HTTPS downloads and delegates transactionally', () => {
    const source = read('scripts/install.sh');
    assert.match(source, /--proto '=https' --tlsv1\.2/);
    assert.match(source, /build-release\.sh/);
    assert.match(source, /install-release\.sh/);
    assert.match(source, /Panel directory does not exist/);
    assert.match(source, /Panel artisan or \.env is absent/);
    assert.ok(
        source.indexOf('Panel directory does not exist') < source.indexOf('Downloading the checksum-pinned'),
        'the live Panel target must be validated before a source download or build',
    );
    assert.doesNotMatch(source, /curl[^\n]*\|\s*(?:ba)?sh/);
    assert.doesNotMatch(source, /\beval\b/);
});
