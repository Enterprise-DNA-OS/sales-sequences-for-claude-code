# Why there is no front end

A sales engagement platform is a database with a subscription. Underneath are ordinary records: prospects, accounts, sequences and their steps, who is in which sequence and at which step, every touch out and every reply in, opt-outs and meetings. What a team pays for is mostly the layer on top: the task list, the sequence builder, the dashboards, and the plumbing that sends email from each rep's mailbox.

The records part no longer needs a screen. Open this folder in Claude Code, ask "who replied this week and has not heard back?", and it runs the query and answers. Ask a question no dashboard was built for ("which step draws the opt-outs?") and you still get an answer.

## What you gain

- **Answers to your own questions.** The sales lead asks about replies and meetings, a rep asks for today's queue, the owner asks whether opt-outs are being honoured, each in plain words.
- **No seats.** Every rep, manager and founder can look. The bill does not grow with headcount.
- **Your records in a database you own.** Plain Postgres tables. Back them up, query them from anything, leave any time.
- **Rules that hold the line.** A step for someone who opted out, has no consent recorded, bounced, or sits on the Do Not Call Register is held, with the reason, before anyone touches it.

## What a screen gives that this does not

Be honest about it before you switch:

- **Sending.** This base drafts every email with merge fields, sender details and an unsubscribe line. The rep sends it from their own mailbox and marks the step done. Automatic sending, open tracking and click tracking need a connection to your mail system.
- **A dialler.** Calls are logged by command. Click-to-call, recording and call transcripts need a phone system.
- **A rep's all-day screen.** Some reps want a list they click through. Here the list is `/today`.
- **A CRM sync.** This base is the prospecting record. Pushing meetings and opportunities into your CRM is a connection to build.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for teams that want someone to call.

Enterprise DNA builds the pieces a team actually needs (sending from your mailboxes, a rep's queue screen, the CRM sync) on top of the same database, so the records stay yours.

## Who this fits

Sales teams of two to fifty who sell to businesses, run a handful of sequences, and want the answers more than the screens.

Installed and run for you: https://enterprisedna.co/omni/instead-of/outreach
