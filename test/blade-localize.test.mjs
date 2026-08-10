import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { localizeAdminViews } from '../tools/blade-localize.mjs';

test('localizes text after Blade object access in tag attributes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pterodactyl-blade-localize-'));
    const partial = path.join(root, 'resources/views/admin/servers/partials/navigation.blade.php');
    const layout = path.join(root, 'resources/views/layouts/admin.blade.php');
    fs.mkdirSync(path.dirname(partial), { recursive: true });
    fs.mkdirSync(path.dirname(layout), { recursive: true });
    fs.writeFileSync(partial, '<a href="{{ route(\'admin.servers.view\', $server->id) }}">About</a>\n');
    fs.writeFileSync(layout, '<html><body></body></html>\n');

    assert.equal(localizeAdminViews(root), 1);
    assert.match(fs.readFileSync(partial, 'utf8'), /admin\.ui_about_4efca0d10c/);
});
