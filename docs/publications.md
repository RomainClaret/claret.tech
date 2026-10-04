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

## Linking the arXiv copy

`arxivId` renders a line under the action buttons: the arXiv wordmark, then a label
chosen by `arxivVariant`. Store the bare identifier, not a URL: `"2608.24480"`, or
`"2608.24480v2"` to pin a version. The line is absent when `arxivId` is.

```json
"arxivId": "2609.11518",
"arxivVariant": "accepted"
```

| `arxivVariant` | label             | use when                                                                                                                     |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| omitted        | published version | arXiv carries the paper as published                                                                                         |
| `extended`     | extended version  | the arXiv copy is longer than the published one                                                                              |
| `accepted`     | accepted version  | the arXiv copy is the authors' accepted manuscript, not the publisher's final version (true whether or not the paper is out) |

Labels live in `ARXIV_LABELS` in `src/components/sections/Papers.tsx`, not in the data, so
changing one is a single edit. The allowed values live in `ARXIV_VARIANTS` in
`src/lib/api/fetch-publications.ts`. A new variant goes in both, and the compiler flags a
missing label.

**Do not let a `to-appear` paper claim to be published.** `published version` is a claim
about the record, and omitting `arxivVariant` asserts it silently. The sync test fails on
any `to-appear` entry whose arXiv line would read `published version`.

**When arXiv is the only record, it is the paper.** A document with no published version
and none coming links arXiv as "Paper" (`paperUrl`, or a `footerLink` named `Paper`, as
`claret2026quadtree` does). Use `arxivId` where a published record exists or is on its
way and arXiv is the second copy. Both fields work on `papersCards` too.

`src/lib/api/publications-sync.test.ts` also rejects an `arxivId` that is not a bare
identifier, which is what catches a pasted abstract URL.

## What can and cannot run on its own

Nothing refreshes automatically. There is no cron.

- `.github/workflows/update-publications.yml` is `workflow_dispatch` only. Trigger it from the Actions tab; it opens a pull request rather than pushing, so the diff is reviewable.
- `npm install`, `npm run build` and `npm run dev` never touch publications data.
- A normal `GET /api/publications` reads the committed file and never refetches, at any cache age.
- `/api/publications?refresh=true` needs `&key=$PUBLICATIONS_REFRESH_TOKEN`. Without the variable set, refresh is off entirely. A wrong or absent key is served the committed data as an ordinary request, with no error.
- No request path writes `public/publications.json`. The script is the only writer.

## Fields the APIs never supply

`bibtex`, `shortDescription`, `starred`, `status`, `month`, `arxivVariant`, and the three PDF paths are hand-written. Semantic Scholar and ORCID do not return them, and the merge only overlays non-empty fetched values, so they are safe. `openAccessUrl` is deliberately emitted as `""` by the fetch layer for the same reason. `arxivId` is different: Semantic Scholar does return it, but only on uncurated entries. Both fetch paths drop the fetched copy of a curated paper by title before anything is merged, so a curated paper's `arxivId` is added by hand, in `static-publications.json` and `public/publications.json` alike. On an uncurated entry the arXiv line is not shown unless `arxivVariant` is set, since an uncurated paper, an arXiv-only preprint for one, must not be labelled as published. A curated paper whose title Semantic Scholar spells differently is not matched, and comes back as a separate uncurated duplicate, which the sync test catches.
