---
description: Today's queue for a rep or the whole team: every step due, overdue first, with anything on hold and why.
---

```bash
npm run seq -- tasks --json
```

Group by rep. For each rep list the steps that can go now (emails, calls, LinkedIn, tasks), oldest first, then the held ones with the hold reason. Never suggest working a held step: say what clears the hold (record consent with /consent, a new email address, take them out of the sequence). If a rep's mailbox is over its daily limit (npm run seq -- mailboxes), say which emails to move to tomorrow. End with the count of steps due and how many are late.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
