# Publications data

The Paper Trail section is fed by two lists that are maintained differently.

|             | Peer-Reviewed Publications                         | Other Work                                                   |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------ |
| source      | `src/lib/api/static-publications.json`             | `papersSection.papersCards` in `src/data/sections/papers.ts` |
| served from | `public/publications.json` via `/api/publications` | imported directly                                            |
| citations   | from the academic APIs                             | hand-written `citations` field, no feed exists               |

Both feed `src/lib/pdf-registry.ts`, so every entry with a local PDF also gets a `/pdf/<slug>` page and a sitemap entry.

## The three files that must agree

1. **`src/lib/api/static-publications.json`** is the source of truth. The app imports it (re-exported as `STATIC_PUBLICATIONS`) and `scripts/fetch-publications.js` reads the same file, so the two cannot drift.
2. **`public/publications.json`** is what `/api/publications` serves, and it is authoritative at runtime regardless of age. It is the same array plus `lastUpdated`, `count` and `totalCitations`.
3. `papersSection.papersCards` must not name a document that is also in the publications list, or it renders twice.

`src/lib/api/publications-sync.test.ts` enforces all three. If you edit one file, run the tests before committing.

## Adding or editing a publication

Edit `src/lib/api/static-publications.json`, then run:

```
npm run fetch:publications
```

That merges your change into `public/publications.json`, refreshes citation counts from Semantic Scholar, and sorts. It preserves everything it did not fetch, so hand-written fields (`bibtex`, `shortDescription`, `abstract`, `paperPdf`, `posterPdf`, `presentationPdf`, `starred`, `status`, `openAccessUrl`) survive. Re-running with nothing to change is a no-op and leaves `lastUpdated` alone.

The script refuses to run if `public/publications.json` is missing rather than regenerating it, because a tracked file going absent means something is wrong and a rebuild would drop any fetched entry that is not in the static list.

## Moving a publication to Other Work

Remove it from `static-publications.json` **and** `public/publications.json`, fixing `count` and `totalCitations`, then add a card to `papersCards`. Carry its citation count across on the card, or it disappears from the header total. See commit `21c2246` for a worked example.

Nothing records that an entry was removed on purpose, so if an academic API lists it again it comes back as an uncurated duplicate. The sync test is what catches that.

## What can and cannot run on its own

Nothing refreshes automatically. There is no cron.

- `.github/workflows/update-publications.yml` is `workflow_dispatch` only. Trigger it from the Actions tab; it opens a pull request rather than pushing, so the diff is reviewable.
- `npm install`, `npm run build` and `npm run dev` never touch publications data.
- A normal `GET /api/publications` reads the committed file and never refetches, at any cache age.
- `/api/publications?refresh=true` needs `&key=$PUBLICATIONS_REFRESH_TOKEN`. Without the variable set, refresh is off entirely. A wrong or absent key is served the committed data as an ordinary request, with no error.
- No request path writes `public/publications.json`. The script is the only writer.

## Fields the APIs never supply

`bibtex`, `shortDescription`, `starred`, `status`, `month`, and the three PDF paths are hand-written. Semantic Scholar and ORCID do not return them, and the merge only overlays non-empty fetched values, so they are safe. `openAccessUrl` is deliberately emitted as `""` by the fetch layer for the same reason.
