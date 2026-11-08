---
description: Check the records against the anti-spam and Do Not Call rules in docs/compliance.md: consent, opt-outs within 5 working days, sender details, and the Australian Do Not Call Register.
---

```bash
npm run seq -- compliance --json
npm run seq -- opt-outs --json
```

Read docs/compliance.md first. Report breaches first, then due, then checks, each with the rule and its source. For each breach say the fix: take the person out of the sequence (/opt-out), record consent (/consent), add sender details (npm run seq -- set sender <rep> --details=...), or skip the call. Nothing here is legal advice. If a rule looks out of date, say so and stop.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
