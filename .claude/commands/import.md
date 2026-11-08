---
description: Bring prospects and accounts across from an Outreach CSV export. Always a dry run first.
---

```bash
npm run seq -- import outreach --dir=<folder with prospects.csv and optional accounts.csv> --dry-run
npm run seq -- import outreach --dir=<folder> --source=outreach-<date> --actor="<operator>"
```

Read docs/replace-outreach.md first. Check the CSV headings against IMPORT_COLUMNS in scripts/sequences.mjs and add the export's own headings there if they differ. Show the dry-run counts and wait for a yes. Afterwards, Outreach holds no consent basis: list the imported prospects and work through /consent before any email step.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a prospect, account or rep from memory, and never invent a record or a reply. If a name matches more than one record, show the candidates and ask. Nothing here sends: drafts go to drafts/ and a person sends them from their own mailbox.
