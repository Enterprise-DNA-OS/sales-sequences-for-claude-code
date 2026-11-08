# Operations: every command

Run any command with `npm run seq -- <command>`. Add `--json` for machine output. Names match by code, email, the start of an id, or any part of the name, ignoring case; when more than one record matches, the command lists them and exits 1. Every write takes `--actor="Your name"` and is recorded in `audit`. Nothing sends.

## Reads

| Command | What it shows |
|---|---|
| `tasks` | today's queue: every active step due or overdue, rep by rep, with a hold reason where it must not go |
| `replies` | replies with nothing back from us since, oldest first |
| `attention` | replies, holds, overdue steps, meetings, collisions, mailboxes and quiet accounts in one list |
| `compliance` | the rules in [compliance.md](compliance.md) checked against the records |
| `opt-outs` | the opt-out register: date, channel, must-stop-by date, last email, honoured or not |
| `prospects` | every prospect with stage, consent, sequence and last touch either way |
| `prospect <name>` | one prospect: consent, sequences, every touch, meetings |
| `accounts` | accounts by tier with owner, prospects and last touch |
| `quiet-accounts` | target accounts with no touch inside the quiet window and nobody in a sequence |
| `collisions` | accounts two or more reps have reached out to inside the collision window |
| `reps` | reps, roles, mailbox limits and sender details |
| `rep-activity` | each rep's last seven days and what is due now |
| `mailboxes` | emails sent today and due today against each mailbox's limit |
| `sequences` | enrolled, in progress, replies, meetings, opt-outs, bounces, reply and meeting rates |
| `sequence <code>` | one sequence: results, steps with numbers, people in it |
| `steps` | every step's sends, replies, positive replies and opt-outs |
| `enrolments` | who is in which sequence at which step |
| `touches` | the last 200 touches in and out |
| `meetings` | meetings with their issue (date passed, no-show with no follow-up, held with no next step) |
| `weekly-review` | compliance, replies, overdue steps, meetings, sequences, reps and quiet accounts |
| `settings`, `activity`, `import-history`, `help` | settings, the audit trail, what came in from Outreach |

## Writes

| Command | What it does |
|---|---|
| `add rep\|account\|prospect\|sequence --field=value` | add a record |
| `add-step <sequence> --kind= [--wait=] --subject= --body= \| --instructions=` | add a step; `{{first_name}}`, `{{account}}`, `{{industry}}` merge in drafts |
| `enrol <prospect> --sequence= [--rep= --start= --force]` | refuses opt-outs, someone already in a sequence, a bounced address on an email-first sequence, and an account another rep touched recently |
| `complete-step <enrolment\|prospect> [--outcome= --note= --date=]` | logs the touch, moves to the next step after its wait, finishes after the last; refuses a held step |
| `log <prospect> --outcome= [--kind= --direction= --note=]` | any touch; a reply stops the sequence and moves the stage; an unsubscribe runs `opt-out` |
| `opt-out <prospect> [--channel= --date=]` | stops every sequence today and fills the register |
| `pause`, `resume`, `remove <enrolment\|prospect>` | hold, restart or take someone out |
| `book-meeting <prospect> --on=` | books, stops the sequence, stage meeting |
| `meeting-outcome <meeting> --status=held\|no_show\|cancelled [--outcome= --next-step= --due= --opportunity]` | records what happened |
| `set-stage <prospect> --stage=` | move a prospect |
| `set consent <prospect> --basis= --note=` | record consent and its evidence |
| `set sender <rep> --details=` | the sender identification every message carries |
| `set <key> <value>` | a setting |
| `import outreach --dir= [--dry-run]`, `export [--dir=]` | in from an Outreach export; everything out as CSV |
| `draft-step <enrolment\|prospect>`, `draft-reply <prospect>` | drafts to `drafts/`, never sent |

## Documents and views

`npm run docs` writes the opt-out register (with consent on file for everyone in a sequence), a weekly scorecard per rep, and a playbook per sequence, into `docs-out/`. `npm run view` writes the week, today's queue and sequence results into `views/`. Both use `brand.json`. They hold personal contact details: keep them private.
