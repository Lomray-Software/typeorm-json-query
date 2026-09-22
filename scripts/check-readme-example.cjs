// Install a release in DOCS_FIXTURE_DIR before running this check.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fixture = process.env.DOCS_FIXTURE_DIR;
assert(fixture, 'Set DOCS_FIXTURE_DIR to the installed release fixture');
const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
const example = [...readme.matchAll(/```javascript\n([\s\S]*?)```/g)][0][1];
const result = spawnSync(process.execPath, ['-e', example], { cwd: fixture, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
assert.match(result.stdout, /id: 1, name: 'example'/);
console.log('README example against installed release PASS');
