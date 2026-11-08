---
description: Book a meeting for a prospect. Stops their sequence and moves them to the meeting stage.
---

```bash
npm run seq -- book-meeting <prospect> --on=YYYY-MM-DD [--rep=<rep>] --actor="<operator>"
```

Confirm the date and the rep taking it. Booking does not send a calendar invite: the rep does that from their own calendar.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
