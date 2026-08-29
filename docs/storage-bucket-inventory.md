# Storage bucket inventory

What is in each Supabase Storage bucket, whether it is public, and why.

Opened under LEGAL-006 (prd.json). Last updated 2026-08-18.

## Read this before changing a bucket

`getPublicUrl()` returns a URL string whether or not the bucket is public. So
reading the application code tells you nothing about whether an object can be
fetched without credentials, and a private-looking code path can be serving a
world-readable object. That is how QBR decks, which carry a customer's fleet,
usage and spend, came to be served by permanent unauthenticated links.

The test that matters is not "what does the code call" but **"what does an
anonymous GET return"**. `npm run storage:audit` answers it.

## Intended state

| Bucket               | Visibility | Holds                                           | Served via                       |
| -------------------- | ---------- | ----------------------------------------------- | -------------------------------- |
| `files`              | private    | Arbitrary customer uploads                      | Authenticated edge function      |
| `meeting-recordings` | private    | Recorded conversations                          | Server-side `download()`         |
| `qbr-artifacts`      | private    | Quarterly business reviews: fleet, usage, spend | Short-lived signed URLs (15 min) |
| `branding-assets`    | **public** | Tenant logos                                    | Public URL, by design            |
| `blog-assets`        | **public** | Images in published blog posts                  | Public URL, by design            |

The two public buckets are deliberate. A logo is rendered in quotes, proposals
and customer portals, and a blog image is referenced from a published page;
both are meant to be fetchable by anyone. Nothing except brand imagery belongs
in `branding-assets`, and nothing except post imagery in `blog-assets`. If
something else needs storing, it needs a different bucket, not an exception.

`drizzle/migrations/_pin_storage_bucket_visibility.sql` pins this table into the
database so the state is reproducible rather than whatever was last clicked in a
dashboard.

## Live state: NOT YET VERIFIED

**Nobody has confirmed the above against the running project.** This environment
has no Supabase credentials, so the visibility flags here are the intended
state, not an observation.

To fill this in, run:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run storage:audit -- --markdown
```

and paste the table below, replacing this section. The script lists every
bucket, compares it to the intended state above, and for each public bucket
performs an unauthenticated GET against one object, so the result says what an
outsider can actually fetch.

<!-- paste `npm run storage:audit -- --markdown` output here -->

### If the QBR bucket comes back public

Treat every object in it as disclosed. Those are customer business reviews, and
a public bucket means the link worked for anyone who had it, with no expiry and
no access log tying a fetch to an account. Whether that rises to a notifiable
breach is a decision for counsel, not something to resolve by flipping the flag
and moving on. Flip it, then assess.

## Bucket name disagreement (resolved in code, unresolved in reality)

The Express route defaulted to `qbr` and the edge function to `qbr-artifacts`,
so the two halves of the same feature disagreed about where decks live. Both
now resolve through one setting, defaulting to `qbr-artifacts` because the edge
function is what serves production.

If the live bucket turns out to be named `qbr`, set `QBR_STORAGE_BUCKET=qbr`
rather than editing the default, and note it here. Artifacts written by the
Express path before this change are in whichever bucket that path was using.

## Orphaned objects

`npm run storage:orphans` reports objects no database row references. Three
edge functions leaked them before LEGAL-003, so there is a backlog that fixing
the code does not clear. It reports by default and needs `--bucket` plus
`--purge` to delete anything.
