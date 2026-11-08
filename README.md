<h1 align="center">Sales Sequences for Claude Code</h1>

<p align="center">
  <strong>The open-source sales sequence system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Outreach data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=outreach">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/outreach?utm_source=github&utm_medium=readme&utm_campaign=outreach">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-outreach">Instead of Outreach</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Sales Sequences for Claude Code does the outbound work a sales team pays Outreach for, as a Postgres database and a set of agent commands: prospects and accounts, multi-step sequences of emails, calls, LinkedIn touches and tasks, each rep's daily queue, every touch and reply, opt-outs, meetings, and the results by sequence and by step. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask in plain language.

Outreach prices on request: a seat for each user plus usage credits, with plans from Amplify Essentials to Amplify Pro ([pricing page](https://www.outreach.ai/pricing)). Buyer-report sites estimate the entry plan near US$100 a user a month; that is an estimate, not a vendor price ([research](docs/research.md)). Bring your own invoice to compare.

It is for business-to-business sales teams in New Zealand and Australia: the reps who work the queue, the sales lead who runs the Monday review, and the owner who needs to know opt-outs are honoured. Every step for someone who opted out, has no consent recorded, bounced, or sits on the Australian Do Not Call Register is held before anyone touches it.

Want sending from your own mailboxes, a queue screen for reps, or a sync to your CRM? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=outreach).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your records sit in plain Postgres tables you own. Any tool can read them. No lock-in.
- No seats. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what a screen and a sending engine still do better.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node 20 or later):

```bash
git clone https://github.com/Enterprise-DNA-OS/sales-sequences-for-claude-code.git
cd sales-sequences-for-claude-code
npm install
npm run demo
npm run seq -- tasks
```

Then open the folder in Claude Code and type `/today`.

The demo is Harbour Analytics, a fictional Auckland software company with three people selling to transport firms in New Zealand and Australia: twelve accounts, fifteen prospects, three sequences, and deliberately a positive reply nobody has answered for three days, an opt-out still in a sequence and emailed after the 5 working day limit, an email due with no consent recorded, a rep with no sender details, an Australian number on the Do Not Call Register, a no-show with no follow-up, two reps working the same accounts and a tier A account gone quiet. Seed only a disposable demo database.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared records, no per-seat fee.

## The daily and weekly rituals

| Command | What it does |
|---|---|
| `/today` | each rep's queue: steps due and overdue, held steps with the reason |
| `/replies` | replies nobody has answered, oldest first |
| `/attention` | replies, holds, overdue steps, meetings, collisions, mailboxes and quiet accounts in one list |
| `/weekly-review` | the Monday review: compliance, replies, each rep's week, sequence results, quiet accounts |
| `/compliance` | consent, opt-outs within 5 working days, sender details and the Do Not Call Register, with sources |
| `/draft-step` | the due email drafted with merge fields, sender details and an unsubscribe line |
| `/complete-step` | mark a step done and move to the next |
| `/log` | a reply, call back or message; a reply stops the sequence |
| `/opt-out` | stop every sequence today and record it in the register |
| `/consent` | record why you may email someone, with the evidence |
| `/enrol` | put someone in a sequence; refuses opt-outs and collisions |
| `/sequences`, `/sequence` | which sequences and which steps earn replies and meetings |
| `/new-sequence` | write a sequence from a brief, steps approved before they are saved |
| `/meetings`, `/book-meeting` | meetings booked, held, missed, and the follow-up owed |
| `/rep-activity` | each rep's last seven days and mailbox load |
| `/collisions` | accounts two reps are working at once |
| `/accounts` | target accounts and the quiet ones nobody is working |
| `/prospects`, `/prospect` | the people, and one person's full history |
| `/draft-reply` | a reply drafted from what they said |
| `/import`, `/export` | bring an Outreach export in; take everything out as CSV |
| `/activity` | who changed what |
| `/customise`, `/new-view` | change a field, a rule or a report in plain language |

41 CLI commands sit underneath: [docs/operations.md](docs/operations.md).

## Ten questions you can answer today

Each runs against the demo records now. No claim is made that Outreach cannot answer them.

1. Which replies has nobody answered yet, and how long have they waited? `replies`
2. Is anyone who opted out still in a sequence, and has anyone been emailed after the 5 working day limit? `compliance`, `opt-outs`
3. Who is about to get an email with no consent on file? `tasks`
4. Which steps are overdue today, rep by rep? `tasks`
5. Which sequence books the most meetings per hundred people enrolled? `sequences`
6. Which step gets the replies, and which step draws the opt-outs? `steps`
7. Which accounts have two reps reaching out at once? `collisions`
8. Which tier A accounts have gone quiet with nobody in a sequence? `quiet-accounts`
9. Which meetings were no-shows with no follow-up, or held with no next step? `meetings`
10. Whose mailbox is over its daily limit today? `mailboxes`

## Instead of Outreach

Export prospects (and accounts, if you want them) from Outreach as CSV, then:

```bash
npm run seq -- import outreach --dir=imports/outreach --dry-run
```

The dry run saves nothing. The real run is all or nothing, keeps every original row, skips unchanged repeats and stops on a changed one. Opt-outs come across into the register. Outreach holds no consent basis, so email steps for imported people hold until you record one. Full guide, including what does not carry over: [docs/replace-outreach.md](docs/replace-outreach.md).

## Documents and views

Edit `brand.json` for your business name, logo and colours. `npm run docs` writes the opt-out register with the consent on file, a weekly scorecard for each rep and a playbook for each sequence. `npm run view` writes the week, today's queue and sequence results pages. They hold personal contact details: keep them private.

## Your first hour: ten things to ask for

1. Put our name and colours on the views and documents.
2. Show me every reply waiting, and draft answers to the positive ones.
3. Take everyone who opted out out of every sequence, and show me the register.
4. Who is in a sequence with no consent recorded? Walk me through them.
5. Add my sender details so every draft says who sent it.
6. Write a three-step sequence for operations managers who downloaded our guide.
7. Enrol the prospects at our quiet tier A accounts into it.
8. Which step of our cold sequence should we rewrite?
9. Our collision window is 30 days, not 14. Change it.
10. Add a "lead source" report: meetings booked by where the prospect came from.

## Architecture

```
sales-sequences-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  fixtures/outreach/        a sample Outreach export the tests import
  views.json, documents.json  the views and documents, in your brand
  docs/                     compliance, operations, research and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Sales Sequences for Claude Code for your business, migrates your Outreach data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=outreach)
- Read more: [enterprisedna.co/omni/instead-of/outreach](https://enterprisedna.co/omni/instead-of/outreach?utm_source=github&utm_medium=readme&utm_campaign=outreach)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
