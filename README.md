## What does Jobat.be Jobs Scraper do?

Jobat.be Jobs Scraper collects public job listings from [Jobat.be](https://www.jobat.be/) and saves one record per job for recruitment research, job-market analysis, and recurring hiring reports. Start from a Jobat search URL or enter a keyword such as `software developer`, then choose how many jobs and result pages to collect.

Each record can include the job title, employer, posting and expiry dates, description, direct job link, category, region, language requirement, education requirement, work regime, contract type, and salary information. Empty values are omitted, so the dataset stays compact when a listing does not publish a field.

## Why use Jobat.be Jobs Scraper?

- Collect Belgian vacancy data without copying listings into a spreadsheet by hand.
- Compare titles, employers, categories, regions, contract types, and work regimes across current listings.
- Run the same keyword or search page on a schedule to track new and removed jobs.
- Feed direct job URLs, descriptions, and employer names into sourcing and review workflows.
- Study demand across Dutch, French, and English Jobat listings.
- Download results as JSON, CSV, Excel, or XML, or pass them to another workflow through Apify integrations.

## What data can you extract from Jobat.be?

The Actor saves one dataset item per discovered job. The source does not publish every field for every listing.

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | String | Jobat identifier for the listing. |
| `title` | String | Published job title. |
| `company` | String | Employer or recruiting organization name. |
| `description_html` | String | Formatted job description with headings, paragraphs, and lists. |
| `description_text` | String | Plain-text job description for search, analysis, and reporting. |
| `job_url` | String | Direct Jobat URL for the job details page, in the requested language. |
| `listing_url` | String | Job URL found on the search results page. |
| `source_search_url` | String | Search page from which the listing was collected. |
| `source_index` | Number | Position of the listing on its source results page. |
| `date_posted` | String | Date the employer published the job, as `YYYY-MM-DD`. |
| `valid_through` | String | Date the listing stops accepting applications, as `YYYY-MM-DD`. |
| `category` | String | Primary Jobat job category. |
| `sub_category_1` | String | First-level job subcategory. |
| `sub_category_2` | String | Second-level job subcategory. |
| `region` | String | Jobat region or locality label. |
| `region_zip` | String | Postal code associated with the region. |
| `company_type` | String | Employer or advertiser classification. |
| `company_group_name` | String | Company group label. |
| `language` | String | Language code associated with the job. |
| `required_language` | String | Required language profile. |
| `required_degree` | String | Required education or degree. |
| `regime` | String | Work regime, such as full time or part time. |
| `contract_type` | String | Contract classification, such as fixed or temporary. |
| `salary_type` | String | Salary or compensation classification. |
| `application_type` | String | Application flow classification. |
| `fetched_at` | String | ISO timestamp for when the record was saved. |
| `detail_error` | String | Error message when listing data was saved but the full job details were unavailable. |

## How to use Jobat.be Jobs Scraper

1. Open the Actor in Apify Console.
2. Leave `startUrl` as it is, paste another public Jobat search URL, or enter a `keyword`.
3. Set `results_wanted` to the maximum number of jobs you want to save.
4. Set `max_pages` to control how many result pages the Actor can process.
5. Start the run and review the dataset preview.
6. Download the results or connect the dataset to your recruitment, research, or reporting workflow.

Use `startUrl` when you want to keep the filters already selected on Jobat.be, for example a category page or a region filter. Use `keyword` when you want a plain text search. When both are supplied, `keyword` wins and the URL is ignored.

## Input Parameters

All parameters are optional. With no input at all, the Actor collects the Jobat administration category.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | `https://www.jobat.be/nl/jobs/administratie` | Public Jobat search URL to start from. Ignored when `keyword` is supplied. |
| `keyword` | String | No | none | Job title, skill, or search phrase, such as `software developer`, `verpleegkundige`, or `administratie`. Takes precedence over `startUrl`. |
| `results_wanted` | Integer | No | `20` | Maximum number of job records to save. Must be at least `1`. |
| `max_pages` | Integer | No | `5` | Maximum number of result pages to process. Must be at least `1`. |
| `proxyConfiguration` | Object | No | Apify residential proxy, country `BE` | Proxy used to reach Jobat.be. Belgium residential is the default because datacenter IPs and unpinned residential exits are often refused. Replace it with your own proxy or disable it only if your connection is accepted. |

The Actor stops when it reaches `results_wanted`, when there are no more result pages, or when it reaches `max_pages`.

## Output Data

Each dataset item is a JSON object containing the non-empty fields available for that listing. Detail fields are absent when the listing does not publish them. If the listing was found but its full details could not be collected, the record is still saved with `detail_error`, so one unavailable listing does not remove the run result.

The fields used most often are `title`, `company`, `region`, `regime`, `contract_type`, `salary_type`, `date_posted`, `description_text`, `job_url`, and `fetched_at`. Use `description_html` when you need to keep basic formatting for a downstream display.

## Usage Examples

### Basic category collection

Collect up to 20 jobs from the prefilled administration search and process up to three result pages.

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "results_wanted": 20,
  "max_pages": 3
}
```

### Keyword search

Search for software developer roles and save up to 50 matching records.

```json
{
  "keyword": "software developer",
  "results_wanted": 50,
  "max_pages": 5
}
```

### Larger scheduled market snapshot

Collect a larger administration dataset for a recurring report.

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "results_wanted": 100,
  "max_pages": 10
}
```

