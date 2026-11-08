---
description: Log a touch that happened outside the queue: a reply, a call back, a LinkedIn message. A reply stops the sequence; an unsubscribe opts the person out everywhere.
---

```bash
npm run seq -- log <prospect> --outcome=<outcome> [--kind=email|call|linkedin|task|meeting] [--direction=in|out] [--note="what they said"] --actor="<operator>"
```

Outcomes: sent, done, no_answer, voicemail, connected, bounced, replied, positive, not_now, not_interested, referral, out_of_office, unsubscribe. Put their words in --note so the reply can be answered properly later.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
