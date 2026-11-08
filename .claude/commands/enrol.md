---
description: Put a prospect into a sequence. Refuses anyone who opted out, anyone already in a sequence, and an account another rep touched recently unless agreed.
---

```bash
npm run seq -- enrol <prospect> --sequence=<code or name> [--rep=<rep>] [--start=YYYY-MM-DD] --actor="<operator>"
```

Check consent first with /prospect: someone with no consent basis can be enrolled but every email step will hold until it is recorded. If the command reports a collision, name the other rep and ask who works the account before using --force.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
