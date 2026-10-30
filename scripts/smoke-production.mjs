import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const port = 4319;
const child = spawn(process.execPath, ['server.js', '--prod'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port), GEMINI_API_KEY: '', PLUGGY_CLIENT_ID: '', PLUGGY_CLIENT_SECRET: '' },
  stdio: 'pipe',
});
let output = '';
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 240; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1000) });
      assert.equal(response.status, 200);
      ready = true;
      break;
    } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  assert.ok(ready, `Health endpoint unavailable: ${output}`);
  const response = await fetch(`http://127.0.0.1:${port}/api/bank-sync/fetch`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 401, 'Bank sync must require authentication');
  const avatarResponse = await fetch(`http://127.0.0.1:${port}/api/couples/avatar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(avatarResponse.status, 401, 'Avatar writes must require authentication');
  console.log('Production smoke: health 200; unauthenticated bank sync and avatar writes 401.');
} finally {
  child.kill();
}
