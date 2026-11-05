# Jobat.be API Discovery

Discovery date: 2026-11-05. Re-verified from scratch with Impit `0.14.5` and the
live site. Every claim below was measured, not inherited from an older write-up.

## Selected flow

1. **Listing pages**: server-rendered HTML.
   - `https://www.jobat.be/nl/jobs/<category>` (also `/fr/emplois/...`, `/en/jobs/...`)
   - Keyword search: `/nl/jobs/results/<slug>`, `/fr/emplois/titres/<slug>`, `/en/jobs/results/<slug>`
   - Pagination: `?pagenum=N`, 50 cards per page.
2. **Job details**: HTML fragment from the internal endpoint:
   `https://www.jobat.be/api/jobat/jobdetail/getjobcontent?jobId=<ID>&filter=<FILTER>&logListClick=false&setMetaData=false&isResultsPage=true`

| Property | Listing | Detail |
|---|---|---|
| Method | GET | GET |
| Auth | none | none |
| Response | `text/html` | `text/html` |
| Pagination | `?pagenum=N` | n/a (one job per call) |
| Proof marker | `id="jobresults"` / `id="article_<id>"` | `"event":"job_information"` |

## Why this shape

No public JSON listing API exists. Probed and rejected:

| Candidate | Header profile | Result | Decision |
|---|---|---|---|
| `GET /nl/jobs/...` | chrome 100 to 151 | 403 Cloudflare "Just a moment..." | rejected |
| `GET /nl/jobs/...` | firefox 128 to 144 | 403 Cloudflare | rejected |
| `GET /nl/jobs/...` | ios18 | TLS connect failure in Impit | rejected |
| `GET /nl/jobs/...` | okhttp 3/4/5 | 200, 50 cards, `data-total` | **selected** |
| `GET /api/jobat/JobSearch/Results?keyword=...` | okhttp | 200 but empty `jobCard-searchResult` list | rejected |
| `POST /api/jobat/JobSearch/Box` | okhttp | 500 without a session token | rejected |
| `GET /nl/jobs/results/<slug>?format=json` | okhttp | still `text/html` | rejected |
| `GET m.jobat.be`, `mobile.jobat.be`, `api.jobat.be` | iOS / okhttp | 404 / DNS failure | rejected |
| Autocomplete JSON (`AutoCompleteJobTitle`, `AutoCompleteRegionsSearchBox`) | okhttp | 200 JSON, no job records | not a data source |
| JSON-LD `JobPosting` on listing | none | absent | n/a |

The site is Cloudflare-fronted. Whether a profile passes depends on the
TLS + header fingerprint, not on a cookie or token. okhttp fingerprints are
treated as app traffic and pass; desktop browser fingerprints are challenged.

## Profile matrix (measured)

Reality check from repeated probes on 2026-11-05: the set of profiles that pass
changes between runs from the same IP. Early probes had okhttp3/4/5 all at 200;
a later probe had only okhttp4 at 200 while okhttp3/5 returned 403. That is why
the actor rotates instead of pinning one profile.

| Profile | Listing | Detail |
|---|---|---|
| `okhttp5`, `okhttp4`, `okhttp3` | 200 (varies per probe) | 200 |
| `chrome`, `chrome151`, `firefox`, `firefox144` | 403 | 200 (intermittent) |
| `chrome124`, `chrome131`, `chrome136`, `chrome142` | 403 | 403 |
| `ios18` | connect error | connect error |
| `okhttp` (no version) | 403 | 200 |

Rotation order in `src/main.js`: `okhttp5 → okhttp4 → okhttp3 → chrome151 →
firefox144 → chrome`. A failed profile moves to the back of the queue, so a
working profile stays first for the rest of the run. Extra headers
(`accept-language`, `sec-fetch-*`, `referer`) were tested with and without; they
make no difference for okhttp profiles, so the actor lets Impit generate them.

The detail endpoint ignores `Accept-Language`, cookies, and locale path. It
always answers with English section labels and an `/en/` job URL. Employer text
inside the description keeps its original language, so `job_url` is taken from
the listing card to preserve the requested locale.

## Fields

From `dataLayer.push({event:"job_information", ...})` in the detail fragment:

`jobID`, `jobCompanyType`, `jobCompanyID`, `jobCompanyName`,
`jobCompanyGroupName`, `jobCompanyGroupID`, `jobProductID`, `jobCategory`,
`jobSubCategory1`, `jobSubCategory2`, `jobRegion`, `jobRegionZip`,
`jobApplicationType`, `jobLanguage`, `jobReqLanguage`, `jobReqDegree`,
`jobRegime`, `jobType`, `jobSalary`, `jobPof`, `jobApplySourceInternal`.

From schema.org microdata in the same fragment:
`datePosted`, `validThrough`, `description`, `data-joburl`.

From markup: `h2.JobDetails-contentTitle` (title), `div.JobDetails-contentSubtitle`
+ `div.JobDetails-contentParagraph` (description).

`job_url` is taken from the listing card so it keeps the requested locale;
the detail fragment always emits an `/en/` URL regardless of the request locale.

## Failure playbook

Read this file first, then reproduce the failing request before editing code.

1. **403 or "Just a moment..."**: the profile is challenged. Rotate to the next
   profile in `BROWSER_PROFILES`. The schema default is Belgium residential proxy,
   which is what gets through from Apify. A refused proxy exit triggers one fresh
   session, then one direct attempt as the last resort.
2. **403 on every profile from a datacenter IP**: Apify cloud IPs and the
   `BUYPROXIES94952` datacenter group are both refused. Unpinned residential
   exits are also blocked often; Belgium residential passes, which is why both
   the default and the fallback use `RESIDENTIAL` + `apifyProxyCountry: BE`.
   A refused Belgian exit still gets one fresh proxy session before giving up.
3. **200 but no `jobresults` marker**: the URL is a category overview, not a
   results page. `GET /nl/jobs?keyword=x` redirects to `/nl/jobs/functietitels`
   with zero cards. Use the results path (`normalizeStartUrl` handles this).
4. **200 but no `job_information`**: the detail endpoint shape changed. Check
   whether `dataLayer.push(` still exists; then update `extractDataLayerObjects`
   and `parseJobDetail`.
5. **`data-total="0"`**: the search genuinely has no matches. Not a failure.
6. **429 / 5xx**: bounded backoff with `Retry-After` support, then profile
   rotation. Nothing else to change.
7. **Pagination stops early**: check `data-pagesize` and `data-total`; the actor
   computes the last page from them and falls back to `data-pagination="next"`.

## Re-verification commands

```bash
node tools/probe.mjs         # profile matrix against the live listing page
npm start                    # end-to-end run with storage/key_value_stores/default/INPUT.json
```
