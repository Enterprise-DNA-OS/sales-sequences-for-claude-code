# Moving off Outreach

You can run both side by side for a fortnight, then stop renewing seats.

## 1. Export from Outreach

Outreach exports prospect records as CSV from the Prospects list: select the prospects, open More options, choose Export, and either download (up to 200 records) or have the file emailed (up to 100,000). The file holds all prospect fields, when each was last updated and touched, the engagement score and the active and finished sequences ([Outreach help: export prospect records](https://support.outreach.io/support/solutions/articles/159000426222)). Some views need admin permissions.

Save it as `prospects.csv` in a folder. If you also export accounts, save that as `accounts.csv` in the same folder.

## 2. Import, dry run first

```bash
npm run seq -- import outreach --dir=imports/outreach --dry-run
npm run seq -- import outreach --dir=imports/outreach --source=outreach-2026-11 --actor="Your name"
```

The dry run saves nothing. The real run is all or nothing, keeps every original row in `import_records`, skips an unchanged repeat and stops on a changed one.

## What maps

| Outreach column (any of) | Here |
|---|---|
| Prospect ID, ID | the import key, so a repeat is skipped |
| First Name + Last Name, or Name | `prospects.name` |
| Emails, Email, Email Address (first address) | `prospects.email` |
| Title | `prospects.title` |
| Company, Account, Account Name | an account, matched by name or created |
| Work Phone, Mobile Phone, Phones (first number) | `prospects.phone` |
| Owner, Owner Name, Owner Email | a rep, matched by name or email or created |
| Stage | `prospects.stage`: Cold to new, Approaching to working, Replied and Interested to replied, Meeting to meeting, Qualified to opportunity, Not Now and Unresponsive to nurture, Bad Contact and Not Interested to disqualified |
| Opted Out, Unsubscribed, Opted Out At | `opted_out_on` and stage opted out (today's date when only a yes is given) |
| Country | NZ, AU or other |
| Last Touched At, Last Contacted | one history touch, "Last touch recorded in Outreach", so quiet accounts are right from day one |
| Tags, Source | `prospects.source` |

Accounts: Account ID, Name, Domain or Website, Industry, Owner, Country.

Column names differ between Outreach instances and custom fields. Add your own headings to `IMPORT_COLUMNS` in `scripts/sequences.mjs`, or ask Claude Code to map them.

## What does not carry over

- **Consent.** Outreach does not record why you may email someone. Every imported prospect arrives with no consent basis, so email steps hold until you record one with `/consent`. This is deliberate.
- **Sequences and templates.** Recreate each sequence you still use with `/new-sequence` (copy the step text in). Then enrol the people who were mid-sequence at the step they had reached.
- **Email and call history.** Only the last touch date comes across. Keep the Outreach export file for the full history.
- **Sending, tracking and the dialler.** See [why-no-front-end.md](why-no-front-end.md).

## Before you stop paying

Run the same week in both: today's queue, the replies waiting, the meetings booked, the opt-outs. Check every opt-out in Outreach is in `npm run seq -- opt-outs`. Then stop renewing seats.
