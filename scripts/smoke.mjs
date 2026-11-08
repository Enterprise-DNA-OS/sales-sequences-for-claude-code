#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, every command, the rules that matter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, commands } from './sequences.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sequences-test-'));
// Tests never touch a working database, even when the shell has credentials.
delete process.env.DATABASE_URL;
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
let testSchema;
if (process.env.TEST_DATABASE_URL) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error('TEST_DATABASE_URL must point to a disposable local test server');
  testSchema = 'sequences_test_' + process.pid + '_' + Date.now();
  url.searchParams.set('options', '-csearch_path=' + testSchema);
  process.env.DATABASE_URL = url.toString();
}

const db = await getDb();
if (testSchema) await db.exec('create schema ' + testSchema);
const seen = new Set();
const call = (c, o = {}, a = []) => { seen.add(c); return run(db, c, o, a); };
const rejects = async (c, o, a, re) => { seen.add(c); await assert.rejects(() => run(db, c, o, a), re); };
const count = async (t, where = '') => Number((await db.query(`select count(*) as n from ${t} ${where}`))[0].n);
const actor = { actor: 'Smoke test' };
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`ok  ${name}`); };

try {
  await check('migrate runs once, then is a no-op', async () => {
    assert.equal((await migrate(db)).ran.length, 1);
    assert.equal((await migrate(db)).ran.length, 0);
  });

  await check('seed is idempotent', async () => {
    const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
    await db.exec(seed); await db.exec(seed);
    assert.equal(await count('reps'), 3);
    assert.equal(await count('prospects'), 15);
    assert.equal(await count('enrolments'), 15);
    assert.equal(await count('touches'), 32);
  });

  await check('every read command returns rows or an empty list', async () => {
    for (const c of ['prospects', 'accounts', 'reps', 'sequences', 'steps', 'enrolments', 'tasks', 'replies', 'touches', 'meetings', 'rep-activity', 'mailboxes', 'collisions', 'quiet-accounts', 'opt-outs', 'attention', 'compliance', 'settings', 'activity', 'import-history', 'help']) {
      assert(Array.isArray(await call(c)), c);
    }
  });

  await check('working days: an opt-out on a Friday must stop by the next Friday', async () => {
    const [r] = await db.query("select add_working_days(date '2026-11-06', 5) as d, add_working_days(date '2026-11-09', 5) as m");
    assert.equal(String(r.d).slice(0, 10), '2026-11-13');
    assert.equal(String(r.m).slice(0, 10), '2026-11-16');
  });

  await check('the task queue holds opt-outs, missing consent, bounces and the Do Not Call Register', async () => {
    const q = await call('tasks');
    const hold = (code) => q.find((r) => r.enrolment === code)?.hold;
    assert.match(hold('ENR-005'), /opted out/);
    assert.match(hold('ENR-006'), /opted out/);
    assert.match(hold('ENR-007'), /no consent/);
    assert.match(hold('ENR-008'), /Do Not Call/);
    assert.match(hold('ENR-009'), /bounced/);
    assert.equal(hold('ENR-001'), null);
    assert.equal(Number(q.find((r) => r.enrolment === 'ENR-001').days_late), 2);
    assert(!q.find((r) => r.enrolment === 'ENR-003'), 'a sequence stopped by a reply is not in the queue');
  });

  await check('compliance: consent, unsubscribe, sender details and Do Not Call', async () => {
    const c = await call('compliance');
    const has = (rule, code, sev) => c.some((r) => r.rule === rule && r.code === code && r.severity === sev);
    assert(has('CONSENT', 'PRO-007', 'breach'));
    assert(has('CONSENT', 'PRO-009', 'check'), 'deemed consent on an Australian address is a check');
    assert(has('UNSUBSCRIBE', 'PRO-005', 'breach'));
    assert.equal(c.filter((r) => r.rule === 'UNSUBSCRIBE' && r.code === 'PRO-005').length, 2, 'still enrolled and emailed after the limit');
    assert(has('UNSUBSCRIBE', 'PRO-006', 'due'), 'an opt-out yesterday is inside the 5 working days');
    assert(has('SENDER-INFO', 'REP-02', 'breach'));
    assert(has('DO-NOT-CALL', 'PRO-008', 'breach'));
    assert(!c.some((r) => r.code === 'PRO-014'), 'an Australian number not on the register is fine to call');
  });

  await check('replies waiting: the one nobody answered, not the ones we did', async () => {
    const r = await call('replies');
    assert.deepEqual(r.map((x) => x.prospect_code), ['PRO-003']);
    assert.equal(Number(r[0].days_waiting), 3);
  });

  await check('meetings, collisions, quiet accounts and mailbox load', async () => {
    const m = await call('meetings');
    assert.equal(m.find((x) => x.code === 'MTG-001').issue, 'no-show with no follow-up');
    assert.match(m.find((x) => x.code === 'MTG-002').issue, /date passed/);
    assert.equal(m.find((x) => x.code === 'MTG-003').issue, 'held with no next step');
    assert.deepEqual((await call('collisions')).map((x) => x.code).sort(), ['ACC-003', 'ACC-005']);
    assert.deepEqual((await call('quiet-accounts')).map((x) => x.code).sort(), ['ACC-007', 'ACC-008']);
    const mb = await call('mailboxes');
    assert.equal(Number(mb.find((x) => x.code === 'REP-03').over_by), 1);
  });

  await check('sequence and step results', async () => {
    const s = await call('sequences');
    const seq2 = s.find((x) => x.code === 'SEQ-02');
    assert.equal(Number(seq2.enrolled), 4);
    assert.equal(Number(seq2.reply_pct), 50);
    const steps = await call('steps');
    assert.equal(Number(steps.find((x) => x.sequence_code === 'SEQ-01' && Number(x.step) === 1).sent), 6);
    const one = await call('sequence', {}, ['SEQ-02']);
    assert.equal(one.steps.length, 3);
  });

  await check('prospect history, partial names and ambiguity', async () => {
    const p = await call('prospect', {}, ['grace']);
    assert.equal(p.prospect.code, 'PRO-003');
    assert.equal(p.touches.length, 2);
    await rejects('prospect', {}, ['ol'], /Ambiguous prospects/);
  });

  await check('add records and steps', async () => {
    const r = await call('add', { ...actor, name: 'Tama Rewi', email: 'tama@harbouranalytics.example', sender_details: 'Tama Rewi, Harbour Analytics Ltd, Auckland. 09 555 0104' }, ['rep']);
    assert.equal(r.code, 'REP-004');
    const a = await call('add', { ...actor, name: 'Nelson Port Carriers', tier: 'a', owner: 'REP-004' }, ['account']);
    const p = await call('add', { ...actor, name: 'Isla Brown', email: 'isla@npc.example', account: a.code, owner: 'Tama', consent_basis: 'express', consent_note: 'Asked us to call' }, ['prospect']);
    assert.equal(p.stage, 'new');
    const s = await call('add', { ...actor, name: 'Port operators' }, ['sequence']);
    await rejects('enrol', { ...actor, sequence: s.code }, [p.code], /no steps/);
    await call('add-step', { ...actor, kind: 'email', subject: 'Hi {{first_name}}', body: 'Short note about {{account}}.' }, [s.code]);
    await call('add-step', { ...actor, kind: 'call', wait: '3', instructions: 'Call after the email' }, [s.code]);
    await rejects('add-step', { kind: 'email' }, [s.code], /--subject/);
    await rejects('enrol', actor, [p.code], /--sequence/);
  });

  await check('enrol, complete steps, finish, and the audit trail', async () => {
    const e = await call('enrol', { ...actor, sequence: 'Port operators' }, ['Isla']);
    assert.equal(e.status, 'active');
    assert.equal((await db.query("select stage from prospects where name = 'Isla Brown'"))[0].stage, 'working');
    await rejects('enrol', { ...actor, sequence: 'SEQ-01' }, ['Isla'], /already in/);
    const draft = await call('draft-step', {}, [e.code]);
    const text = fs.readFileSync(draft.file, 'utf8');
    assert.match(text, /Hi Isla/);
    assert.match(text, /Nelson Port Carriers/);
    assert.match(text, /Tama Rewi, Harbour Analytics/);
    assert.match(text, /unsubscribe/);
    const s1 = await call('complete-step', actor, [e.code]);
    assert.equal(s1.touch.outcome, 'sent');
    assert.equal(s1.enrolment.current_step, 2);
    await rejects('draft-step', {}, [e.code], /is a call/);
    const s2 = await call('complete-step', { ...actor, outcome: 'voicemail' }, ['Isla']);
    assert.equal(s2.enrolment.status, 'finished');
    assert(await count('audit', "where actor = 'Smoke test'") >= 8);
  });

  await check('enrol refuses opt-outs and account collisions unless forced', async () => {
    await rejects('enrol', { ...actor, sequence: 'SEQ-02' }, ['PRO-005'], /opted out/);
    const p = await call('add', { ...actor, name: 'Pete Lane', account: 'ACC-005', owner: 'REP-03', consent_basis: 'inferred', consent_note: 'Webinar', country: 'AU' }, ['prospect']);
    await rejects('enrol', { ...actor, sequence: 'SEQ-02' }, [p.code], /touched this account recently/);
    const e = await call('enrol', { ...actor, sequence: 'SEQ-02', force: true }, [p.code]);
    assert.equal(e.status, 'active');
    await call('pause', { ...actor, reason: 'agreed Josh works it' }, [p.code]);
    await call('resume', actor, [p.code]);
    const r = await call('remove', actor, [p.code]);
    assert.equal(r.status, 'removed');
  });

  await check('a reply stops the sequence and moves the stage', async () => {
    const out = await call('log', { ...actor, outcome: 'positive', note: 'Call me Thursday' }, ['PRO-001']);
    assert.equal(out.touch.direction, 'in');
    assert.equal(out.enrolment.status, 'replied');
    assert.equal(out.prospect.stage, 'replied');
    assert((await call('replies')).some((r) => r.prospect_code === 'PRO-001'));
    await call('log', { ...actor, kind: 'call', direction: 'out', outcome: 'connected', note: 'Booked Thursday' }, ['PRO-001']);
    assert(!(await call('replies')).some((r) => r.prospect_code === 'PRO-001'), 'answered once we called back');
    const reply = await call('draft-reply', {}, ['PRO-003']);
    assert.match(fs.readFileSync(reply.file, 'utf8'), /Would Tuesday or Wednesday/);
  });

  await check('opt-out stops every sequence and fills the register; email is refused after', async () => {
    const out = await call('opt-out', { ...actor, channel: 'phone: asked to be removed' }, ['PRO-005']);
    assert.deepEqual(out.sequences_stopped, ['ENR-005']);
    await call('log', { ...actor, outcome: 'unsubscribe' }, ['PRO-002']);
    assert.equal((await db.query("select status from enrolments where code = 'ENR-002'"))[0].status, 'opted_out');
    await rejects('log', { ...actor, kind: 'email', direction: 'out', outcome: 'sent' }, ['PRO-002'], /opted out/);
    const reg = await call('opt-outs');
    assert(reg.some((r) => r.code === 'PRO-002' && r.status === 'honoured'));
    assert(reg.some((r) => r.code === 'PRO-005' && r.status === 'emailed after the limit'), 'the earlier breach stays on the register');
    const liam = await call('opt-out', actor, ['PRO-006']);
    assert.equal(String(liam.opted_out_on).slice(0, 10), (await db.query("select (current_date - 1)::text as d"))[0].d, 'the original opt-out date is kept');
    const c = await call('compliance');
    assert(!c.some((r) => r.rule === 'UNSUBSCRIBE' && r.finding.includes('still in')), 'nobody opted out is still enrolled');
  });

  await check('consent and sender details clear their holds', async () => {
    await call('set', { ...actor, basis: 'express', note: 'Replied to our webinar invite asking for info' }, ['consent', 'PRO-007']);
    await call('set', { ...actor, details: 'Josh Bennett, Harbour Analytics Ltd, Level 2, 10 Quay St, Auckland. 09 555 0102' }, ['sender', 'REP-02']);
    const c = await call('compliance');
    assert(!c.some((r) => r.code === 'PRO-007' || r.code === 'REP-02'));
    const d = await call('draft-step', {}, ['ENR-007']);
    assert.match(fs.readFileSync(d.file, 'utf8'), /Josh Bennett, Harbour Analytics/);
    await call('set', actor, ['reply_wait_days', '2']);
    await rejects('set', actor, ['reply_wait_days', 'soon'], /whole number/);
    await call('set-stage', { ...actor, stage: 'disqualified' }, ['PRO-010']);
  });

  await check('meetings: book, no-show, held with a next step', async () => {
    const m = await call('book-meeting', { ...actor, on: '2030-01-15' }, ['PRO-003']);
    assert.equal(m.status, 'booked');
    assert.equal((await db.query("select stage from prospects where code = 'PRO-003'"))[0].stage, 'meeting');
    await call('meeting-outcome', { ...actor, status: 'held', outcome: 'Wants a trial', 'next-step': 'Send trial terms', due: '2030-01-17', opportunity: true }, [m.code]);
    assert.equal((await db.query("select stage from prospects where code = 'PRO-003'"))[0].stage, 'opportunity');
    await call('meeting-outcome', { ...actor, status: 'no_show' }, ['MTG-002']);
    await rejects('meeting-outcome', { status: 'maybe' }, ['MTG-002'], /--status/);
  });

  await check('weekly review has every part', async () => {
    const w = await call('weekly-review');
    for (const k of ['compliance', 'replies_waiting', 'overdue_tasks', 'meetings', 'sequences', 'reps', 'quiet_accounts']) assert(Array.isArray(w[k]), k);
  });

  await check('import from an Outreach export: dry run, then real, then a repeat is unchanged', async () => {
    const dir = path.join(REPO_ROOT, 'fixtures', 'outreach');
    const before = await count('prospects');
    const dry = await call('import', { ...actor, dir, 'dry-run': true }, ['outreach']);
    assert.equal(dry.added.prospects, 4);
    assert.equal(await count('prospects'), before, 'a dry run saves nothing');
    const real = await call('import', { ...actor, dir }, ['outreach']);
    assert.equal(real.added.accounts, 2);
    assert.equal(real.opted_out, 1);
    assert.equal(await count('prospects'), before + 4);
    const ryan = (await db.query("select * from prospects where name = 'Ryan Patel'"))[0];
    assert.equal(ryan.stage, 'opted_out');
    assert.equal(String(ryan.opted_out_on).slice(0, 10), '2026-10-02');
    assert.equal(ryan.country, 'AU');
    const mia = (await db.query("select p.*, a.name as account from prospects p join accounts a on a.id = p.account_id where p.name = 'Mia Thompson'"))[0];
    assert.equal(mia.stage, 'replied');
    assert.equal(mia.account, 'Sydney Express Couriers');
    assert.equal(mia.consent_basis, null, 'Outreach holds no consent basis: it is never invented');
    assert.equal(await count('touches', "where note = 'Last touch recorded in Outreach'"), 3);
    const again = await call('import', { ...actor, dir }, ['outreach']);
    assert.equal(again.unchanged.prospects, 4);
    assert.equal(await count('prospects'), before + 4);
    await rejects('import', { dir: temp }, ['outreach'], /No prospects.csv/);
  });

  await check('export writes every table', async () => {
    const out = await call('export', { dir: path.join(temp, 'export') });
    assert(out.tables.prospects > 15);
    assert(fs.existsSync(path.join(temp, 'export', 'touches.csv')));
  });

  await check('every command was exercised', async () => {
    const missing = commands.filter((c) => !seen.has(c));
    assert.deepEqual(missing, []);
  });

  await check('documents and views render from the demo data', async () => {
    await db.close();
    for (const script of ['docs.mjs', 'view.mjs']) {
      const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { env: process.env, encoding: 'utf8' });
      assert.equal(r.status, 0, `${script}: ${r.stderr}`);
    }
  });

  console.log(`\nPASS ${passed} checks, ${commands.length} CLI commands`);
} catch (e) {
  console.error(e);
  console.error('\nFAIL');
  process.exitCode = 1;
} finally {
  try { await db.close(); } catch {}
}
