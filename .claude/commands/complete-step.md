---
description: Mark the current step done (the email was sent, the call was made) and move the prospect to the next step.
---

```bash
npm run seq -- complete-step <enrolment or prospect> [--outcome=sent|voicemail|no_answer|connected|bounced|done] [--note="..."] --actor="<operator>"
```

Use the outcome the rep reports. A bounce stops the sequence and flags the address. The last step finishes the sequence. If the step is on hold, say why and do not force it.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
