## Selected API
- Endpoint: `https://www.jobat.be/api/jobat/jobdetail/getjobcontent?jobId=<JOB_ID>&filter=<FILTER>&logListClick=false&setMetaData=false&isResultsPage=true`
- Method: `GET`
- Auth: None
- Pagination: Not provided by this endpoint (pagination handled via search URLs such as `?pagenum=2`)
- Fields available (structured): `jobID`, `jobCompanyType`, `jobCompanyID`, `jobCompanyName`, `jobCompanyGroupName`, `jobCompanyGroupID`, `jobProductID`, `jobCategory`, `jobSubCategory1`, `jobSubCategory2`, `jobRegion`, `jobRegionZip`, `jobApplicationType`, `jobLanguage`, `jobReqLanguage`, `jobReqDegree`, `jobRegime`, `jobType`, `jobSalary`, `jobPof`, `jobApplySourceInternal`
- Additional fields extracted from response markup: `title`, `company`, `job_url`

## Existing Actor Field Audit (Before Update)
The previous actor was still configured for Remote.co and attempted to output:
- `title`
- `company`
- `category`
- `location`
- `date_posted`
- `description_html`
- `description_text`
- `url`

It also contained a runtime bug (`category` variable was referenced but never defined).

## API Selection Notes
Scoring against the apify-updater rubric:
- Returns data from an internal endpoint: **Yes**
- Returns structured job fields: **Yes**
- No auth required: **Yes**
- Pagination support in same endpoint: **No**
- Field coverage extension vs prior working extraction: **Yes (for Jobat-specific taxonomy fields)**

Approximate score: **85/100**.

## Discovery Findings
- No richer public JSON listing endpoint was found in the loaded bundle/network references.
- Confirmed related endpoints during discovery:
  - `/api/jobat/jobsearch/autocompletejobtitle`
  - `/api/jobat/jobsearch/autocompleteregions`
  - `/api/jobat/jobsearch/box` (form post)
  - `/api/jobat/jobdetail/getjobcontent` (selected)
- Conclusion: use listing pages for job ID discovery and use `jobdetail/getjobcontent` as the primary structured data source.
