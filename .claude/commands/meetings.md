---
description: Meetings booked, held and missed, and the ones that need an update or a follow-up.
---

```bash
npm run seq -- meetings --json
```

Issues first: dates passed with no outcome, no-shows with no follow-up, held meetings with no next step or an overdue one. To book: npm run seq -- book-meeting <prospect> --on=YYYY-MM-DD. To record: npm run seq -- meeting-outcome <MTG> --status=held|no_show|cancelled [--outcome=...] [--next-step=...] [--due=...] [--opportunity].

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
