# Jobat.be Jobs Scraper

Extract fresh job listings from Jobat.be with clean, structured output ready for analysis, automation, and reporting. Collect job titles, companies, location and contract signals, category metadata, and direct job links in one run. Built for recurring monitoring and dataset workflows.

## Features

- **Simple start setup** - Start from a Jobat search URL.
- **Automatic pagination** - Traverses result pages until your limits are reached.
- **Structured job enrichment** - Captures company, category, region, contract, and language-related fields.
- **Clean dataset output** - Removes empty values so records are compact and production-friendly.
- **Duplicate-safe collection** - Prevents repeated job IDs during pagination.

## Use Cases

### Recruitment Intelligence
Track demand for roles across categories and regions to understand hiring trends and prioritize outreach.

### Job Market Monitoring
Run the actor on a schedule to detect newly posted opportunities and feed alerting workflows.

### Competitive Analysis
Compare hiring activity by company, region, and contract profile for market positioning.

### Data Warehousing
Export normalized datasets for BI dashboards, internal analytics, and long-term trend studies.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | `https://www.jobat.be/nl/jobs/administratie` | Single Jobat search URL to start from. |
| `results_wanted` | Integer | No | `20` | Maximum number of jobs to save. |
| `max_pages` | Integer | No | `5` | Maximum listing pages to visit per start URL. |
| `proxyConfiguration` | Object | No | `{ "useApifyProxy": false }` | Optional proxy settings for reliability. |

---

## Output Data

Each dataset item may include the following non-empty fields:

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | String | Internal Jobat job identifier. |
| `title` | String | Job title. |
| `company` | String | Employer or agency name. |
| `description_html` | String | Formatted description HTML (`p`, `br`, `ul`, `li`, `strong`, etc.) with scripts/styles removed. |
| `description_text` | String | Clean plain-text description derived from description HTML. |
| `job_url` | String | Direct URL to the job details page. |
| `listing_url` | String | URL captured from listing results. |
| `source_search_url` | String | Search page URL where the job was discovered. |
| `source_search_filter` | String | Search filter token from the source results page. |
| `source_index` | Number | Position index on the listing page. |
| `category` | String | Primary job category. |
| `sub_category_1` | String | First-level subcategory. |
| `sub_category_2` | String | Second-level subcategory. |
| `region` | String | Region label. |
| `region_zip` | String | ZIP code associated with the region. |
| `company_id` | String | Company identifier. |
| `company_group_id` | String | Company group identifier. |
| `company_group_name` | String | Company group label. |
| `company_type` | String | Company type classification. |
| `product_id` | String | Product/package identifier. |
| `language` | String | Job language code. |
| `required_language` | String | Required language profile. |
| `required_degree` | String | Required degree information. |
| `regime` | String | Work regime (for example full time). |
| `contract_type` | String | Contract type classification. |
| `salary_type` | String | Salary classification signal. |
| `application_type` | String | Application flow type. |
| `apply_source_internal` | String | Internal apply source marker. |
| `pof` | String | Additional classification marker. |
| `detail_api_url` | String | Detail request URL used for enrichment. |
| `detail_error` | String | Error message if detail enrichment failed. |
| `fetched_at` | String | ISO timestamp when item was saved. |

---

## Usage Examples

### Basic Run

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "results_wanted": 20
}
```

### Larger Run

```json
{
  "startUrl": "https://www.jobat.be/nl/jobs/administratie",
  "results_wanted": 100,
  "max_pages": 6
}
```

---

## Sample Output

```json
{
  "job_id": "5391152",
  "title": "Office Manager",
  "company": "Industrial Solutions in Stitching & Sourcing",
  "description_html": "<p>...</p><strong>PROFIEL</strong><ul><li>...</li></ul>",
  "description_text": "PROFIEL ...",
  "job_url": "https://www.jobat.be/en/jobs/office-manager/job_5391152?filter=ZnVuY3Rpb250eXBlPTM2MQ==",
  "listing_url": "https://www.jobat.be/nl/jobs/office-manager/job_5391152",
  "source_search_url": "https://www.jobat.be/nl/jobs/administratie",
  "source_search_filter": "ZnVuY3Rpb250eXBlPTM2MQ==",
  "source_index": 1,
  "category": "Sales",
  "sub_category_1": "Sales",
  "sub_category_2": "Sales support & administration",
  "region": "Aalst",
  "region_zip": "9500",
  "company_id": "3806",
  "company_group_name": "Sales - NL",
  "company_type": "Agency",
  "product_id": "116",
  "language": "N",
  "required_language": "#NL#",
  "required_degree": "Professional bachelor (Higher Education Short Type)",
  "regime": "Full Time",
  "contract_type": "Fixed",
  "salary_type": "benefits",
  "application_type": "internal",
  "pof": "1",
  "detail_api_url": "https://www.jobat.be/api/jobat/jobdetail/getjobcontent?jobId=5391152&filter=ZnVuY3Rpb250eXBlPTM2MQ==&logListClick=false&setMetaData=false&isResultsPage=true",
  "fetched_at": "2026-03-31T08:55:12.948Z"
}
```

---

## Tips for Best Results

### Start From Stable Search URLs
- Use category or role URLs that are known to return active results.
- Keep locale in the path consistent with your target market.

### Tune Collection Limits
- Begin with `results_wanted: 20` for quick validation.
- Increase `max_pages` only when you need larger datasets.

### Manage Throughput
- Use proxy settings when running high-volume jobs repeatedly.

---

## Integrations

Connect your output with:

- **Google Sheets** - Share and review scraped jobs with non-technical teams.
- **Airtable** - Build searchable hiring intelligence bases.
- **Make** - Trigger downstream automations from new jobs.
- **Zapier** - Send jobs to CRMs, Slack, or email workflows.
- **Webhooks** - Push run results to custom backend services.

### Export Formats

- **JSON** - Developer and API workflows.
- **CSV** - Spreadsheet analysis.
- **Excel** - Business reporting.
- **XML** - Legacy integrations.

---

## Frequently Asked Questions

### How many jobs can I collect in one run?
You can collect as many as available, bounded by your `results_wanted` and `max_pages` limits.

### Does the actor remove empty fields?
Yes. Empty, null, and undefined fields are automatically removed before saving each item.

### Can I run multiple searches at once?
Run separate scheduled runs with different `startUrl` values.

### What happens if detail enrichment fails for a job?
The job can still be saved with available listing data and an error marker.

### Can I schedule this actor?
Yes. You can schedule periodic runs from Apify to keep datasets continuously updated.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [Apify API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/platform/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for complying with website terms, robots directives, and applicable laws in their jurisdiction.
