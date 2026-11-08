# Sales Sequences for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| what is due today / my queue | `/today` |
| who replied / who is waiting on us | `/replies` |
| what needs attention | `/attention` |
| the Monday review | `/weekly-review` |
| are we compliant / opt-outs / consent check | `/compliance` |
| draft the next email for someone | `/draft-step` |
| I sent it / I called them | `/complete-step` |
| they replied / log a touch | `/log` |
| they asked to stop | `/opt-out` |
| record consent for someone | `/consent` |
| add someone to a sequence | `/enrol` |
| how are our sequences doing | `/sequences` |
| one sequence in detail | `/sequence` |
| write a new sequence | `/new-sequence` |
| meetings and no-shows | `/meetings` |
| book a meeting | `/book-meeting` |
| rep activity / mailbox load | `/rep-activity` |
| two reps on one account | `/collisions` |
| accounts and quiet accounts | `/accounts` |
| prospects list | `/prospects` |
| one person's history | `/prospect` |
| reply to someone | `/draft-reply` |
| bring Outreach data in | `/import` |
| take everything out | `/export` |
| who changed what | `/activity` |
| change a field, stage or rule | `/customise` |
| a new report page | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run seq -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- Never draft, complete or suggest a step that is on hold. A hold means opted out, no consent recorded, a bounced address, or an Australian number on the Do Not Call Register. Say what clears it.
- An opt-out is acted on the moment it is seen: run `/opt-out` the same turn.
- Never record a consent basis without the operator naming the evidence.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Outreach.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/outreach
