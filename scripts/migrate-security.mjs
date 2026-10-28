// Offline, reviewable v1 migration. No network or production database access.
// Input: trusted administrator export { users: {uid: {...}}, couples: {id: {...}} }.
// Usage: node scripts/migrate-security.mjs backup.json reviewed.json [--write]
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [input, output, flag] = process.argv.slice(2);
assert.ok(input && output, 'Provide input backup JSON and a NEW output path; default is dry-run.');
const snapshot = JSON.parse(fs.readFileSync(input, 'utf8'));
assert.ok(snapshot.users && snapshot.couples, 'Expected users and couples maps.');
const result = structuredClone(snapshot);
const review = [];
let secretsRemoved = 0;
function scrub(value) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (['pluggyCredentials', 'clientSecret', 'apiKey', 'accessToken', 'connectToken'].includes(key)) {
      delete value[key];
      secretsRemoved++;
    } else scrub(value[key]);
  }
}
scrub(result);
for (const [id, couple] of Object.entries(result.couples)) {
  // Never infer privileged membership from the client-editable users.coupleId.
  const members = [couple.partner1Uid, couple.partner2Uid].filter(Boolean);
  if (!couple.partner1Uid || new Set(members).size !== members.length || members.some(uid => !result.users[uid])) {
    review.push({ coupleId: id, reason: 'Administrator must verify member identities from independent records.' });
  }
}
console.log(JSON.stringify({ migrationVersion: 1, dryRun: flag !== '--write', secretsRemoved, review }, null, 2));
if (flag === '--write') {
  assert.notEqual(input, output, 'Never overwrite backup.');
  fs.writeFileSync(output, JSON.stringify({ ...result, securityMigrationVersion: 1 }, null, 2), { flag: 'wx' });
  console.log('Sanitized export written; no database was changed. Review membership before any import.');
}
