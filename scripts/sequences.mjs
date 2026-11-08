#!/usr/bin/env node
// Sales Sequences for Claude Code: one CLI over the team's prospecting database.
//   npm run seq -- <command> [args] [--json]
// Every read prints a table (or JSON with --json). Every write is audited. Nothing here sends.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table as textTable, heading } from './lib/format.mjs';

const STAGES = ['new', 'working', 'replied', 'meeting', 'opportunity', 'nurture', 'disqualified', 'opted_out'];
const OUTCOMES = ['sent', 'done', 'no_answer', 'voicemail', 'connected', 'bounced', 'replied', 'positive', 'not_now', 'not_interested', 'referral', 'out_of_office', 'unsubscribe'];
const REPLIES = ['replied', 'positive', 'not_now', 'not_interested', 'referral'];
const CHANNELS = ['email', 'call', 'linkedin', 'task', 'meeting'];

const reads = {
  prospects: "select code, name, title, account, country, owner, stage, consent_basis, in_sequence, touches_out, last_out_on, last_in_on from prospect_list order by array_position(array['replied','meeting','working','new','opportunity','nurture','disqualified','opted_out']::text[], stage), code",
  accounts: "select a.code, a.name, a.tier, a.country, a.industry, a.status, r.name as owner, (select count(*) from prospects p where p.account_id = a.id) as prospects, (select max(t.on_date) from touches t join prospects p on p.id = t.prospect_id where p.account_id = a.id) as last_touch_on from accounts a left join reps r on r.id = a.owner_rep_id order by a.tier, a.code",
  reps: 'select code, name, role, email, daily_email_limit, active, sender_details from reps order by code',
  sequences: 'select * from sequence_performance order by enrolled desc, code',
  steps: 'select * from step_performance order by sequence_code, step',
  enrolments: "select e.code, p.code as prospect_code, p.name as prospect, s.code as sequence, r.name as rep, e.enrolled_on, e.current_step, e.next_due_on, e.status, e.ended_on from enrolments e join prospects p on p.id = e.prospect_id join sequences s on s.id = e.sequence_id join reps r on r.id = e.rep_id order by array_position(array['active','paused','replied','meeting','finished','opted_out','bounced','removed']::text[], e.status), e.next_due_on nulls last, e.code",
  tasks: 'select enrolment, rep, prospect_code, prospect, account, sequence_code, step, kind, subject, due_on, days_late, hold from task_queue order by rep, hold nulls first, days_late desc, enrolment',
  replies: 'select * from replies_waiting order by days_waiting desc, touch',
  touches: "select t.code, t.on_date, p.code as prospect_code, p.name as prospect, r.name as rep, t.kind, t.direction, t.outcome, t.step_position as step, t.note from touches t join prospects p on p.id = t.prospect_id left join reps r on r.id = t.rep_id order by t.on_date desc, t.seq desc limit 200",
  meetings: "select code, prospect_code, prospect, account, rep, meeting_on, status, next_step, next_step_due, issue from meeting_follow_up order by issue nulls last, meeting_on desc",
  'rep-activity': 'select * from rep_activity order by code',
  mailboxes: 'select * from mailbox_load order by over_by desc',
  collisions: 'select * from account_collisions order by last_touch_on desc',
  'quiet-accounts': "select * from quiet_accounts order by tier, days_quiet desc nulls first",
  'opt-outs': 'select * from opt_out_register order by opted_out_on desc',
  attention: "select * from attention order by array_position(array['replies','holds','meetings','tasks','collisions','mailboxes','quiet accounts']::text[], area), days desc nulls last, code",
  compliance: "select * from compliance_checks order by array_position(array['breach','due','check']::text[], severity), rule, code",
  settings: 'select key, value, note from settings order by key',
  activity: 'select actor, kind, operation, record_id, created_at from audit order by created_at desc, id desc limit 100',
  'import-history': 'select source, kind, code, record_id, created_at from import_records order by created_at, kind, code',
};

// Writable record kinds: the fields `add` accepts and how references resolve.
const KINDS = {
  reps: { prefix: 'REP', label: 'name', fields: ['code', 'name', 'email', 'role', 'sender_details', 'daily_email_limit'], required: ['name', 'email'] },
  accounts: { prefix: 'ACC', label: 'name', fields: ['code', 'name', 'domain', 'industry', 'country', 'tier', 'owner', 'status'], required: ['name'] },
  prospects: { prefix: 'PRO', label: 'name', fields: ['code', 'account', 'name', 'title', 'email', 'phone', 'country', 'owner', 'stage', 'consent_basis', 'consent_note', 'on_do_not_call', 'call_consent', 'source'], required: ['name'] },
  sequences: { prefix: 'SEQ', label: 'name', fields: ['code', 'name', 'purpose', 'owner'], required: ['name'] },
  enrolments: { prefix: 'ENR', label: 'code' },
  meetings: { prefix: 'MTG', label: 'code' },
  touches: { prefix: 'TCH', label: 'code' },
};
const REFS = { account: ['accounts', 'account_id'], owner: ['reps', 'owner_rep_id'] };
const BOOLS = ['on_do_not_call', 'call_consent'];
const ALIASES = { rep: 'reps', reps: 'reps', account: 'accounts', accounts: 'accounts', prospect: 'prospects', prospects: 'prospects', sequence: 'sequences', sequences: 'sequences', enrolment: 'enrolments', enrolments: 'enrolments', meeting: 'meetings', meetings: 'meetings' };

export const commands = [...Object.keys(reads), 'prospect', 'sequence', 'weekly-review', 'add', 'add-step', 'enrol', 'complete-step', 'log', 'opt-out', 'pause', 'resume', 'remove', 'book-meeting', 'meeting-outcome', 'set-stage', 'set', 'import', 'export', 'draft-step', 'draft-reply', 'help'];

