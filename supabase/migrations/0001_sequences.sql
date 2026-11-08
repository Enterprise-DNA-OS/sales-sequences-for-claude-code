-- Sales Sequences for Claude Code: prospects, accounts, sequences and their steps, enrolments,
-- the day's task queue, touches, replies, opt-outs and meetings for an outbound sales team.
-- Plain Postgres. Runs on PostgreSQL 14+ and PGlite. Dates are calendar dates.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- The date that is n working days (Monday to Friday) after d. Public holidays are not counted
-- as non-working here; add them to a holidays table in /customise if your team needs it exact.
create or replace function add_working_days(d date, n int) returns date language plpgsql immutable as $$
declare out_d date := d; left_n int := n;
begin
  while left_n > 0 loop
    out_d := out_d + 1;
    if extract(isodow from out_d) < 6 then left_n := left_n - 1; end if;
  end loop;
  return out_d;
end $$;

-- Operating settings the team controls.
create table settings (
  key text primary key,
  value text not null,
  note text not null default '',
  updated_at timestamptz not null default now()
);

create table reps (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  email text not null,
  role text not null default 'SDR',
  -- What every message from this rep says about who sent it and how to reach them.
  sender_details text,
  daily_email_limit int not null default 60 check (daily_email_limit between 1 and 2000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  domain text,
  industry text,
  country text not null default 'NZ' check (country in ('NZ', 'AU', 'other')),
  tier text not null default 'B' check (tier in ('A', 'B', 'C')),
  owner_rep_id uuid references reps(id),
  status text not null default 'target' check (status in ('target', 'working', 'customer', 'parked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prospects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  account_id uuid references accounts(id),
  name text not null,
  title text,
  email text,
  phone text,
  country text not null default 'NZ' check (country in ('NZ', 'AU', 'other')),
  owner_rep_id uuid references reps(id),
  stage text not null default 'new' check (stage in ('new', 'working', 'replied', 'meeting', 'opportunity', 'nurture', 'disqualified', 'opted_out')),
  -- Why we may email this person: express (they said yes), inferred (an existing relationship),
  -- deemed (NZ: an address conspicuously published for their business role). Null means unknown.
  consent_basis text check (consent_basis in ('express', 'inferred', 'deemed')),
  consent_note text,
  opted_out_on date,
  opt_out_channel text,
  on_do_not_call boolean not null default false,
  call_consent boolean not null default false,
  bounced boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sequences (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  purpose text,
  owner_rep_id uuid references reps(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id),
  position int not null check (position between 1 and 50),
  kind text not null check (kind in ('email', 'call', 'linkedin', 'task')),
  -- Days after the previous step (step 1: days after enrolment).
  wait_days int not null default 2 check (wait_days between 0 and 90),
  subject text,
  body text,
  instructions text,
  unique (sequence_id, position),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table enrolments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  prospect_id uuid not null references prospects(id),
  sequence_id uuid not null references sequences(id),
  rep_id uuid not null references reps(id),
  enrolled_on date not null default current_date,
  current_step int not null default 1,
  next_due_on date,
  status text not null default 'active' check (status in ('active', 'paused', 'finished', 'replied', 'meeting', 'opted_out', 'bounced', 'removed')),
  ended_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index enrolments_one_active on enrolments (prospect_id) where status in ('active', 'paused');

-- Every touch, out and in: emails sent, calls made, replies received.
create table touches (
  id uuid primary key default gen_random_uuid(),
  seq bigserial,
  code text not null unique,
  prospect_id uuid not null references prospects(id),
  enrolment_id uuid references enrolments(id),
  step_position int,
  rep_id uuid references reps(id),
  kind text not null check (kind in ('email', 'call', 'linkedin', 'task', 'meeting')),
  direction text not null default 'out' check (direction in ('out', 'in')),
  on_date date not null default current_date,
  outcome text not null check (outcome in ('sent', 'done', 'no_answer', 'voicemail', 'connected', 'bounced', 'replied', 'positive', 'not_now', 'not_interested', 'referral', 'out_of_office', 'unsubscribe')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  prospect_id uuid not null references prospects(id),
  rep_id uuid not null references reps(id),
  sequence_id uuid references sequences(id),
  booked_on date not null default current_date,
  meeting_on date not null,
  status text not null default 'booked' check (status in ('booked', 'held', 'no_show', 'cancelled')),
  outcome text,
  next_step text,
  next_step_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit (
  id bigserial primary key,
  actor text not null,
  kind text not null,
  record_id text,
  operation text not null,
  before_record jsonb,
  after_record jsonb,
  created_at timestamptz not null default now()
);

create table import_records (
  id bigserial primary key,
  source text not null,
  kind text not null,
  code text not null,
  record_id uuid,
  original jsonb not null,
  created_at timestamptz not null default now(),
  unique (source, kind, code)
);

do $$
declare t text;
begin
  foreach t in array array['settings', 'reps', 'accounts', 'prospects', 'sequences', 'sequence_steps', 'enrolments', 'touches', 'meetings'] loop
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- Data lives in the database, not in the open: no access for the public role.
do $$
declare t text;
begin
  foreach t in array array['settings', 'reps', 'accounts', 'prospects', 'sequences', 'sequence_steps', 'enrolments', 'touches', 'meetings', 'audit', 'import_records'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from public', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- views

create view setting_values as
select
  coalesce((select value from settings where key = 'business_name'), 'Your Business') as business_name,
  coalesce((select value::int from settings where key = 'reply_wait_days'), 1) as reply_wait_days,
  coalesce((select value::int from settings where key = 'quiet_account_days'), 30) as quiet_account_days,
  coalesce((select value::int from settings where key = 'collision_days'), 14) as collision_days,
  coalesce((select value::int from settings where key = 'no_show_follow_up_days'), 2) as no_show_follow_up_days,
  coalesce((select value::int from settings where key = 'opt_out_working_days'), 5) as opt_out_working_days;

-- The day's work: every active enrolment whose next step is due, rep by rep.
create view task_queue as
select e.code as enrolment, r.code as rep_code, r.name as rep, p.code as prospect_code, p.name as prospect,
  a.name as account, s.code as sequence_code, s.name as sequence, st.position as step, st.kind, st.subject,
  e.next_due_on as due_on, current_date - e.next_due_on as days_late,
  case
    when p.opted_out_on is not null then 'opted out: remove, do not touch'
    when p.bounced and st.kind = 'email' then 'email bounced: find a new address or skip'
    when st.kind = 'email' and p.consent_basis is null then 'no consent recorded: do not email'
    when st.kind = 'call' and p.country = 'AU' and p.on_do_not_call and not p.call_consent then 'on the Do Not Call Register: do not call'
  end as hold
from enrolments e
join prospects p on p.id = e.prospect_id
left join accounts a on a.id = p.account_id
join sequences s on s.id = e.sequence_id
join reps r on r.id = e.rep_id
join sequence_steps st on st.sequence_id = e.sequence_id and st.position = e.current_step
where e.status = 'active' and e.next_due_on <= current_date;

-- The last touch either way for each prospect.
create view prospect_last_touch as
select p.id as prospect_id,
  max(t.on_date) filter (where t.direction = 'out') as last_out_on,
  max(t.on_date) filter (where t.direction = 'in') as last_in_on,
  max(t.on_date) as last_touch_on,
  count(*) filter (where t.direction = 'out') as touches_out
from prospects p left join touches t on t.prospect_id = p.id
group by p.id;

create view prospect_list as
select p.code, p.name, p.title, a.name as account, p.country, r.name as owner, p.stage, p.consent_basis,
  p.opted_out_on, p.bounced, l.touches_out, l.last_out_on, l.last_in_on,
  (select s.code from enrolments e join sequences s on s.id = e.sequence_id where e.prospect_id = p.id and e.status in ('active', 'paused') limit 1) as in_sequence
from prospects p
left join accounts a on a.id = p.account_id
left join reps r on r.id = p.owner_rep_id
join prospect_last_touch l on l.prospect_id = p.id;

-- A reply that came in and has had nothing back from us since.
create view replies_waiting as
select t.code as touch, p.code as prospect_code, p.name as prospect, a.name as account, r.name as owner,
  t.on_date as replied_on, t.outcome, t.note, current_date - t.on_date as days_waiting
from touches t
join prospects p on p.id = t.prospect_id
left join accounts a on a.id = p.account_id
left join reps r on r.id = p.owner_rep_id
where t.direction = 'in' and t.outcome not in ('out_of_office', 'bounced', 'unsubscribe')
  and not exists (select 1 from touches o where o.prospect_id = t.prospect_id and o.direction = 'out' and (o.on_date > t.on_date or (o.on_date = t.on_date and o.seq > t.seq)))
  and not exists (select 1 from touches i where i.prospect_id = t.prospect_id and i.direction = 'in' and (i.on_date > t.on_date or (i.on_date = t.on_date and i.seq > t.seq)))
  and p.stage not in ('opted_out', 'disqualified');

create view sequence_performance as
select s.code, s.name, s.active,
  (select count(*) from sequence_steps st where st.sequence_id = s.id) as steps,
  count(e.*) as enrolled,
  count(*) filter (where e.status = 'active') as in_progress,
  count(*) filter (where e.status in ('replied', 'meeting')) as replied,
  count(*) filter (where e.status = 'meeting') as meetings,
  count(*) filter (where e.status = 'opted_out') as opted_out,
  count(*) filter (where e.status = 'bounced') as bounced,
  count(*) filter (where e.status = 'finished') as finished_no_reply,
  case when count(e.*) = 0 then null else round(100.0 * count(*) filter (where e.status in ('replied', 'meeting')) / count(e.*), 1) end as reply_pct,
  case when count(e.*) = 0 then null else round(100.0 * count(*) filter (where e.status = 'meeting') / count(e.*), 1) end as meeting_pct
from sequences s left join enrolments e on e.sequence_id = s.id
group by s.id, s.code, s.name, s.active;

-- Which step the replies come from (the step that was last sent before the reply).
create view step_performance as
select s.code as sequence_code, st.position as step, st.kind, coalesce(st.subject, st.instructions) as what,
  (select count(*) from touches t join enrolments e on e.id = t.enrolment_id where e.sequence_id = s.id and t.step_position = st.position and t.direction = 'out') as sent,
  (select count(*) from touches t join enrolments e on e.id = t.enrolment_id where e.sequence_id = s.id and t.step_position = st.position and t.direction = 'in' and t.outcome in ('replied', 'positive', 'not_now', 'not_interested', 'referral')) as replies,
  (select count(*) from touches t join enrolments e on e.id = t.enrolment_id where e.sequence_id = s.id and t.step_position = st.position and t.direction = 'in' and t.outcome = 'positive') as positive,
  (select count(*) from touches t join enrolments e on e.id = t.enrolment_id where e.sequence_id = s.id and t.step_position = st.position and t.outcome = 'unsubscribe') as opt_outs
from sequences s join sequence_steps st on st.sequence_id = s.id;

-- Touches in the last seven days, rep by rep.
create view rep_activity as
select r.code, r.name,
  count(t.*) filter (where t.kind = 'email' and t.direction = 'out') as emails,
  count(t.*) filter (where t.kind = 'call') as calls,
  count(t.*) filter (where t.kind = 'call' and t.outcome = 'connected') as connects,
  count(t.*) filter (where t.kind = 'linkedin') as linkedin,
  count(t.*) filter (where t.direction = 'in') as replies,
  (select count(*) from meetings m where m.rep_id = r.id and m.booked_on >= current_date - 6) as meetings_booked,
  (select count(*) from task_queue q where q.rep_code = r.code) as due_now,
  (select count(*) from task_queue q where q.rep_code = r.code and q.days_late > 0) as overdue
from reps r left join touches t on t.rep_id = r.id and t.on_date >= current_date - 6
where r.active
group by r.id, r.code, r.name;

-- Emails due today per rep against the mailbox's daily limit.
create view mailbox_load as
select r.code, r.name, r.daily_email_limit,
  (select count(*) from touches t where t.rep_id = r.id and t.kind = 'email' and t.direction = 'out' and t.on_date = current_date) as sent_today,
  (select count(*) from task_queue q where q.rep_code = r.code and q.kind = 'email' and q.hold is null) as emails_due,
  (select count(*) from touches t where t.rep_id = r.id and t.kind = 'email' and t.direction = 'out' and t.on_date = current_date)
    + (select count(*) from task_queue q where q.rep_code = r.code and q.kind = 'email' and q.hold is null) - r.daily_email_limit as over_by
from reps r where r.active;

-- Two or more reps touching the same account inside the collision window.
create view account_collisions as
select a.code, a.name, string_agg(distinct r.name, ', ' order by r.name) as reps, count(distinct t.rep_id) as rep_count,
  max(t.on_date) as last_touch_on, owner.name as owner
from touches t
join prospects p on p.id = t.prospect_id
join accounts a on a.id = p.account_id
join reps r on r.id = t.rep_id
left join reps owner on owner.id = a.owner_rep_id
where t.direction = 'out' and t.on_date >= current_date - (select collision_days from setting_values)
group by a.id, a.code, a.name, owner.name
having count(distinct t.rep_id) > 1;

-- Target accounts nobody is working: no touch inside the quiet window and no one in a sequence.
create view quiet_accounts as
select a.code, a.name, a.tier, a.country, r.name as owner,
  (select max(t.on_date) from touches t join prospects p on p.id = t.prospect_id where p.account_id = a.id) as last_touch_on,
  (select count(*) from prospects p where p.account_id = a.id and p.stage not in ('opted_out', 'disqualified')) as contactable,
  current_date - (select max(t.on_date) from touches t join prospects p on p.id = t.prospect_id where p.account_id = a.id) as days_quiet
from accounts a left join reps r on r.id = a.owner_rep_id
where a.status in ('target', 'working')
  and not exists (select 1 from enrolments e join prospects p on p.id = e.prospect_id where p.account_id = a.id and e.status in ('active', 'paused'))
  and coalesce((select max(t.on_date) from touches t join prospects p on p.id = t.prospect_id where p.account_id = a.id), date '1900-01-01') < current_date - (select quiet_account_days from setting_values);

create view meeting_follow_up as
select m.code, p.code as prospect_code, p.name as prospect, a.name as account, r.name as rep, m.meeting_on, m.status, m.next_step, m.next_step_due,
  case
    when m.status = 'booked' and m.meeting_on < current_date then 'meeting date passed: record held or no-show'
    when m.status = 'no_show' and not exists (select 1 from touches t where t.prospect_id = m.prospect_id and t.direction = 'out' and t.on_date > m.meeting_on)
      and m.meeting_on <= current_date - (select no_show_follow_up_days from setting_values) then 'no-show with no follow-up'
    when m.status = 'held' and m.next_step is null then 'held with no next step'
    when m.status = 'held' and m.next_step_due < current_date then 'next step overdue'
  end as issue
from meetings m
join prospects p on p.id = m.prospect_id
left join accounts a on a.id = p.account_id
join reps r on r.id = m.rep_id;

create view attention as
select 'replies' as area, prospect_code as code, prospect as who, 'reply waiting ' || days_waiting || ' days: ' || coalesce(note, outcome) as issue, days_waiting as days
from replies_waiting, setting_values where days_waiting >= reply_wait_days
union all
select 'tasks', enrolment, prospect, 'step ' || step || ' (' || kind || ') ' || days_late || ' days late for ' || rep, days_late
from task_queue where days_late > 0 and hold is null
union all
select 'holds', enrolment, prospect, hold, days_late
from task_queue where hold is not null
union all
select 'meetings', prospect_code, prospect, issue, current_date - meeting_on
from meeting_follow_up where issue is not null
union all
select 'collisions', code, name, rep_count || ' reps touching this account: ' || reps, null
from account_collisions
union all
select 'quiet accounts', code, name, 'tier ' || tier || ', ' || coalesce('no touch for ' || days_quiet || ' days', 'never touched') || ', nobody in a sequence', days_quiet
from quiet_accounts where tier in ('A', 'B')
union all
select 'mailboxes', code, name, 'emails due today exceed the daily limit by ' || over_by, null
from mailbox_load where over_by > 0;

-- The rules docs/compliance.md cites, checked against the records.
create view compliance_checks as
-- Consent: an email step is due for someone with no recorded reason we may email them.
select 'CONSENT' as rule, p.code, p.name as who,
  'email step ' || q.step || ' of ' || q.sequence_code || ' due with no consent basis recorded' as finding, 'breach' as severity
from task_queue q join prospects p on p.code = q.prospect_code
where q.kind = 'email' and p.consent_basis is null
union all
-- Deemed consent is a New Zealand rule. In Australia, rely on express or inferred consent.
select 'CONSENT', p.code, p.name, 'deemed consent recorded for an Australian address: confirm inferred or express consent', 'check'
from prospects p where p.country = 'AU' and p.consent_basis = 'deemed' and p.opted_out_on is null
union all
-- Unsubscribe: still enrolled after opting out.
select 'UNSUBSCRIBE', p.code, p.name,
  'opted out on ' || p.opted_out_on || ' and still in ' || s.code || case when current_date > add_working_days(p.opted_out_on, (select opt_out_working_days from setting_values)) then ', past the 5 working day limit' else ', stop before ' || add_working_days(p.opted_out_on, (select opt_out_working_days from setting_values)) end,
  case when current_date > add_working_days(p.opted_out_on, (select opt_out_working_days from setting_values)) then 'breach' else 'due' end
from enrolments e join prospects p on p.id = e.prospect_id join sequences s on s.id = e.sequence_id
where p.opted_out_on is not null and e.status in ('active', 'paused')
union all
-- Unsubscribe: a commercial email went out after the opt-out took effect.
select 'UNSUBSCRIBE', p.code, p.name, 'email sent on ' || t.on_date || ' after an opt-out on ' || p.opted_out_on, 'breach'
from touches t join prospects p on p.id = t.prospect_id
where t.kind = 'email' and t.direction = 'out' and p.opted_out_on is not null
  and t.on_date > add_working_days(p.opted_out_on, (select opt_out_working_days from setting_values))
union all
-- Sender information: a rep with email steps whose messages do not say who sent them.
select 'SENDER-INFO', r.code, r.name, 'no sender details on file for a rep with email steps due', 'breach'
from reps r
where r.active and coalesce(trim(r.sender_details), '') = ''
  and exists (select 1 from task_queue q where q.rep_code = r.code and q.kind = 'email')
union all
-- Do Not Call Register (Australia): a call step due to a registered number with no consent.
select 'DO-NOT-CALL', p.code, p.name, 'call step ' || q.step || ' of ' || q.sequence_code || ' due to a number on the Do Not Call Register', 'breach'
from task_queue q join prospects p on p.code = q.prospect_code
where q.kind = 'call' and p.country = 'AU' and p.on_do_not_call and not p.call_consent;

-- The register you keep as evidence: every opt-out, when, and whether it was honoured.
create view opt_out_register as
select p.code, p.name, p.email, a.name as account, p.country, p.opted_out_on, p.opt_out_channel,
  add_working_days(p.opted_out_on, (select opt_out_working_days from setting_values)) as must_stop_by,
  (select max(t.on_date) from touches t where t.prospect_id = p.id and t.kind = 'email' and t.direction = 'out') as last_email_on,
  case
    when exists (select 1 from touches t where t.prospect_id = p.id and t.kind = 'email' and t.direction = 'out' and t.on_date > add_working_days(p.opted_out_on, (select opt_out_working_days from setting_values))) then 'emailed after the limit'
    when exists (select 1 from enrolments e where e.prospect_id = p.id and e.status in ('active', 'paused')) then 'still in a sequence'
    else 'honoured'
  end as status
from prospects p left join accounts a on a.id = p.account_id
where p.opted_out_on is not null;
