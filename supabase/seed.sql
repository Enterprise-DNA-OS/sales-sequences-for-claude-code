-- Demo data for Harbour Analytics, a fictional Auckland software company with three people
-- selling fleet reporting to transport and logistics firms in New Zealand and Australia.
-- Every date is relative to today, so the demo always has a reply nobody answered, an overdue
-- task queue, an opt-out still in a sequence, an email due with no consent recorded, an
-- Australian number on the Do Not Call Register, a no-show with no follow-up and a quiet account.
-- Idempotent: a second run does nothing.
do $$
begin
  if exists (select 1 from reps where code = 'REP-01') then return; end if;

  insert into settings (key, value, note) values
    ('business_name', 'Harbour Analytics', 'Shown on drafts, views and documents'),
    ('reply_wait_days', '1', 'Days a reply can wait before it shows in attention'),
    ('quiet_account_days', '30', 'Days without a touch before a target account counts as quiet'),
    ('collision_days', '14', 'Window for spotting two reps working the same account'),
    ('no_show_follow_up_days', '2', 'Days after a no-show before a missing follow-up is flagged'),
    ('opt_out_working_days', '5', 'Working days to honour an opt-out (NZ UEMA s 9(2), AU Spam Act Sch 2 cl 6)');

  insert into reps (code, name, email, role, sender_details, daily_email_limit) values
    ('REP-01', 'Aroha Ngata', 'aroha@harbouranalytics.example', 'SDR', 'Aroha Ngata, Harbour Analytics Ltd, Level 2, 10 Quay St, Auckland. 09 555 0101. harbouranalytics.example', 60),
    ('REP-02', 'Josh Bennett', 'josh@harbouranalytics.example', 'SDR', null, 60),
    ('REP-03', 'Priya Raman', 'priya@harbouranalytics.example', 'Account Executive', 'Priya Raman, Harbour Analytics Ltd, Level 2, 10 Quay St, Auckland. 09 555 0103. harbouranalytics.example', 2);

  insert into accounts (code, name, domain, industry, country, tier, owner_rep_id, status) values
    ('ACC-001', 'Southern Cross Freight', 'southerncrossfreight.example', 'Road freight', 'NZ', 'A', (select id from reps where code = 'REP-01'), 'working'),
    ('ACC-002', 'Tasman Cold Chain', 'tasmancold.example', 'Cold storage', 'NZ', 'A', (select id from reps where code = 'REP-01'), 'working'),
    ('ACC-003', 'Kiwi Linehaul', 'kiwilinehaul.example', 'Linehaul', 'NZ', 'B', (select id from reps where code = 'REP-01'), 'working'),
    ('ACC-004', 'Brisbane Bulk Haulage', 'bnebulk.example', 'Bulk haulage', 'AU', 'A', (select id from reps where code = 'REP-02'), 'working'),
    ('ACC-005', 'Pacific Couriers', 'paccouriers.example', 'Courier', 'AU', 'B', (select id from reps where code = 'REP-02'), 'working'),
    ('ACC-006', 'Waikato Tankers', 'waikatotankers.example', 'Bulk liquids', 'NZ', 'B', (select id from reps where code = 'REP-03'), 'working'),
    ('ACC-007', 'Otago Logistics Group', 'otagologistics.example', '3PL', 'NZ', 'A', (select id from reps where code = 'REP-03'), 'target'),
    ('ACC-008', 'Perth Mining Transport', 'perthminetransport.example', 'Mining haulage', 'AU', 'B', (select id from reps where code = 'REP-02'), 'target'),
    ('ACC-009', 'Harbour Bridge Removals', 'hbremovals.example', 'Removals', 'NZ', 'C', null, 'parked'),
    ('ACC-010', 'Coastline Haulage', 'coastlinehaulage.example', 'Road freight', 'NZ', 'A', (select id from reps where code = 'REP-03'), 'working'),
    ('ACC-011', 'Canterbury Fleet Services', 'canterburyfleet.example', 'Fleet services', 'NZ', 'B', (select id from reps where code = 'REP-03'), 'working'),
    ('ACC-012', 'Gold Coast Tippers', 'gctippers.example', 'Tipper haulage', 'AU', 'B', (select id from reps where code = 'REP-01'), 'working');

  insert into prospects (code, account_id, name, title, email, phone, country, owner_rep_id, stage, consent_basis, consent_note, opted_out_on, opt_out_channel, on_do_not_call, call_consent, bounced, source) values
    ('PRO-001', (select id from accounts where code = 'ACC-001'), 'Mark Henare', 'Operations Manager', 'mark.henare@southerncrossfreight.example', '021 555 0201', 'NZ', (select id from reps where code = 'REP-01'), 'working', 'deemed', 'Work address on company contact page', null, null, false, false, false, 'Website contact page'),
    ('PRO-002', (select id from accounts where code = 'ACC-001'), 'Sina Faleolo', 'Fleet Controller', 'sina.faleolo@southerncrossfreight.example', '021 555 0202', 'NZ', (select id from reps where code = 'REP-01'), 'working', 'deemed', 'Work address in industry directory, listed for fleet enquiries', null, null, false, false, false, 'Industry directory'),
    ('PRO-003', (select id from accounts where code = 'ACC-002'), 'Grace Liu', 'General Manager', 'grace.liu@tasmancold.example', '021 555 0203', 'NZ', (select id from reps where code = 'REP-01'), 'replied', 'express', 'Asked for follow-up at the LogiCon stand', null, null, false, false, false, 'LogiCon expo'),
    ('PRO-004', (select id from accounts where code = 'ACC-003'), 'Tom Walsh', 'Depot Manager', 'tom.walsh@kiwilinehaul.example', '021 555 0204', 'NZ', (select id from reps where code = 'REP-01'), 'working', 'express', 'Scanned at LogiCon, ticked follow-up', null, null, false, false, false, 'LogiCon expo'),
    ('PRO-005', (select id from accounts where code = 'ACC-003'), 'Hannah Cole', 'Finance Manager', 'hannah.cole@kiwilinehaul.example', '021 555 0205', 'NZ', (select id from reps where code = 'REP-02'), 'opted_out', 'deemed', 'Address on annual report', current_date - 10, 'email reply: please remove me', false, false, false, 'Annual report'),
    ('PRO-006', (select id from accounts where code = 'ACC-004'), 'Liam Doyle', 'Transport Manager', 'liam.doyle@bnebulk.example', '0412 555 206', 'AU', (select id from reps where code = 'REP-02'), 'opted_out', 'inferred', 'Former customer of our reseller', current_date - 1, 'unsubscribe link', false, false, false, 'Reseller list'),
    ('PRO-007', (select id from accounts where code = 'ACC-004'), 'Emma Clarke', 'Operations Director', 'emma.clarke@bnebulk.example', '0412 555 207', 'AU', (select id from reps where code = 'REP-02'), 'working', null, null, null, null, false, false, false, 'Bought list'),
    ('PRO-008', (select id from accounts where code = 'ACC-005'), 'Jack Murphy', 'Owner', 'jack@paccouriers.example', '0412 555 208', 'AU', (select id from reps where code = 'REP-02'), 'working', 'inferred', 'Downloaded our fleet cost guide', null, null, true, false, false, 'Guide download'),
    ('PRO-009', (select id from accounts where code = 'ACC-005'), 'Olivia Tran', 'Operations Lead', 'olivia.tran@paccouriers.example', '0412 555 209', 'AU', (select id from reps where code = 'REP-02'), 'new', 'deemed', 'Address on company website', null, null, false, false, false, 'Website'),
    ('PRO-010', (select id from accounts where code = 'ACC-006'), 'Rawiri Parata', 'Operations Manager', 'rawiri.parata@waikatotankers.example', '021 555 0210', 'NZ', (select id from reps where code = 'REP-03'), 'working', 'deemed', 'Address on company website', null, null, false, false, true, 'Website'),
    ('PRO-011', (select id from accounts where code = 'ACC-006'), 'Sophie Wilson', 'General Manager', 'sophie.wilson@waikatotankers.example', '021 555 0211', 'NZ', (select id from reps where code = 'REP-03'), 'meeting', 'express', 'Asked for a demo by phone', null, null, false, false, false, 'Inbound call'),
    ('PRO-012', (select id from accounts where code = 'ACC-011'), 'Ben Turner', 'Fleet Manager', 'ben.turner@canterburyfleet.example', '021 555 0212', 'NZ', (select id from reps where code = 'REP-03'), 'meeting', 'express', 'Referred by a LogiCon contact', null, null, false, false, false, 'Referral'),
    ('PRO-013', (select id from accounts where code = 'ACC-007'), 'Kate Morrison', 'CEO', 'kate.morrison@otagologistics.example', '021 555 0213', 'NZ', (select id from reps where code = 'REP-03'), 'nurture', 'express', 'Met at LogiCon last year', null, null, false, false, false, 'LogiCon expo'),
    ('PRO-014', (select id from accounts where code = 'ACC-012'), 'Noah Singh', 'Workshop Manager', 'noah.singh@gctippers.example', '0412 555 214', 'AU', (select id from reps where code = 'REP-01'), 'working', 'inferred', 'Asked a question on our webinar', null, null, false, true, false, 'Webinar'),
    ('PRO-015', (select id from accounts where code = 'ACC-010'), 'Ruby Ngata', 'Safety Coordinator', 'ruby.ngata@coastlinehaulage.example', '021 555 0215', 'NZ', (select id from reps where code = 'REP-03'), 'meeting', 'express', 'Booked via the website', null, null, false, false, false, 'Website form');

  insert into sequences (code, name, purpose, owner_rep_id) values
    ('SEQ-01', 'Cold outbound: operations leaders', 'First contact with operations and fleet leaders at target accounts', (select id from reps where code = 'REP-01')),
    ('SEQ-02', 'LogiCon follow-up', 'People we met at the LogiCon expo stand', (select id from reps where code = 'REP-01')),
    ('SEQ-03', 'Re-engage: last year''s conversations', 'People who went quiet after a first meeting', (select id from reps where code = 'REP-03'));

  insert into sequence_steps (sequence_id, position, kind, wait_days, subject, body, instructions)
  select s.id, v.position, v.kind, v.wait_days, v.subject, v.body, v.instructions
  from (values
    ('SEQ-01', 1, 'email', 0, 'Fuel and idle time at {{account}}', 'Hi {{first_name}}, most fleets your size lose a day a week of truck time to idling and dead running. We show it vehicle by vehicle from the telematics you already have. Worth 20 minutes to see yours?', null),
    ('SEQ-01', 2, 'call', 2, null, null, 'Call about the idle time email. Ask how they report fuel per vehicle today.'),
    ('SEQ-01', 3, 'email', 3, 'Re: fuel and idle time at {{account}}', 'Hi {{first_name}}, one number most operations managers we talk to cannot get: cost per kilometre by route. Happy to show you how others in {{industry}} get it.', null),
    ('SEQ-01', 4, 'linkedin', 2, null, null, 'Connect with a short note. No pitch.'),
    ('SEQ-01', 5, 'email', 5, 'Close the loop', 'Hi {{first_name}}, I will leave it here. If fleet cost reporting comes up this year, reply to this and I will pick it up.', null),
    ('SEQ-02', 1, 'email', 0, 'Good to meet you at LogiCon', 'Hi {{first_name}}, thanks for stopping by the stand. As promised, here is the fleet cost report we showed you. Would a 20 minute walk through on your own data help?', null),
    ('SEQ-02', 2, 'call', 2, null, null, 'Call to book the walk through. Mention the report sent after the expo.'),
    ('SEQ-02', 3, 'email', 4, 'Your fleet cost report', 'Hi {{first_name}}, a short note in case the first one got buried. The offer to run the report on your own fleet stands.', null),
    ('SEQ-03', 1, 'email', 0, 'Picking up where we left off', 'Hi {{first_name}}, last year you mentioned fuel reporting was on the list for this year. Is it still?', null),
    ('SEQ-03', 2, 'call', 3, null, null, 'Call. Ask what changed since the first meeting.'),
    ('SEQ-03', 3, 'email', 5, 'Should I close your file?', 'Hi {{first_name}}, if the timing is wrong, say so and I will check back in six months.', null)
  ) as v(seq, position, kind, wait_days, subject, body, instructions)
  join sequences s on s.code = v.seq;

  insert into enrolments (code, prospect_id, sequence_id, rep_id, enrolled_on, current_step, next_due_on, status, ended_on)
  select v.code, p.id, s.id, r.id, current_date + v.enrolled, v.step, current_date + v.due, v.status, current_date + v.ended
  from (values
    ('ENR-001', 'PRO-001', 'SEQ-01', 'REP-01', -9, 3, -2, 'active', null),
    ('ENR-002', 'PRO-002', 'SEQ-01', 'REP-01', -4, 2, 0, 'active', null),
    ('ENR-003', 'PRO-003', 'SEQ-02', 'REP-01', -8, 2, null, 'replied', -3),
    ('ENR-004', 'PRO-004', 'SEQ-02', 'REP-01', -6, 3, -1, 'active', null),
    ('ENR-005', 'PRO-005', 'SEQ-01', 'REP-02', -20, 4, -3, 'active', null),
    ('ENR-006', 'PRO-006', 'SEQ-01', 'REP-02', -7, 3, 0, 'active', null),
    ('ENR-007', 'PRO-007', 'SEQ-01', 'REP-02', -3, 1, -3, 'active', null),
    ('ENR-008', 'PRO-008', 'SEQ-01', 'REP-02', -5, 2, -1, 'active', null),
    ('ENR-009', 'PRO-010', 'SEQ-03', 'REP-03', -6, 3, 0, 'active', null),
    ('ENR-010', 'PRO-011', 'SEQ-03', 'REP-03', -14, 2, null, 'meeting', -9),
    ('ENR-011', 'PRO-012', 'SEQ-02', 'REP-03', -12, 3, null, 'meeting', -5),
    ('ENR-012', 'PRO-013', 'SEQ-03', 'REP-03', -60, 3, null, 'finished', -48),
    ('ENR-013', 'PRO-014', 'SEQ-01', 'REP-01', -2, 2, 0, 'active', null),
    ('ENR-014', 'PRO-015', 'SEQ-02', 'REP-03', -10, 2, -1, 'active', null),
    ('ENR-015', 'PRO-009', 'SEQ-01', 'REP-03', 0, 1, 0, 'active', null)
  ) as v(code, prospect, seq, rep, enrolled, step, due, status, ended)
  join prospects p on p.code = v.prospect
  join sequences s on s.code = v.seq
  join reps r on r.code = v.rep;

  insert into touches (code, prospect_id, enrolment_id, step_position, rep_id, kind, direction, on_date, outcome, note)
  select v.code, p.id, e.id, v.step, r.id, v.kind, v.dir, current_date + v.at, v.outcome, v.note
  from (values
    ('TCH-001', 'PRO-001', 'ENR-001', 1, 'REP-01', 'email', 'out', -9, 'sent', null),
    ('TCH-002', 'PRO-001', 'ENR-001', 2, 'REP-01', 'call', 'out', -7, 'voicemail', 'Left a message about idle time'),
    ('TCH-003', 'PRO-002', 'ENR-002', 1, 'REP-01', 'email', 'out', -4, 'sent', null),
    ('TCH-004', 'PRO-003', 'ENR-003', 1, 'REP-01', 'email', 'out', -8, 'sent', null),
    ('TCH-005', 'PRO-003', 'ENR-003', 1, 'REP-01', 'email', 'in', -3, 'positive', 'Send me pricing for 40 trucks and we can talk'),
    ('TCH-006', 'PRO-004', 'ENR-004', 1, 'REP-01', 'email', 'out', -6, 'sent', null),
    ('TCH-007', 'PRO-004', 'ENR-004', 2, 'REP-01', 'call', 'out', -4, 'connected', 'Busy until end of month, try again then'),
    ('TCH-008', 'PRO-005', 'ENR-005', 1, 'REP-02', 'email', 'out', -20, 'sent', null),
    ('TCH-009', 'PRO-005', 'ENR-005', 2, 'REP-02', 'call', 'out', -16, 'no_answer', null),
    ('TCH-010', 'PRO-005', 'ENR-005', 3, 'REP-02', 'email', 'out', -12, 'sent', null),
    ('TCH-011', 'PRO-005', 'ENR-005', 3, 'REP-02', 'email', 'in', -10, 'unsubscribe', 'Please remove me from your list'),
    ('TCH-012', 'PRO-005', null, null, 'REP-02', 'email', 'out', -2, 'sent', 'Sent by hand from the old list'),
    ('TCH-013', 'PRO-006', 'ENR-006', 1, 'REP-02', 'email', 'out', -7, 'sent', null),
    ('TCH-014', 'PRO-006', 'ENR-006', 2, 'REP-02', 'call', 'out', -5, 'no_answer', null),
    ('TCH-015', 'PRO-006', 'ENR-006', 2, 'REP-02', 'email', 'in', -1, 'unsubscribe', 'Unsubscribe link'),
    ('TCH-016', 'PRO-008', 'ENR-008', 1, 'REP-02', 'email', 'out', -5, 'sent', null),
    ('TCH-017', 'PRO-008', null, null, 'REP-01', 'email', 'out', -4, 'sent', 'Aroha emailed about the webinar'),
    ('TCH-018', 'PRO-014', 'ENR-013', 1, 'REP-01', 'email', 'out', -2, 'sent', null),
    ('TCH-019', 'PRO-007', null, null, 'REP-02', 'linkedin', 'out', -3, 'done', 'Viewed profile'),
    ('TCH-020', 'PRO-010', 'ENR-009', 1, 'REP-03', 'email', 'out', -6, 'bounced', 'Mailbox does not exist'),
    ('TCH-021', 'PRO-010', 'ENR-009', 2, 'REP-03', 'call', 'out', -3, 'connected', 'Says email changed, will text new one'),
    ('TCH-022', 'PRO-011', 'ENR-010', 1, 'REP-03', 'email', 'out', -14, 'sent', null),
    ('TCH-023', 'PRO-011', 'ENR-010', 1, 'REP-03', 'email', 'in', -9, 'positive', 'Yes, book a time'),
    ('TCH-024', 'PRO-011', null, null, 'REP-03', 'email', 'out', -9, 'sent', 'Invite sent'),
    ('TCH-025', 'PRO-012', 'ENR-011', 1, 'REP-03', 'email', 'out', -12, 'sent', null),
    ('TCH-026', 'PRO-012', 'ENR-011', 2, 'REP-03', 'call', 'out', -5, 'connected', 'Booked a demo'),
    ('TCH-027', 'PRO-013', 'ENR-012', 1, 'REP-03', 'email', 'out', -60, 'sent', null),
    ('TCH-028', 'PRO-013', 'ENR-012', 3, 'REP-03', 'email', 'out', -52, 'sent', null),
    ('TCH-029', 'PRO-015', 'ENR-014', 1, 'REP-03', 'email', 'out', -10, 'sent', null),
    ('TCH-030', 'PRO-015', null, null, 'REP-03', 'email', 'out', 0, 'sent', 'Confirmed the safety module demo'),
    ('TCH-031', 'PRO-004', 'ENR-004', 2, 'REP-01', 'email', 'in', -2, 'out_of_office', 'Away until the 20th'),
    ('TCH-032', 'PRO-012', null, null, 'REP-03', 'email', 'out', 0, 'sent', 'Asked to confirm the demo time')
  ) as v(code, prospect, enrolment, step, rep, kind, dir, at, outcome, note)
  join prospects p on p.code = v.prospect
  join reps r on r.code = v.rep
  left join enrolments e on e.code = v.enrolment
  order by v.code;

  insert into meetings (code, prospect_id, rep_id, sequence_id, booked_on, meeting_on, status, outcome, next_step, next_step_due)
  select v.code, p.id, r.id, s.id, current_date + v.booked, current_date + v.meet, v.status, v.outcome, v.next_step, current_date + v.next_due
  from (values
    ('MTG-001', 'PRO-011', 'REP-03', 'SEQ-03', -9, -4, 'no_show', null, null, null::int),
    ('MTG-002', 'PRO-012', 'REP-03', 'SEQ-02', -5, -1, 'booked', null, null, null),
    ('MTG-003', 'PRO-015', 'REP-03', 'SEQ-02', -8, -6, 'held', 'Wants the safety module, needs board sign-off', null, null)
  ) as v(code, prospect, rep, seq, booked, meet, status, outcome, next_step, next_due)
  join prospects p on p.code = v.prospect
  join reps r on r.code = v.rep
  left join sequences s on s.code = v.seq;
end $$;