// ---------------------------------------------------------------- validation

function required(v, key) {
  if (v === undefined || v === null || String(v).trim() === '' || v === true) throw Error(`Required: --${key}`);
  return String(v).trim();
}
export function date(v, key = 'date') {
  const s = required(v, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw Error(`--${key} must be a real YYYY-MM-DD date`);
  return s;
}
function int(v, key, min, max) {
  const s = required(v, key);
  if (!/^-?\d+$/.test(s) || Number(s) < min || Number(s) > max) throw Error(`--${key} must be a whole number from ${min} to ${max}`);
  return Number(s);
}
function bool(v, key) {
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(s) || v === true) return true;
  if (['false', 'no', 'n', '0'].includes(s)) return false;
  throw Error(`--${key} must be yes or no`);
}
function oneOf(v, key, list) {
  const s = required(v, key).toLowerCase();
  if (!list.includes(s)) throw Error(`--${key} must be one of ${list.join(', ')}`);
  return s;
}
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- lookup

export async function resolve(db, kind, value) {
  const k = ALIASES[kind] || kind;
  if (!KINDS[k]) throw Error(`Unknown record kind: ${kind}`);
  const term = required(value, k);
  const exact = await db.query(`select * from ${k} where lower(code) = lower($1) or id::text = $1`, [term]);
  if (exact.length === 1) return exact[0];
  const label = KINDS[k].label;
  const extra = k === 'prospects' || k === 'reps' ? ' or lower(coalesce(email, \'\')) = lower($1)' : '';
  const rows = await db.query(`select * from ${k} where starts_with(id::text, lower($1)) or position(lower($1) in lower(${label})) > 0${extra} order by code`, [term]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw Error(`No ${k} match "${term}"`);
  throw Error(`Ambiguous ${k} "${term}": ${rows.map((r) => `${r.code} ${r[label]}`).join('; ')}`);
}

// An enrolment by its code, or the active enrolment of a prospect.
async function enrolmentOf(db, value) {
  const term = required(value, 'enrolment');
  const byCode = await db.query('select * from enrolments where lower(code) = lower($1)', [term]);
  if (byCode.length) return byCode[0];
  const p = await resolve(db, 'prospects', term);
  const rows = await db.query("select * from enrolments where prospect_id = $1 and status in ('active', 'paused')", [p.id]);
  if (!rows.length) throw Error(`${p.code} ${p.name} is not in a sequence`);
  return rows[0];
}

async function audit(db, actor, kind, recordId, operation, before, after) {
  await db.query('insert into audit (actor, kind, record_id, operation, before_record, after_record) values ($1, $2, $3, $4, $5, $6)',
    [actor, kind, recordId == null ? null : String(recordId), operation, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);
}
async function nextCode(db, kind) {
  const prefix = KINDS[kind].prefix;
  const rows = await db.query(`select code from ${kind} where code like $1`, [prefix + '-%']);
  const n = rows.reduce((m, r) => Math.max(m, Number(String(r.code).split('-').pop()) || 0), 0) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
function actorOf(o) { return String(o.actor && o.actor !== true ? o.actor : process.env.SEQ_ACTOR || 'operator'); }

async function tx(db, fn) {
  await db.exec('BEGIN');
  try { const out = await fn(); await db.exec('COMMIT'); return out; } catch (e) { await db.exec('ROLLBACK'); throw e; }
}

// ---------------------------------------------------------------- writes

export async function add(db, kindArg, o) {
  const kind = ALIASES[kindArg] || kindArg;
  const spec = KINDS[kind];
  if (!spec || !spec.fields) throw Error('add needs a kind: rep, account, prospect, sequence (use enrol, log and book-meeting for the rest)');
  for (const r of spec.required) required(o[r], r);
  const cols = [], vals = [];
  for (const f of spec.fields) {
    if (o[f] === undefined) continue;
    let v = o[f];
    if (REFS[f]) { cols.push(REFS[f][1]); vals.push((await resolve(db, REFS[f][0], v)).id); continue; }
    if (BOOLS.includes(f)) v = bool(v, f);
    else if (f === 'daily_email_limit') v = int(v, f, 1, 2000);
    else if (f === 'stage') v = oneOf(v, f, STAGES);
    else if (f === 'consent_basis') v = oneOf(v, f, ['express', 'inferred', 'deemed']);
    else if (f === 'country') v = String(v).toUpperCase() === 'AU' ? 'AU' : String(v).toUpperCase() === 'NZ' ? 'NZ' : 'other';
    else if (f === 'tier') v = oneOf(v, f, ['a', 'b', 'c']).toUpperCase();
    else v = String(v);
    cols.push(f); vals.push(v);
  }
  if (!cols.includes('code')) { cols.push('code'); vals.push(await nextCode(db, kind)); }
  return tx(db, async () => {
    const [row] = await db.query(`insert into ${kind} (${cols.join(', ')}) values (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, vals);
    await audit(db, actorOf(o), kind, row.id, 'add', null, row);
    return row;
  });
}

async function update(db, kind, row, patch, o, operation) {
  const keys = Object.keys(patch);
  const [after] = await db.query(`update ${kind} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning *`, [row.id, ...keys.map((k) => patch[k])]);
  await audit(db, actorOf(o), kind, row.id, operation, row, after);
  return after;
}

async function addStep(db, o, a) {
  const s = await resolve(db, 'sequences', a[0]);
  const kind = oneOf(o.kind, 'kind', ['email', 'call', 'linkedin', 'task']);
  if (kind === 'email') { required(o.subject, 'subject'); required(o.body, 'body'); } else required(o.instructions, 'instructions');
  const last = (await db.query('select coalesce(max(position), 0) as n from sequence_steps where sequence_id = $1', [s.id]))[0].n;
  const position = o.position ? int(o.position, 'position', 1, 50) : Number(last) + 1;
  return tx(db, async () => {
    const [row] = await db.query('insert into sequence_steps (sequence_id, position, kind, wait_days, subject, body, instructions) values ($1, $2, $3, $4, $5, $6, $7) returning *',
      [s.id, position, kind, o.wait ? int(o.wait, 'wait', 0, 90) : (position === 1 ? 0 : 2), o.subject || null, o.body || null, o.instructions || null]);
    await audit(db, actorOf(o), 'sequence_steps', row.id, `add step ${position} to ${s.code}`, null, row);
    return row;
  });
}

// Put a prospect into a sequence. Refuses an opt-out, a bounce on an email-first sequence,
// someone already in a sequence, and (unless --force) a prospect another rep touched recently.
export async function enrol(db, o, a) {
  const p = await resolve(db, 'prospects', a[0]);
  const s = await resolve(db, 'sequences', required(o.sequence, 'sequence'));
  if (!s.active) throw Error(`${s.code} is switched off`);
  if (p.opted_out_on) throw Error(`${p.code} ${p.name} opted out on ${p.opted_out_on}. They cannot be enrolled.`);
  if (['disqualified', 'opted_out'].includes(p.stage)) throw Error(`${p.code} is ${p.stage}`);
  const current = await db.query("select code from enrolments where prospect_id = $1 and status in ('active', 'paused')", [p.id]);
  if (current.length) throw Error(`${p.code} is already in ${current[0].code}. Remove or finish that first.`);
  const steps = await db.query('select * from sequence_steps where sequence_id = $1 order by position', [s.id]);
  if (!steps.length) throw Error(`${s.code} has no steps yet. Add them with add-step.`);
  if (steps[0].kind === 'email' && p.bounced) throw Error(`${p.code}'s email bounced. Fix the address first.`);
  const rep = o.rep ? await resolve(db, 'reps', o.rep) : p.owner_rep_id ? (await db.query('select * from reps where id = $1', [p.owner_rep_id]))[0] : null;
  if (!rep) throw Error('Required: --rep (the prospect has no owner)');
  if (!o.force && p.account_id) {
    const others = await db.query("select distinct r.name from touches t join prospects x on x.id = t.prospect_id join reps r on r.id = t.rep_id where x.account_id = $1 and t.rep_id <> $2 and t.direction = 'out' and t.on_date >= current_date - (select collision_days from setting_values)", [p.account_id, rep.id]);
    if (others.length) throw Error(`${others.map((r) => r.name).join(', ')} touched this account recently. Agree who works it, then rerun with --force.`);
  }
  const start = o.start ? date(o.start, 'start') : today();
  return tx(db, async () => {
    const [row] = await db.query('insert into enrolments (code, prospect_id, sequence_id, rep_id, enrolled_on, current_step, next_due_on) values ($1, $2, $3, $4, $5, 1, $6) returning *',
      [await nextCode(db, 'enrolments'), p.id, s.id, rep.id, start, addDays(start, steps[0].wait_days)]);
    await audit(db, actorOf(o), 'enrolments', row.id, `enrol ${p.code} in ${s.code}`, null, row);
    if (p.stage === 'new') await update(db, 'prospects', p, { stage: 'working', owner_rep_id: p.owner_rep_id || rep.id }, o, 'stage new -> working');
    return row;
  });
}

async function insertTouch(db, o, f) {
  const [row] = await db.query('insert into touches (code, prospect_id, enrolment_id, step_position, rep_id, kind, direction, on_date, outcome, note) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *',
    [await nextCode(db, 'touches'), f.prospect_id, f.enrolment_id || null, f.step_position || null, f.rep_id || null, f.kind, f.direction, f.on_date, f.outcome, f.note || null]);
  await audit(db, actorOf(o), 'touches', row.id, `log ${f.direction} ${f.kind} ${f.outcome}`, null, row);
  return row;
}

// Mark the current step done (the email was sent by hand, the call was made) and move on.
export async function completeStep(db, o, a) {
  const e = await enrolmentOf(db, a[0]);
  if (e.status !== 'active') throw Error(`${e.code} is ${e.status}`);
  const [step] = await db.query('select * from sequence_steps where sequence_id = $1 and position = $2', [e.sequence_id, e.current_step]);
  const [held] = await db.query('select hold from task_queue where enrolment = $1', [e.code]);
  if (held && held.hold) throw Error(`${e.code} is on hold: ${held.hold}`);
  const p = (await db.query('select * from prospects where id = $1', [e.prospect_id]))[0];
  if (step.kind === 'email' && !p.consent_basis) throw Error(`${p.code} has no consent basis recorded. Record it before emailing.`);
  const outcome = o.outcome ? oneOf(o.outcome, 'outcome', OUTCOMES) : step.kind === 'email' ? 'sent' : 'done';
  const on = o.date ? date(o.date, 'date') : today();
  return tx(db, async () => {
    const touch = await insertTouch(db, o, { prospect_id: e.prospect_id, enrolment_id: e.id, step_position: step.position, rep_id: e.rep_id, kind: step.kind, direction: 'out', on_date: on, outcome, note: o.note });
    const [next] = await db.query('select * from sequence_steps where sequence_id = $1 and position > $2 order by position limit 1', [e.sequence_id, step.position]);
    let after;
    if (outcome === 'bounced') {
      await update(db, 'prospects', p, { bounced: true }, o, 'email bounced');
      after = await update(db, 'enrolments', e, { status: 'bounced', ended_on: on, next_due_on: null }, o, `bounced at step ${step.position}`);
    } else if (next) {
      after = await update(db, 'enrolments', e, { current_step: next.position, next_due_on: addDays(on, next.wait_days) }, o, `step ${step.position} -> ${next.position}`);
    } else {
      after = await update(db, 'enrolments', e, { status: 'finished', ended_on: on, next_due_on: null }, o, 'finished, no reply');
    }
    return { touch, enrolment: after };
  });
}

// Log any touch. A reply stops the sequence. An unsubscribe opts the person out everywhere.
export async function logTouch(db, o, a) {
  const p = await resolve(db, 'prospects', a[0]);
  const kind = o.kind ? oneOf(o.kind, 'kind', CHANNELS) : 'email';
  const direction = o.direction ? oneOf(o.direction, 'direction', ['in', 'out']) : (REPLIES.includes(String(o.outcome)) || o.outcome === 'unsubscribe' || o.outcome === 'out_of_office' ? 'in' : 'out');
  const outcome = oneOf(o.outcome, 'outcome', OUTCOMES);
  const on = o.date ? date(o.date, 'date') : today();
  if (direction === 'out' && kind === 'email' && p.opted_out_on) throw Error(`${p.code} opted out on ${p.opted_out_on}. Do not email them.`);
  const rep = o.rep ? await resolve(db, 'reps', o.rep) : null;
  const [e] = await db.query("select * from enrolments where prospect_id = $1 and status in ('active', 'paused')", [p.id]);
  if (outcome === 'unsubscribe') return optOut(db, { ...o, date: on, channel: o.channel || `${kind} ${o.note || 'unsubscribe'}` }, [p.code]);
  return tx(db, async () => {
    const touch = await insertTouch(db, o, { prospect_id: p.id, enrolment_id: e?.id, step_position: e ? (direction === 'in' ? e.current_step - 1 || 1 : e.current_step) : null, rep_id: rep?.id || e?.rep_id || p.owner_rep_id, kind, direction, on_date: on, outcome, note: o.note });
    const out = { touch };
    if (direction === 'in' && REPLIES.includes(outcome)) {
      if (e) out.enrolment = await update(db, 'enrolments', e, { status: 'replied', ended_on: on, next_due_on: null }, o, `replied (${outcome}), sequence stopped`);
      if (['new', 'working', 'nurture'].includes(p.stage)) out.prospect = await update(db, 'prospects', p, { stage: outcome === 'not_interested' ? 'nurture' : 'replied' }, o, `stage ${p.stage} -> replied`);
    }
    if (outcome === 'bounced') {
      out.prospect = await update(db, 'prospects', p, { bounced: true }, o, 'email bounced');
      if (e) out.enrolment = await update(db, 'enrolments', e, { status: 'bounced', ended_on: on, next_due_on: null }, o, 'bounced');
    }
    return out;
  });
}

// Opt a person out: every sequence stops today and the date goes in the register.
export async function optOut(db, o, a) {
  const p = await resolve(db, 'prospects', a[0]);
  const on = o.date ? date(o.date, 'date') : today();
  return tx(db, async () => {
    if (o.log !== false) await insertTouch(db, o, { prospect_id: p.id, kind: 'email', direction: 'in', on_date: on, outcome: 'unsubscribe', note: o.note || null, rep_id: p.owner_rep_id });
    const prospect = await update(db, 'prospects', p, { opted_out_on: p.opted_out_on || on, opt_out_channel: String(o.channel && o.channel !== true ? o.channel : 'recorded by operator'), stage: 'opted_out' }, o, 'opted out');
    const stopped = [];
    for (const e of await db.query("select * from enrolments where prospect_id = $1 and status in ('active', 'paused')", [p.id])) {
      stopped.push((await update(db, 'enrolments', e, { status: 'opted_out', ended_on: on, next_due_on: null }, o, 'opted out, sequence stopped')).code);
    }
    return { prospect: prospect.code, opted_out_on: prospect.opted_out_on, sequences_stopped: stopped };
  });
}

async function setStatus(db, o, a, status) {
  const e = await enrolmentOf(db, a[0]);
  const allowed = { paused: ['active'], active: ['paused'], removed: ['active', 'paused'] }[status];
  if (!allowed.includes(e.status)) throw Error(`${e.code} is ${e.status}`);
  const patch = { status };
  if (status === 'removed') { patch.ended_on = today(); patch.next_due_on = null; }
  if (status === 'active' && (!e.next_due_on || e.next_due_on < today())) patch.next_due_on = today();
  return tx(db, () => update(db, 'enrolments', e, patch, o, `${e.status} -> ${status}${o.reason ? ': ' + o.reason : ''}`));
}

async function bookMeeting(db, o, a) {
  const p = await resolve(db, 'prospects', a[0]);
  const on = date(o.on, 'on');
  const rep = o.rep ? await resolve(db, 'reps', o.rep) : (await db.query('select * from reps where id = $1', [p.owner_rep_id]))[0];
  if (!rep) throw Error('Required: --rep');
  const [e] = await db.query("select * from enrolments where prospect_id = $1 and status in ('active', 'paused', 'replied') order by enrolled_on desc limit 1", [p.id]);
  return tx(db, async () => {
    const [m] = await db.query('insert into meetings (code, prospect_id, rep_id, sequence_id, booked_on, meeting_on) values ($1, $2, $3, $4, $5, $6) returning *',
      [await nextCode(db, 'meetings'), p.id, rep.id, e?.sequence_id || null, today(), on]);
    await audit(db, actorOf(o), 'meetings', m.id, 'book', null, m);
    if (e) await update(db, 'enrolments', e, { status: 'meeting', ended_on: e.ended_on || today(), next_due_on: null }, o, 'meeting booked, sequence stopped');
    await update(db, 'prospects', p, { stage: 'meeting' }, o, `stage ${p.stage} -> meeting`);
    return m;
  });
}

async function meetingOutcome(db, o, a) {
  const m = await resolve(db, 'meetings', a[0]);
  const status = oneOf(o.status, 'status', ['held', 'no_show', 'cancelled']);
  const patch = { status };
  if (o.outcome !== undefined) patch.outcome = String(o.outcome);
  if (o['next-step'] !== undefined) patch.next_step = String(o['next-step']);
  if (o.due !== undefined) patch.next_step_due = date(o.due, 'due');
  return tx(db, async () => {
    const after = await update(db, 'meetings', m, patch, o, `meeting ${m.status} -> ${status}`);
    if (status === 'held' && o.opportunity) {
      const p = (await db.query('select * from prospects where id = $1', [m.prospect_id]))[0];
      await update(db, 'prospects', p, { stage: 'opportunity' }, o, `stage ${p.stage} -> opportunity`);
    }
    return after;
  });
}

async function setStage(db, o, a) {
  const p = await resolve(db, 'prospects', a[0]);
  const stage = oneOf(o.stage, 'stage', STAGES);
  if (stage === 'opted_out') return optOut(db, o, a);
  return tx(db, () => update(db, 'prospects', p, { stage }, o, `stage ${p.stage} -> ${stage}`));
}

async function setValue(db, o, a) {
  if (a[0] === 'consent') {
    const p = await resolve(db, 'prospects', a[1]);
    const basis = oneOf(o.basis, 'basis', ['express', 'inferred', 'deemed']);
    return tx(db, () => update(db, 'prospects', p, { consent_basis: basis, consent_note: required(o.note, 'note') }, o, `consent ${basis}`));
  }
  if (a[0] === 'sender') {
    const r = await resolve(db, 'reps', a[1]);
    return tx(db, () => update(db, 'reps', r, { sender_details: required(o.details, 'details') }, o, 'sender details'));
  }
  const key = required(a[0], 'key'); const value = required(a[1], 'value');
  const [before] = await db.query('select * from settings where key = $1', [key]);
  if (!before) throw Error(`Unknown setting "${key}". Run: npm run seq -- settings`);
  if (key !== 'business_name' && !/^\d+$/.test(value)) throw Error(`${key} must be a whole number`);
  return tx(db, async () => {
    const [after] = await db.query('update settings set value = $2 where key = $1 returning *', [key, value]);
    await audit(db, actorOf(o), 'settings', key, 'set', before, after);
    return after;
  });
}

// ---------------------------------------------------------------- composite reads

async function prospect(db, a) {
  const p = await resolve(db, 'prospects', a[0]);
  return {
    prospect: (await db.query('select * from prospect_list where code = $1', [p.code]))[0],
    consent: [{ basis: p.consent_basis || 'none recorded', note: p.consent_note, opted_out_on: p.opted_out_on, on_do_not_call: p.on_do_not_call, call_consent: p.call_consent, bounced: p.bounced }],
    sequences: await db.query('select e.code, s.code as sequence, s.name, e.status, e.current_step, e.next_due_on, e.enrolled_on, e.ended_on from enrolments e join sequences s on s.id = e.sequence_id where e.prospect_id = $1 order by e.enrolled_on', [p.id]),
    touches: await db.query('select t.code, t.on_date, t.kind, t.direction, t.outcome, t.step_position as step, r.name as rep, t.note from touches t left join reps r on r.id = t.rep_id where t.prospect_id = $1 order by t.on_date, t.seq', [p.id]),
    meetings: await db.query('select code, meeting_on, status, outcome, next_step, next_step_due from meetings where prospect_id = $1 order by meeting_on', [p.id]),
  };
}

async function sequence(db, a) {
  const s = await resolve(db, 'sequences', a[0]);
  return {
    sequence: (await db.query('select * from sequence_performance where code = $1', [s.code]))[0],
    steps: await db.query('select step, kind, what, sent, replies, positive, opt_outs from step_performance where sequence_code = $1 order by step', [s.code]),
    people: await db.query("select e.code, p.code as prospect_code, p.name, e.status, e.current_step, e.next_due_on from enrolments e join prospects p on p.id = e.prospect_id where e.sequence_id = $1 order by e.status, e.code", [s.id]),
  };
}

async function weeklyReview(db) {
  return {
    compliance: await db.query(reads.compliance),
    replies_waiting: await db.query(reads.replies),
    overdue_tasks: await db.query("select rep, count(*) as overdue, max(days_late) as oldest_days from task_queue where days_late > 0 and hold is null group by rep order by rep"),
    meetings: await db.query("select code, prospect, rep, meeting_on, status, issue from meeting_follow_up where issue is not null or meeting_on >= current_date - 6 order by meeting_on"),
    sequences: await db.query('select code, name, enrolled, in_progress, reply_pct, meeting_pct, opted_out from sequence_performance order by meeting_pct desc nulls last'),
    reps: await db.query(reads['rep-activity']),
    quiet_accounts: await db.query(reads['quiet-accounts']),
  };
}

// ---------------------------------------------------------------- import / export

// Outreach exports prospects as CSV with "all prospect fields". Column names vary by instance and
// custom fields, so each field accepts the common headers. Accounts and users are optional files.
export const IMPORT_COLUMNS = {
  prospects: {
    id: ['Prospect ID', 'ID', 'Id'], first: ['First Name', 'First name', 'firstName'], last: ['Last Name', 'Last name', 'lastName'], name: ['Name', 'Full Name'],
    email: ['Email', 'Emails', 'Email Address', 'Primary Email', 'Work Email'], title: ['Title', 'Job Title'], company: ['Company', 'Account', 'Account Name', 'Company Name'],
    phone: ['Work Phone', 'Mobile Phone', 'Phone', 'Phones', 'Mobile Phones', 'Work Phones'], owner: ['Owner', 'Owner Name', 'Owner Email'], stage: ['Stage', 'Stage Name'],
    opted_out: ['Opted Out', 'Unsubscribed', 'Opted Out At', 'Email Opted Out'], opted_out_at: ['Opted Out At', 'Unsubscribed At'], country: ['Country', 'Address Country'],
    last_touched: ['Last Touched At', 'Last Touched', 'Most Recent Touch', 'Last Contacted', 'Engaged At', 'Last Engaged At'], tags: ['Tags'], source: ['Source'],
  },
  accounts: { id: ['Account ID', 'ID', 'Id'], name: ['Name', 'Account Name', 'Company'], domain: ['Domain', 'Website', 'Website URL'], industry: ['Industry'], owner: ['Owner', 'Owner Name', 'Owner Email'], country: ['Country', 'Locality'] },
};

const STAGE_MAP = { 'cold': 'new', 'new': 'new', 'approaching': 'working', 'working': 'working', 'engaged': 'working', 'replied': 'replied', 'interested': 'replied', 'meeting': 'meeting', 'meeting booked': 'meeting', 'opportunity': 'opportunity', 'qualified': 'opportunity', 'nurture': 'nurture', 'not now': 'nurture', 'unresponsive': 'nurture', 'bad contact': 'disqualified', 'not interested': 'disqualified', 'disqualified': 'disqualified' };

function col(row, kind, field) { return pick(row, ...IMPORT_COLUMNS[kind][field]).trim(); }
function normDate(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  throw Error(`Unreadable date "${s}" (use YYYY-MM-DD or DD/MM/YYYY)`);
}
function country(v) { const s = String(v || '').trim().toLowerCase(); return ['au', 'australia'].includes(s) ? 'AU' : ['nz', 'new zealand', 'aotearoa'].includes(s) || !s ? 'NZ' : 'other'; }
const canon = (v) => JSON.stringify(Object.keys(v).sort().map((k) => [k, v[k]]));

async function repFor(db, o, owner, summary) {
  if (!owner) return null;
  const found = await db.query('select id from reps where lower(name) = lower($1) or lower(email) = lower($1)', [owner]);
  if (found.length) return found[0].id;
  const email = owner.includes('@') ? owner : `${owner.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@unknown.example`;
  const [r] = await db.query('insert into reps (code, name, email) values ($1, $2, $3) returning id', [await nextCode(db, 'reps'), owner.includes('@') ? owner.split('@')[0] : owner, email]);
  await audit(db, actorOf(o), 'reps', r.id, 'add from import', null, { owner });
  summary.reps_added = (summary.reps_added || 0) + 1;
  return r.id;
}

export async function importOutreach(db, o) {
  const dir = path.resolve(required(o.dir, 'dir'));
  const source = o.source ? String(o.source) : 'outreach';
  const files = ['accounts', 'prospects'].filter((k) => fs.existsSync(path.join(dir, `${k}.csv`)));
  if (!files.includes('prospects')) throw Error(`No prospects.csv in ${dir}. Export prospects from Outreach and save the file as prospects.csv.`);
  const summary = { source, dry_run: !!o['dry-run'], files, added: {}, unchanged: {}, opted_out: 0, without_consent: 0 };
  await db.exec('BEGIN');
  try {
    for (const kind of files) {
      const rows = parseCsv(fs.readFileSync(path.join(dir, `${kind}.csv`), 'utf8'));
      summary.added[kind] = 0; summary.unchanged[kind] = 0;
      for (const [i, raw] of rows.entries()) {
        const where = `${kind}.csv row ${i + 2}`;
        const sourceId = col(raw, kind, 'id') || (kind === 'prospects' ? col(raw, kind, 'email') : col(raw, kind, 'name'));
        if (!sourceId) throw Error(`${where}: no ID, email or name column`);
        const prior = (await db.query('select original from import_records where source = $1 and kind = $2 and code = $3', [source, kind, sourceId]))[0];
        if (prior) {
          if (canon(prior.original) === canon(raw)) { summary.unchanged[kind]++; continue; }
          throw Error(`${where}: ${sourceId} was imported before with different values. Nothing was saved. Update it with a command instead.`);
        }
        let rec;
        if (kind === 'accounts') {
          const name = required(col(raw, kind, 'name'), where + ' name');
          [rec] = await db.query('insert into accounts (code, name, domain, industry, country, owner_rep_id, status) values ($1, $2, $3, $4, $5, $6, $7) returning id',
            [await nextCode(db, 'accounts'), name, col(raw, kind, 'domain') || null, col(raw, kind, 'industry') || null, country(col(raw, kind, 'country')), await repFor(db, o, col(raw, kind, 'owner'), summary), 'working']);
        } else {
          const name = col(raw, kind, 'name') || [col(raw, kind, 'first'), col(raw, kind, 'last')].filter(Boolean).join(' ');
          required(name, where + ' name');
          const company = col(raw, kind, 'company');
          let accountId = null;
          if (company) {
            const acc = await db.query('select id from accounts where lower(name) = lower($1)', [company]);
            if (acc.length) accountId = acc[0].id;
            else {
              [{ id: accountId }] = await db.query("insert into accounts (code, name, country, status) values ($1, $2, $3, 'working') returning id", [await nextCode(db, 'accounts'), company, country(col(raw, kind, 'country'))]);
              summary.added.accounts = (summary.added.accounts || 0) + 1;
            }
          }
          const optRaw = col(raw, kind, 'opted_out');
          const optedAt = normDate(col(raw, kind, 'opted_out_at')) || (/^(true|yes|y|1)$/i.test(optRaw) ? today() : (/^\d{4}-|\//.test(optRaw) ? normDate(optRaw) : null));
          const stage = optedAt ? 'opted_out' : STAGE_MAP[col(raw, kind, 'stage').toLowerCase()] || 'new';
          const email = col(raw, kind, 'email').split(/[;,\s]+/)[0] || null;
          [rec] = await db.query('insert into prospects (code, account_id, name, title, email, phone, country, owner_rep_id, stage, opted_out_on, opt_out_channel, source) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id',
            [await nextCode(db, 'prospects'), accountId, name, col(raw, kind, 'title') || null, email, col(raw, kind, 'phone').split(/[;,]/)[0].trim() || null, country(col(raw, kind, 'country')),
              await repFor(db, o, col(raw, kind, 'owner'), summary), stage, optedAt, optedAt ? 'opted out in Outreach' : null, col(raw, kind, 'source') || `Outreach import${col(raw, kind, 'tags') ? ' (' + col(raw, kind, 'tags') + ')' : ''}`]);
          if (optedAt) summary.opted_out++;
          summary.without_consent++;
          const last = normDate(col(raw, kind, 'last_touched'));
          if (last) await db.query("insert into touches (code, prospect_id, kind, direction, on_date, outcome, note) values ($1, $2, 'task', 'out', $3, 'done', 'Last touch recorded in Outreach')", [await nextCode(db, 'touches'), rec.id, last]);
        }
        await db.query('insert into import_records (source, kind, code, record_id, original) values ($1, $2, $3, $4, $5)', [source, kind, sourceId, rec.id, JSON.stringify(raw)]);
        await audit(db, actorOf(o), kind, rec.id, 'import ' + source, null, raw);
        summary.added[kind]++;
      }
    }
    await db.exec(o['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  summary.next = 'Outreach does not record why you may email someone. Record a consent basis for each imported prospect (set consent) before any email step, or the compliance check will hold them.';
  return summary;
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export async function exportAll(db, o) {
  const dir = path.resolve(o.dir && o.dir !== true ? String(o.dir) : path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'exports'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const out = {};
  for (const t of ['reps', 'accounts', 'prospects', 'sequences', 'sequence_steps', 'enrolments', 'touches', 'meetings', 'settings']) {
    const rows = await db.query(`select * from ${t}`);
    const cols = rows.length ? Object.keys(rows[0]) : [];
    fs.writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n', { mode: 0o600 });
    out[t] = rows.length;
  }
  return { dir, tables: out };
}

// ---------------------------------------------------------------- drafts (never sent)

function writeDraft(name, text) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${today()}-${name}.md`);
  fs.writeFileSync(file, text, { mode: 0o600 });
  return file;
}
const firstName = (n) => String(n || '').split(' ')[0];
function merge(text, vars) { return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? `{{${k}}}`)); }

async function draftStep(db, o, a) {
  const e = await enrolmentOf(db, a[0]);
  const [q] = await db.query('select * from task_queue where enrolment = $1', [e.code]);
  const [step] = await db.query('select * from sequence_steps where sequence_id = $1 and position = $2', [e.sequence_id, e.current_step]);
  if (e.status !== 'active') throw Error(`${e.code} is ${e.status}`);
  if (step.kind !== 'email') throw Error(`Step ${step.position} of this sequence is a ${step.kind}: ${step.instructions || ''}`);
  if (q && q.hold) throw Error(`${e.code} is on hold: ${q.hold}`);
  const [ctx] = await db.query('select p.name, p.email, p.consent_basis, a.name as account, a.industry, r.name as rep, r.sender_details from prospects p left join accounts a on a.id = p.account_id join reps r on r.id = $2 where p.id = $1', [e.prospect_id, e.rep_id]);
  if (!ctx.consent_basis) throw Error('No consent basis recorded. Record it before emailing.');
  if (!ctx.sender_details) throw Error(`${ctx.rep} has no sender details on file. Every message must say who sent it and how to reach them (set sender).`);
  const vars = { first_name: firstName(ctx.name), account: ctx.account || 'your team', industry: (ctx.industry || 'your industry').toLowerCase(), rep: ctx.rep };
  const text = `To: ${ctx.email || '(no email on file)'}
Subject: ${merge(step.subject, vars)}

${merge(step.body, vars)}

${firstName(ctx.rep)}

--
${ctx.sender_details}
If you would rather not hear from us, reply "unsubscribe" and we will stop.
`;
  return { file: writeDraft(`${e.code}-step-${step.position}`, text), enrolment: e.code, step: step.position };
}

async function draftReply(db, o, a) {
  const p = await resolve(db, 'prospects', a[0]);
  const [last] = await db.query("select * from touches where prospect_id = $1 and direction = 'in' order by on_date desc, seq desc limit 1", [p.id]);
  if (!last) throw Error(`${p.code} has not replied`);
  if (p.opted_out_on) throw Error(`${p.code} opted out on ${p.opted_out_on}. No reply beyond confirming removal.`);
  const [ctx] = await db.query('select a.name as account, r.name as rep, r.sender_details from prospects p left join accounts a on a.id = p.account_id left join reps r on r.id = p.owner_rep_id where p.id = $1', [p.id]);
  const asks = {
    positive: 'Thanks for coming back to me. [Answer what they asked for here.] Would Tuesday or Wednesday next week suit for 20 minutes?',
    replied: 'Thanks for the reply. [Answer their question here.]',
    not_now: 'Understood, thanks for letting me know. I will check back when you suggested.',
    referral: 'Thanks for pointing me to the right person. I will reach out and mention you sent me.',
    not_interested: 'Thanks for the straight answer. I will not follow up.',
    out_of_office: 'Noted. I will hold until you are back.',
  };
  const text = `To: ${p.email || '(no email on file)'}
Subject: Re: ${ctx.account || p.name}

Hi ${firstName(p.name)},

${asks[last.outcome] || asks.replied}

${firstName(ctx.rep)}

--
${ctx.sender_details || '(add your sender details before sending)'}

<!-- Their message (${last.on_date}): ${last.note || last.outcome} -->
`;
  return { file: writeDraft(`reply-${p.code}`, text), prospect: p.code, replying_to: last.code };
}

// ---------------------------------------------------------------- dispatch

const HELP = [
  ['tasks', "today's queue rep by rep, with anything on hold and why"],
  ['replies | attention | compliance | weekly-review', 'what needs a person now'],
  ['prospects | prospect <name> | accounts | reps', 'the people and companies you are working'],
  ['sequences | sequence <code> | steps | enrolments', 'sequences, step by step results and who is in them'],
  ['touches | meetings | rep-activity | mailboxes | collisions | quiet-accounts | opt-outs', 'activity, meetings, load, overlap, gaps and the opt-out register'],
  ['add <rep|account|prospect|sequence> --field=value', 'add a record'],
  ['add-step <sequence> --kind=email|call|linkedin|task [--wait=2] --subject= --body= | --instructions=', 'add a step'],
  ['enrol <prospect> --sequence= [--rep= --start= --force]', 'put someone in a sequence (refuses opt-outs and collisions)'],
  ['complete-step <enrolment|prospect> [--outcome= --note= --date=]', 'mark the current step done and move to the next'],
  ['log <prospect> --outcome= [--kind= --direction= --note= --date=]', 'any touch; a reply stops the sequence'],
  ['opt-out <prospect> [--channel= --date=]', 'stop everything and record it in the register'],
  ['pause | resume | remove <enrolment|prospect>', 'hold or take someone out of a sequence'],
  ['book-meeting <prospect> --on= [--rep=] | meeting-outcome <meeting> --status=held|no_show|cancelled', 'meetings'],
  ['set-stage <prospect> --stage= | set consent <prospect> --basis= --note= | set sender <rep> --details= | set <key> <value>', 'stages, consent, sender details and settings'],
  ['import outreach --dir= [--dry-run] | export [--dir=]', 'bring records in, take everything out'],
  ['draft-step <enrolment|prospect> | draft-reply <prospect>', 'drafts to drafts/, never sent'],
  ['activity | import-history | settings', 'who changed what'],
];

export async function run(db, cmd, o = {}, a = []) {
  if (reads[cmd]) return db.query(reads[cmd]);
  switch (cmd) {
    case 'prospect': return prospect(db, a);
    case 'sequence': return sequence(db, a);
    case 'weekly-review': return weeklyReview(db);
    case 'add': return add(db, a[0], o);
    case 'add-step': return addStep(db, o, a);
    case 'enrol': return enrol(db, o, a);
    case 'complete-step': return completeStep(db, o, a);
    case 'log': return logTouch(db, o, a);
    case 'opt-out': return optOut(db, o, a);
    case 'pause': return setStatus(db, o, a, 'paused');
    case 'resume': return setStatus(db, o, a, 'active');
    case 'remove': return setStatus(db, o, a, 'removed');
    case 'book-meeting': return bookMeeting(db, o, a);
    case 'meeting-outcome': return meetingOutcome(db, o, a);
    case 'set-stage': return setStage(db, o, a);
    case 'set': return setValue(db, o, a);
    case 'import': if (a[0] !== 'outreach') throw Error('Usage: import outreach --dir=<folder with prospects.csv>'); return importOutreach(db, o);
    case 'export': return exportAll(db, o);
    case 'draft-step': return draftStep(db, o, a);
    case 'draft-reply': return draftReply(db, o, a);
    case 'help': return HELP.map(([command, what]) => ({ command, what }));
    default: throw Error(`Unknown command "${cmd}". Run: npm run seq -- help`);
  }
}

export function parseArgs(argv) {
  const o = {}, a = [];
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/s);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
    else a.push(arg);
  }
  return { cmd: a.shift() || 'help', o, a };
}

function show(rows) {
  if (!Array.isArray(rows)) return console.log(JSON.stringify(rows, null, 2));
  if (!rows.length) return console.log('  (none)');
  const keys = Object.keys(rows[0]).filter((k) => !['id', 'created_at', 'updated_at', 'seq'].includes(k) && !k.endsWith('_id'));
  console.log(textTable(rows, keys.map((k) => ({
    key: k, label: k, width: 48,
    align: /_pct$|days|^steps$|^enrolled$|^in_progress$|^replied$|^meetings|^opted_out$|^bounced$|^finished|^sent|^replies$|^positive$|^opt_outs$|^emails$|^calls$|^connects$|^linkedin$|^due_now$|^overdue$|limit$|^over_by$|^rep_count$|^prospects$|^contactable$|^touches_out$|^step$/.test(k) ? 'right' : 'left',
    format: (v) => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : v instanceof Date ? v.toISOString().slice(0, 10) : v),
  }))));
}

function print(cmd, result) {
  if (cmd === 'help') return console.log(['npm run seq -- <command> [--json]', '', ...result.map((r) => `  ${r.command}\n      ${r.what}`)].join('\n'));
  if (Array.isArray(result)) return show(result);
  if (result && result.file) return console.log(`draft: ${path.relative(process.cwd(), result.file)} (not sent)`);
  if (result && typeof result === 'object' && Object.values(result).some(Array.isArray)) {
    for (const [k, v] of Object.entries(result)) {
      const label = k.replace(/_/g, ' ');
      if (Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object')) console.log(`${label}: ${v.join(', ') || '(none)'}`);
      else if (Array.isArray(v)) { console.log(heading(label)); show(v); }
      else if (v && typeof v === 'object') { console.log(heading(label)); show([v]); }
      else console.log(`${label}: ${v}`);
    }
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const { cmd, o, a } = parseArgs(process.argv.slice(2));
  const db = await getDb();
  try {
    const result = await run(db, cmd, o, a);
    if (o.json) console.log(JSON.stringify(result, null, 2));
    else print(cmd, result);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
