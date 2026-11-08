---
description: Write a new sequence from the operator's brief: who it is for, the offer, how many touches over how long.
---

```bash
npm run seq -- add sequence --name="<name>" --purpose="<who and why>" --owner=<rep>
npm run seq -- add-step <SEQ> --kind=email --wait=0 --subject="..." --body="..."
npm run seq -- add-step <SEQ> --kind=call --wait=2 --instructions="..."
```

Draft the steps in chat first and wait for a yes. Keep emails short, specific to the buyer's work, one ask each, merge fields {{first_name}}, {{account}}, {{industry}}. Mix channels. The last step closes the loop politely. Then add them in order.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
