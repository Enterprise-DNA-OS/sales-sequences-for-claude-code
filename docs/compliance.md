# Compliance checks

Sources checked 8 November 2026. `/compliance` runs `npm run seq -- compliance`, which reads the `compliance_checks` view, and `npm run seq -- opt-outs`, which reads the opt-out register. Each rule below says where it comes from, what a breach looks like in the records, and what the check does not do.

Nothing here is legal advice. The defaults are set for a team emailing and calling businesses in New Zealand and Australia. Change them with `npm run seq -- set <key> <value>` or `/customise`.

Both countries treat a cold sales email as a commercial electronic message: it needs consent, it must say who sent it, and it must carry a working way to opt out.

## CONSENT: a reason we may email this person

Sources: [Unsolicited Electronic Messages Act 2007 (NZ)](https://www.legislation.govt.nz/act/public/2007/7/en/latest/), section 9 (no unsolicited commercial electronic messages) and the definition of consent in section 4 (express, inferred, and deemed consent where an address is conspicuously published and the message relates to the person's business role). [Spam Act 2003 (Cth)](https://www.legislation.gov.au/C2004A01214/latest/text), section 16 and Schedule 2 (express and inferred consent; a conspicuously published address is one form of inferred consent). The sender bears the burden of showing consent (Spam Act s 16(5)).

What the check finds: an email step due for a prospect with no `consent_basis` recorded (breach; the step is also held in the queue and `draft-step` and `complete-step` refuse it), and `deemed` recorded on an Australian address (check: the Australian Act calls this inferred consent and has its own conditions on published addresses).

What it does not do: decide whether your evidence is good enough. The note on each prospect (`consent_note`) is where the evidence goes. An import from Outreach never invents a basis.

## UNSUBSCRIBE: opt-outs honoured within 5 working days

Sources: Unsolicited Electronic Messages Act 2007 (NZ) section 11 (a functional unsubscribe facility in every message) and section 9(2) (consent is withdrawn 5 working days after the facility is used). Spam Act 2003 (Cth) section 18 (a functional unsubscribe facility) and Schedule 2 clause 6 (withdrawal takes effect at the end of 5 business days from the request). The regulator reports for both countries treat messages sent after that window as sent without consent ([ACMA investigation reports](https://www.acma.gov.au/), [DIA: about unsubscribing](https://www.dia.govt.nz/Information-about-unsubscribing)).

What the check finds: someone who opted out and is still in an active or paused sequence (due inside the 5 working days, breach after), and any email logged to them after the window closed (breach). The register (`opt-outs`) keeps every opt-out, the date it must be honoured by, the last email, and whether it was honoured.

How the system helps: `opt-out` and `log --outcome=unsubscribe` stop every sequence the same day; `log` refuses an outgoing email to someone who opted out; `draft-step` adds an unsubscribe line to every draft. Working days here skip weekends but not public holidays: add a holidays table with `/customise` if you need it exact.

## SENDER-INFO: every message says who sent it

Sources: Unsolicited Electronic Messages Act 2007 (NZ) section 10 (accurate information about the person who authorised the message and how to contact them). Spam Act 2003 (Cth) section 17 (accurate sender identification and contact information).

What the check finds: an active rep with email steps due and no `sender_details` on file. `draft-step` refuses to draft for that rep, and adds the details to every draft it writes.

## DO-NOT-CALL: the Australian Do Not Call Register

Source: [Do Not Call Register Act 2006 (Cth)](https://www.legislation.gov.au/C2006A00088/latest/text), section 11: no telemarketing call to an Australian number on the Register unless the account-holder consented (s 11(2)). Schedule 2 says consent to calls cannot be inferred from a published number.

What the check finds: a call step due for an Australian prospect marked `on_do_not_call` without `call_consent`. The step is held in the queue.

What it does not do: wash your list against the Register. Record the result of your wash (through ACMA's register service) on each prospect with `on_do_not_call`. New Zealand has no equivalent statutory register.

## Internal rules, not law

These show in `/attention`, not `/compliance`. Change them with `set`:

| Setting | Default | What it does |
|---|---|---|
| `reply_wait_days` | 1 | days a reply can wait before it is flagged |
| `quiet_account_days` | 30 | days without a touch before a target account counts as quiet |
| `collision_days` | 14 | window for spotting two reps working one account; `enrol` refuses without `--force` |
| `no_show_follow_up_days` | 2 | days after a no-show before a missing follow-up is flagged |
| `opt_out_working_days` | 5 | the legal window; lower it if your policy is faster |

Each rep's `daily_email_limit` is a mailbox safety limit, not law: `mailboxes` shows when the day's due emails exceed it.
