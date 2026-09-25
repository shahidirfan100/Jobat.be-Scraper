## What does Jobat.be Jobs Scraper do?

Jobat.be Jobs Scraper collects public job listings from [Jobat.be](https://www.jobat.be/) and saves them as structured records for recruitment research, job-market analysis, lead generation, and recurring hiring reports. Start with a Jobat search URL or enter a keyword such as `software developer`, then choose how many jobs and result pages to collect.

Each record can include the job title, employer, description, direct job links, category, region, language requirements, education requirements, work regime, contract type, salary information, and collection timestamp. Empty values are omitted, so the dataset stays compact when a listing does not publish a particular field.

## Why use Jobat.be Jobs Scraper?

- **Build Belgian hiring datasets** - Collect structured listings from Jobat.be without manually copying job information into spreadsheets.
- **Research roles and employers** - Compare job titles, companies, categories, regions, contract types, and work regimes across current listings.
- **Monitor recruitment activity** - Run the same keyword or search page on a schedule to track changes in available jobs.
- **Support recruitment workflows** - Use direct job URLs, descriptions, employer names, and classification fields for sourcing and review.
- **Analyze the Belgian job market** - Study demand across Flemish, French, English, and other available Jobat listings.
- **Export and automate results** - Download the dataset as JSON, CSV, Excel, or XML, or connect completed runs to another workflow through Apify integrations.

## What data can you extract from Jobat.be?

The Actor saves one dataset item per discovered job. The source may not publish every field for every listing.

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | String | Jobat identifier for the listing. |
| `title` | String | Published job title. |
| `company` | String | Employer or recruiting organization name. |
| `description_html` | String | Formatted job description when available. |
| `description_text` | String | Plain-text job description for search, analysis, and reporting. |
| `job_url` | String | Direct Jobat URL for the job details page. |
| `listing_url` | String | Job URL found on the search results page. |
| `source_search_url` | String | Search page from which the listing was collected. |
| `source_index` | Number | Position of the listing on its source results page when available. |
| `category` | String | Primary Jobat job category. |
| `sub_category_1` | String | First-level job subcategory. |
| `sub_category_2` | String | Second-level job subcategory. |
| `region` | String | Jobat region or locality label. |
| `region_zip` | String | Postal code associated with the region when available. |
| `company_type` | String | Employer or advertiser classification when available. |
| `company_group_name` | String | Company group label when published. |
| `language` | String | Language code associated with the job. |
| `required_language` | String | Required language profile when published. |
| `required_degree` | String | Required education or degree information. |
| `regime` | String | Work regime, such as full time or part time. |
| `contract_type` | String | Contract classification, such as fixed or temporary. |
| `salary_type` | String | Salary or compensation classification when available. |
| `application_type` | String | Application flow classification when available. |
| `fetched_at` | String | ISO timestamp for when the record was saved. |
| `detail_error` | String | Error message when listing data was saved but additional job details were unavailable. |

## How to use Jobat.be Jobs Scraper

1. Open the Actor in Apify Console.
2. Enter a `keyword`, or paste a public Jobat search URL into `startUrl`.
3. Set `results_wanted` to the maximum number of jobs you want to save.
4. Set `max_pages` to control how many result pages the Actor can process.
5. Start the run and review the dataset preview.
6. Download the results or connect the dataset to your recruitment, research, or reporting workflow.

Use a prepared `startUrl` when you want to preserve filters already selected on Jobat.be. Use `keyword` when you want to search for a role without preparing a full search URL. When a custom `startUrl` is supplied, it is used as the starting page.

## Input Parameters

All parameters are optional. If no search input is supplied, the Actor uses the prefilled Jobat administration search page.

| Parameter | Type | Required | Default or prefill | Description |
|-----------|------|----------|--------------------|-------------|
| `startUrl` | String | No | `https://www.jobat.be/nl/jobs/administratie` | Public Jobat search URL to use as the starting page. |
| `keyword` | String | No | Prefilled: `software developer` | Job title, skill, or search phrase. For example, `software developer`, `verpleegkundige`, or `administratie`. |
| `results_wanted` | Integer | No | `20` | Maximum number of job records to save. The value must be at least `1`. |
| `max_pages` | Integer | No | `5` | Maximum number of Jobat result pages to process. The value must be at least `1`. |
| `proxyConfiguration` | Object | No | `useApifyProxy: true` | Proxy used when Jobat.be blocks the connection (HTTP 403). Enable Apify Proxy, or pass custom `proxyUrls`. The Actor falls back to a direct connection if the proxy is unavailable. |

The Actor stops when it reaches `results_wanted`, when there are no more result pages, or when it reaches `max_pages`.

## Output Data

Each dataset item is a JSON object containing the non-empty fields available for that listing. Detail fields can be absent when the source listing does not publish them. If the main listing is available but additional details cannot be collected, the record can still be saved with `detail_error`.

The most useful fields for everyday workflows are `title`, `company`, `region`, `regime`, `contract_type`, `salary_type`, `description_text`, `job_url`, and `fetched_at`. Use `description_html` when you need to preserve basic formatting for a downstream display.

## Usage Examples

### Basic category collection

Collect up to 20 jobs from the prefilled Jobat administration search and process up to three result pages.

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

Collect a larger administration dataset for a recurring hiring report by increasing both the result limit and page cap.

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "results_wanted": 100,
  "max_pages": 10
}
```

### Run through a proxy

Route the requests through a proxy when Jobat.be answers with HTTP 403 for your connection.

```json
{
  "keyword": "software developer",
  "results_wanted": 50,
  "max_pages": 5,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

Custom proxy URLs work the same way:

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "results_wanted": 20,
  "max_pages": 3,
  "proxyConfiguration": {
    "proxyUrls": ["http://user:pass@host:port"]
  }
}
```

## Sample Output

The following example shows one dataset item. Optional fields are omitted when Jobat.be does not publish them for a particular job.

```json
{
  "job_id": "5391152",
  "title": "Office Manager",
  "company": "Industrial Solutions in Stitching & Sourcing",
  "description_html": "<p>Coordinate office operations and support the wider team.</p><strong>PROFIEL</strong><ul><li>Professional communication skills</li></ul>",
  "description_text": "Coordinate office operations and support the wider team. PROFIEL Professional communication skills",
  "job_url": "https://www.jobat.be/en/jobs/office-manager/job_5391152",
  "listing_url": "https://www.jobat.be/nl/jobs/office-manager/job_5391152",
  "source_search_url": "https://www.jobat.be/nl/jobs/administratie",
  "source_index": 1,
  "category": "Sales",
  "sub_category_1": "Sales",
  "sub_category_2": "Sales support & administration",
  "region": "Aalst",
  "region_zip": "9500",
  "company_type": "Agency",
  "company_group_name": "Sales - NL",
  "language": "N",
  "required_language": "#NL#",
  "required_degree": "Professional bachelor (Higher Education Short Type)",
  "regime": "Full Time",
  "contract_type": "Fixed",
  "salary_type": "benefits",
  "application_type": "internal",
  "fetched_at": "2026-08-22T08:55:12.948Z"
}
```

## Tips for Best Results

- **Start with a focused search** - Use a specific role or category URL when you want a targeted dataset.
- **Use Jobat's own search URLs** - A prepared URL can preserve the category, language, region, and other filters supported by the source page.
- **Test with a small limit** - Start with `results_wanted` set to `20` and inspect the dataset before requesting a larger collection.
- **Raise the page cap for larger collections** - Increase `max_pages` when the result set is larger than the first page. The Actor still stops when it reaches `results_wanted`.
- **Keep recurring runs comparable** - Reuse the same `keyword` or `startUrl`, result limit, and page cap when comparing scheduled snapshots.
- **Expect source-dependent fields** - Salary signals, language requirements, education, and descriptions may be absent from individual listings.
- **Review direct links** - Use `job_url` to open the original listing and confirm details before taking recruitment or business action.
- **Report source changes** - If a previously working search no longer returns expected data, report the example URL and run details through the Actor's Issues tab.
- **Keep a proxy ready** - If a run reports HTTP 403, enable `proxyConfiguration` and start the run again instead of lowering the result limit.

## Integrations and Export Formats

- **Google Sheets** - Share job records with recruiters, analysts, and hiring managers.
- **Airtable** - Build a searchable database of Belgian vacancies and employers.
- **Webhooks** - Send completed run notifications or dataset links to another service.
- **Make or Zapier** - Route new job records into alerts, email, CRM, or internal workflows.
- **Apify API** - Start runs and retrieve dataset records from your own application.
- **JSON** - Use structured records in applications, data pipelines, and AI search workflows.
- **CSV and Excel** - Review, filter, and report on jobs in spreadsheet tools.
- **XML** - Support systems that require XML data exchange.

## Frequently Asked Questions

### Can I search Jobat.be by keyword?

Yes. Set `keyword` to a job title, skill, or search phrase such as `software developer` or `verpleegkundige`. If you have already configured filters on Jobat.be, use the resulting URL as `startUrl` instead.

### Can I use a prepared Jobat search URL?

Yes. Paste a public Jobat search results URL into `startUrl`. This is the best option when you want to preserve category, region, language, or other filters already selected on the website.

### Can I collect multiple searches in one run?

The published input accepts one `startUrl` or keyword search per run. To collect separate searches, create separate runs and combine the datasets afterward, or schedule each search independently.

### How many jobs can I collect?

The final count is limited by `results_wanted`, `max_pages`, the number of matching public listings, and source availability. Start with a small limit, then increase it after checking the dataset preview.

### Does the Actor collect job descriptions?

Yes. When a listing provides description content, the dataset can include both formatted `description_html` and plain-text `description_text`. Some listings may not publish a full description.

### Why are some fields missing?

Some Jobat.be listings do not publish salary information, education requirements, language requirements, or other optional fields. Empty values are omitted rather than filled with guesses.

### What happens if a job's additional details are unavailable?

The Actor can save the listing data that was available and include `detail_error` when additional details could not be collected. This prevents one incomplete listing from removing the entire run result.

### Why does my run fail with HTTP 403?

Jobat.be protects its pages with a bot check, so some connections are refused. The run then stops without results and reports the block instead of returning an empty dataset. Enable `proxyConfiguration` with Apify Proxy or custom `proxyUrls` and start the run again. The Actor retries, switches between the proxy and a direct connection, and falls back to a direct connection if the proxy is unavailable.

### Can I export Jobat.be data to CSV or Excel?

Yes. Apify datasets can be downloaded as CSV, Excel, JSON, XML, and other supported formats.

### Can I schedule recurring Jobat.be searches?

Yes. Create an Apify schedule to run a keyword or prepared search URL hourly, daily, weekly, or at another interval. Scheduling is useful for new-job alerts and hiring trend reports.

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