### French listings

Paste a French Jobat URL to keep the French titles and descriptions.

```json
{
  "startUrl": "https://www.jobat.be/fr/emplois/administration",
  "results_wanted": 50,
  "max_pages": 5
}
```

### Change the proxy

The default is Apify residential proxy with country `BE`, because Jobat.be refuses datacenter IPs and unpinned residential exits are often blocked. Keep it unless you have a reason to change it.

Use your own proxy:

```json
{
  "keyword": "software developer",
  "results_wanted": 50,
  "max_pages": 5,
  "proxyConfiguration": {
    "proxyUrls": ["http://user:pass@host:port"]
  }
}
```

Disable the proxy when your own connection is accepted:

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

## Sample Output

One dataset item, trimmed for length. Optional fields are omitted when Jobat.be does not publish them for a job.

```json
{
  "job_id": "6470709",
  "title": "Office Manager",
  "company": "IVM Milieubeheer",
  "description_html": "<p>Je organiseert en coördineert de dagelijkse werking van het secretariaat.</p><strong>Profile</strong><ul><li>Je bent een coachende leidinggevende</li></ul>",
  "description_text": "Je organiseert en coördineert de dagelijkse werking van het secretariaat. Profile Je bent een coachende leidinggevende",
  "job_url": "https://www.jobat.be/nl/jobs/office-manager/job_6470709",
  "listing_url": "https://www.jobat.be/nl/jobs/office-manager/job_6470709",
  "source_search_url": "https://www.jobat.be/nl/jobs/administratie",
  "source_index": 1,
  "date_posted": "2026-11-04",
  "valid_through": "2027-01-03",
  "category": "Administration",
  "sub_category_1": "Management assistant / secretary",
  "region": "Eeklo",
  "region_zip": "9900",
  "company_type": "Company",
  "company_group_name": "Administrative, Office and Public Services - NL",
  "language": "N",
  "required_language": "#NL#",
  "required_degree": "Professional bachelor (Higher Education Short Type)",
  "regime": "Full Time",
  "contract_type": "Fixed",
  "salary_type": "benefits",
  "application_type": "external",
  "fetched_at": "2026-11-05T15:05:28.176Z"
}
```

## Tips for Best Results

- Use a specific role or category URL for a focused dataset.
- Use a prepared `startUrl` to keep the category, language, region, and other filters you selected on Jobat.be.
- Start with `results_wanted` set to `20` and inspect the dataset before requesting more.
- Raise `max_pages` for result sets larger than the first page. The Actor still stops at `results_wanted`.
- Reuse the same keyword or URL, result limit, and page cap when comparing scheduled snapshots.
- Expect some fields to be absent. Salary signals, language requirements, education, and descriptions are optional on Jobat.be.
- Open `job_url` to confirm a listing before acting on it.
- Report a broken search through the Issues tab with the URL and run details.

