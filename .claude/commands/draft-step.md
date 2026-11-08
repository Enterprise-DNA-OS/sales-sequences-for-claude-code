---
description: Draft the email for a prospect's due step, merge fields filled, sender details and an unsubscribe line added. Refuses held steps.
---

```bash
npm run seq -- draft-step <enrolment or prospect>
```

Show the draft and its file path. The rep sends it from their own mailbox, then runs /complete-step. Improve the wording only if asked, and keep the sender details and unsubscribe line.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