## Integrations and Export Formats

- Google Sheets: share records with recruiters, analysts, and hiring managers.
- Airtable: build a searchable database of Belgian vacancies.
- Webhooks: send completed run notifications or dataset links to another service.
- Make or Zapier: route new records into alerts, email, or a CRM.
- Apify API: start runs and read dataset records from your own application.
- JSON: use structured records in data pipelines and applications.
- CSV and Excel: filter and report in spreadsheet tools.
- XML: support systems that require XML exchange.

## Frequently Asked Questions

### Can I search Jobat.be by keyword?

Yes. Set `keyword` to a job title, skill, or phrase such as `software developer` or `verpleegkundige`. If you already configured filters on Jobat.be, paste the resulting URL into `startUrl` instead.

### What happens if I set both a keyword and a start URL?

The keyword wins and the URL is ignored. Clear the field you do not want before starting the run.

### Can I use a prepared Jobat search URL?

Yes. Paste a public Jobat search results URL into `startUrl`. This keeps any category, region, language, or other filters already selected on the website.

### Can I collect multiple searches in one run?

The input accepts one search per run. Create one run per search and combine the datasets afterward, or schedule each search separately.

### How many jobs can I collect?

The final count is limited by `results_wanted`, `max_pages`, and the number of matching public listings. Start small and check the dataset before raising the limits.

### Does the Actor collect job descriptions?

Yes. When a listing provides description content, the record includes `description_html` and `description_text`. Some employers publish only a short summary.

### Why are some fields missing?

Jobat listings do not always publish salary information, education requirements, language requirements, or other optional fields. Empty values are omitted instead of filled with guesses.

### What happens if a job's details cannot be collected?

The Actor saves the listing data it has and adds `detail_error` with the reason. The rest of the run continues.

### Why does a run fail with HTTP 403?

Jobat.be uses a bot check that refuses datacenter connections. The Actor rotates between six request profiles and retries with backoff. It also uses Belgium residential proxy by default, which is billed as proxy bandwidth on your account. If the proxy itself is refused, the Actor retries with a fresh proxy session, then makes one direct attempt.

### Can I export Jobat.be data to CSV or Excel?

Yes. Apify datasets can be downloaded as CSV, Excel, JSON, XML, and other supported formats.

### Can I schedule recurring Jobat.be searches?

Yes. Create an Apify schedule to run a keyword or prepared URL hourly, daily, or weekly. Scheduling is useful for new-job alerts and hiring trend reports.

### Is it legal to collect Jobat.be data?

Public data collection can be subject to applicable laws, privacy requirements, and Jobat.be's terms. You are responsible for using the data lawfully, respecting access restrictions, and handling personal information appropriately.

## Related Actors

- [Fast LinkedIn Job Scraper](https://apify.com/shahidirfan/fast-linkedin-job-scraper) - Collect public LinkedIn job listings for broader role, employer, and location research.
- [HelloWork Jobs Scraper](https://apify.com/shahidirfan/hellowork-jobs-scraper) - Gather structured job records from HelloWork for French-market comparisons.
- [Foundit Jobs Scraper](https://apify.com/shahidirfan/foundit-jobs-scraper) - Collect job listings with descriptions, salary information, experience, and skills from Foundit.in.
- [Jobs.cz Scraper](https://apify.com/shahidirfan/jobs-cz-scraper) - Collect Czech job listings for cross-market hiring research and employment analysis.

## Support

For issues, feature requests, or source changes, use the Issues tab on the Actor page or contact the developer through Apify.

## Legal Notice

This Actor is intended for legitimate collection of publicly available Jobat.be job information. Users are responsible for complying with Jobat.be terms, applicable laws, privacy requirements, and any restrictions that apply to their intended use of the data.
