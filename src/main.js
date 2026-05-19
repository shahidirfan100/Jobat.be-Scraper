import { Actor, log } from 'apify';
import { gotScraping } from 'got-scraping';

const BASE_URL = 'https://www.jobat.be';
const DEFAULT_START_URL = `${BASE_URL}/nl/jobs/administratie`;
const DETAIL_CONCURRENCY = 5;

const DEFAULT_HEADERS = {
    'accept-language': 'nl-BE,nl;q=0.9,en-US;q=0.8,en;q=0.7',
};

await Actor.init();

function toAbsoluteUrl(input, base = BASE_URL) {
    try {
        return new URL(input, base).href;
    } catch {
        return null;
    }
}

function stripHtml(text) {
    if (!text) return '';
    const normalized = text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article)>/gi, '\n')
        .replace(/<[^>]+>/g, ' ');

    return decodeHtmlEntities(normalized)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
}

function decodeHtmlEntities(text) {
    if (!text) return '';
    return text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

function toSlug(keyword) {
    return String(keyword || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function cleanDescriptionHtml(html) {
    if (!html) return '';
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<br\s*\/?>/gi, '<br>')
        .replace(/<([a-z0-9]+)(?:\s[^>]*)?>/gi, '<$1>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function extractDescriptionHtml(detailHtml) {
    const jobDetailSection = detailHtml.match(/<div id="jobdetail"[\s\S]*$/i)?.[0] ?? detailHtml;
    const blocks = [];
    const blockRegex = /<h[1-6][^>]*class=["'][^"']*JobDetails-contentSubtitle[^"']*["'][^>]*>[\s\S]*?<\/h[1-6]>|<div[^>]*class=["'][^"']*JobDetails-contentParagraph[^"']*["'][^>]*>[\s\S]*?<\/div>/gi;

    let match;
    while ((match = blockRegex.exec(jobDetailSection)) !== null) {
        const block = match[0];
        if (/^<h/i.test(block)) {
            const title = stripHtml(block);
            if (title) blocks.push(`<strong>${escapeHtml(title)}</strong>`);
            continue;
        }

        const inner = block
            .replace(/^<div[^>]*>/i, '')
            .replace(/<\/div>\s*$/i, '')
            .trim();

        if (!inner) continue;
        if (/<(ul|ol|li|p|h[1-6]|table|tr|td|th)\b/i.test(inner)) {
            blocks.push(inner);
        } else {
            blocks.push(`<p>${inner}</p>`);
        }
    }

    if (!blocks.length) {
        const metaDescription = detailHtml.match(/<meta[^>]*itemprop=["']description["'][^>]*content=["']([\s\S]*?)["'][^>]*>/i)?.[1] ?? '';
        const fallbackText = decodeHtmlEntities(metaDescription).trim();
        if (fallbackText) blocks.push(`<p>${escapeHtml(fallbackText)}</p>`);
    }

    return cleanDescriptionHtml(blocks.join('\n'));
}

function getAttribute(tag, attrName) {
    const match = tag.match(new RegExp(`${attrName}=["']([^"']+)["']`, 'i'));
    return match?.[1] ?? null;
}

function parseListPage(html, sourceUrl) {
    const jobs = [];
    const seenJobIds = new Set();

    const filter = html.match(/id=["']jobresults["'][^>]*data-filter=["']([^"']+)["']/i)?.[1] ?? null;
    const total = Number.parseInt(html.match(/id=["']jobresults["'][^>]*data-total=["'](\d+)["']/i)?.[1] ?? '', 10) || null;
    const pageSize = Number.parseInt(html.match(/id=["']jobresults["'][^>]*data-pagesize=["'](\d+)["']/i)?.[1] ?? '', 10) || null;

    const cardTagRegex = /<div[^>]*(?:id=["']article_(\d+)["']|data-jobid=["'](\d+)["'])[^>]*>/gi;
    let cardMatch;
    while ((cardMatch = cardTagRegex.exec(html)) !== null) {
        const tag = cardMatch[0];
        const jobId = cardMatch[1] || cardMatch[2] || getAttribute(tag, 'data-jobid');
        if (!jobId || seenJobIds.has(jobId)) continue;
        seenJobIds.add(jobId);

        const relUrl = getAttribute(tag, 'data-id');
        const index = Number.parseInt(getAttribute(tag, 'data-index') ?? '', 10) || null;

        const cardSnippet = html.slice(cardMatch.index, cardMatch.index + 1400);
        const title = stripHtml(
            cardSnippet.match(/<h2[^>]*class=["'][^"']*jobTitle[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? '',
        );

        jobs.push({
            jobId,
            index,
            title: title || null,
            listingUrl: relUrl ? toAbsoluteUrl(relUrl, sourceUrl) : null,
            filter,
            sourceUrl,
        });
    }

    const nextRelative =
        html.match(/<a[^>]+data-pagination=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1]
        ?? html.match(/<a[^>]+data-pagination=["']next["'][^>]+data-href=["']([^"']+)["']/i)?.[1]
        ?? html.match(/<a[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1]
        ?? null;

    const normalizedNext = nextRelative?.includes('||') ? nextRelative.replace(/\|\|/g, '/') : nextRelative;
    const nextUrl = normalizedNext ? toAbsoluteUrl(normalizedNext, sourceUrl) : null;

    return { jobs, nextUrl, filter, total, pageSize };
}

function getLocaleJobsBase(urlObj) {
    if (urlObj.pathname.startsWith('/fr/emplois')) return '/fr/emplois';
    if (urlObj.pathname.startsWith('/en/jobs')) return '/en/jobs';
    return '/nl/jobs';
}

function resolveFallbackStartUrls(currentUrl, html) {
    const candidates = [];

    let urlObj;
    try {
        urlObj = new URL(currentUrl);
    } catch {
        return candidates;
    }

    const basePath = getLocaleJobsBase(urlObj);
    const keyword =
        urlObj.searchParams.get('keyword')
        || urlObj.searchParams.get('keywords')
        || urlObj.searchParams.get('q')
        || urlObj.searchParams.get('what')
        || '';
    const slug = toSlug(keyword);

    if (slug) {
        candidates.push(toAbsoluteUrl(`${basePath}/${slug}`, urlObj.origin));

        if (basePath === '/nl/jobs') candidates.push(toAbsoluteUrl(`${basePath}/functietitels/${slug}`, urlObj.origin));
        if (basePath === '/en/jobs') candidates.push(toAbsoluteUrl(`${basePath}/titles/${slug}`, urlObj.origin));
        if (basePath === '/fr/emplois') candidates.push(toAbsoluteUrl(`${basePath}/titres/${slug}`, urlObj.origin));
    }

    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
        const href = linkMatch[1];
        const abs = toAbsoluteUrl(href, urlObj.origin);
        if (!abs) continue;

        let parsedLink;
        try {
            parsedLink = new URL(abs);
        } catch {
            continue;
        }

        if (!parsedLink.pathname.startsWith(`${basePath}/`)) continue;
        if (parsedLink.pathname.includes('/secure/') || parsedLink.pathname.includes('/bedrijven') || parsedLink.pathname.includes('/jobfair') || parsedLink.pathname.includes('/carriere')) continue;
        if (slug && !parsedLink.pathname.toLowerCase().includes(slug)) continue;
        candidates.push(abs);
        if (candidates.length >= 10) break;
    }

    return [...new Set(candidates.filter((u) => u && u !== currentUrl))];
}

function extractDataLayerObjects(html) {
    const objects = [];
    const needle = 'dataLayer.push(';

    let cursor = 0;
    while (cursor < html.length) {
        const start = html.indexOf(needle, cursor);
        if (start === -1) break;

        let i = start + needle.length;
        while (i < html.length && /\s/.test(html[i])) i++;
        if (html[i] !== '{') {
            cursor = i + 1;
            continue;
        }

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let j = i; j < html.length; j++) {
            const ch = html[j];

            if (escape) {
                escape = false;
                continue;
            }

            if (ch === '\\') {
                escape = true;
                continue;
            }

            if (ch === '"') {
                inString = !inString;
                continue;
            }

            if (inString) continue;

            if (ch === '{') depth++;
            if (ch === '}') {
                depth--;
                if (depth === 0) {
                    const raw = html.slice(i, j + 1);
                    try {
                        objects.push(JSON.parse(raw));
                    } catch {
                        // Ignore invalid JSON snippets.
                    }
                    cursor = j + 1;
                    break;
                }
            }
        }

        cursor += 1;
    }

    return objects;
}

function parseJobDetail(html, listingJob) {
    const dataLayerObjects = extractDataLayerObjects(html);
    const jobInfo = dataLayerObjects.find((obj) => obj?.event === 'job_information') || {};

    const title = stripHtml(
        html.match(/<h2[^>]*class=["'][^"']*(?:JobDetails-contentTitle|jobTitle)[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1]
            || listingJob.title
            || '',
    );

    const company = stripHtml(
        html.match(/class=["'][^"']*jobCard-company[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
            || jobInfo.jobCompanyName
            || '',
    );

    const jobUrlRelative = html.match(/data-joburl=["']([^"']+)["']/i)?.[1] ?? null;
    const descriptionHtml = extractDescriptionHtml(html);
    const descriptionText = stripHtml(descriptionHtml);

    return {
        job_id: listingJob.jobId,
        title: title || null,
        company: company || null,
        description_html: descriptionHtml || null,
        description_text: descriptionText || null,
        job_url: toAbsoluteUrl(jobUrlRelative || listingJob.listingUrl || '', BASE_URL),
        listing_url: listingJob.listingUrl,
        source_search_url: listingJob.sourceUrl,
        source_search_filter: listingJob.filter,
        source_index: listingJob.index,
        category: jobInfo.jobCategory ?? null,
        sub_category_1: jobInfo.jobSubCategory1 ?? null,
        sub_category_2: jobInfo.jobSubCategory2 ?? null,
        region: jobInfo.jobRegion ?? null,
        region_zip: jobInfo.jobRegionZip ?? null,
        company_id: jobInfo.jobCompanyID ?? null,
        company_group_id: jobInfo.jobCompanyGroupID ?? null,
        company_group_name: jobInfo.jobCompanyGroupName ?? null,
        company_type: jobInfo.jobCompanyType ?? null,
        product_id: jobInfo.jobProductID ?? null,
        language: jobInfo.jobLanguage ?? null,
        required_language: jobInfo.jobReqLanguage ?? null,
        required_degree: jobInfo.jobReqDegree ?? null,
        regime: jobInfo.jobRegime ?? null,
        contract_type: jobInfo.jobType ?? null,
        salary_type: jobInfo.jobSalary ?? null,
        application_type: jobInfo.jobApplicationType ?? null,
        apply_source_internal: jobInfo.jobApplySourceInternal ?? null,
        pof: jobInfo.jobPof ?? null,
    };
}

function removeEmptyValues(value) {
    if (Array.isArray(value)) {
        const arr = value
            .map((item) => removeEmptyValues(item))
            .filter((item) => item !== undefined);
        return arr.length ? arr : undefined;
    }

    if (value && typeof value === 'object') {
        const obj = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            const cleanedValue = removeEmptyValues(nestedValue);
            if (cleanedValue !== undefined) obj[key] = cleanedValue;
        }
        return Object.keys(obj).length ? obj : undefined;
    }

    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string' && value.trim() === '') return undefined;
    return value;
}

async function fetchText(url, proxyConfiguration, additionalHeaders = {}) {
    const proxyUrl = proxyConfiguration ? await proxyConfiguration.newUrl() : undefined;
    const response = await gotScraping({
        url,
        proxyUrl,
        headers: {
            ...DEFAULT_HEADERS,
            ...additionalHeaders,
        },
        timeout: {
            request: 30_000,
        },
        retry: {
            limit: 3,
        },
    });

    return response.body;
}

function normalizeStartUrls(input) {
    const rawStartUrls = [];

    if (Array.isArray(input.startUrls)) {
        rawStartUrls.push(...input.startUrls);
    }
    if (input.startUrl) rawStartUrls.push(input.startUrl);
    if (input.url) rawStartUrls.push(input.url);
    if (Array.isArray(input.urls)) {
        rawStartUrls.push(...input.urls);
    }

    const normalized = rawStartUrls
        .map((entry) => (typeof entry === 'string' ? entry : entry?.url))
        .map((entry) => toAbsoluteUrl(entry || '', BASE_URL))
        .filter(Boolean);

    const keyword = input.keyword || input.keywords || input.q || '';
    if (keyword && typeof keyword === 'string' && keyword.trim()) {
        const hasOnlyDefault = normalized.length === 0 || 
            (normalized.length === 1 && normalized[0] === DEFAULT_START_URL);
        
        if (hasOnlyDefault) {
            const slug = toSlug(keyword);
            if (slug) {
                return [toAbsoluteUrl(`/nl/jobs/results/${slug}`, BASE_URL)];
            }
        }
    }

    if (normalized.length > 0) return [...new Set(normalized)];

    return [DEFAULT_START_URL];
}

async function main() {
    const input = (await Actor.getInput()) || {};
    const {
        results_wanted: resultsWantedRaw = 20,
        resultsWanted: resultsWantedCamel = 20,
        max_pages: maxPagesRaw = 20,
        maxPages: maxPagesCamel = 20,
        proxyConfiguration: proxyConfigurationInput,
    } = input;

    const resolvedResultsWanted = input.results_wanted !== undefined ? resultsWantedRaw : resultsWantedCamel;
    const resultsWanted = Number.isFinite(Number(resolvedResultsWanted))
        ? Math.max(1, Number(resolvedResultsWanted))
        : 20;

    const resolvedMaxPages = input.max_pages !== undefined ? maxPagesRaw : maxPagesCamel;
    const maxPages = Number.isFinite(Number(resolvedMaxPages))
        ? Math.max(1, Number(resolvedMaxPages))
        : 20;

    const detailConcurrency = DETAIL_CONCURRENCY;

    const proxyConfiguration = (proxyConfigurationInput && (proxyConfigurationInput.useApifyProxy || proxyConfigurationInput.proxyUrls?.length > 0))
        ? await Actor.createProxyConfiguration(proxyConfigurationInput)
        : undefined;

    const startUrls = normalizeStartUrls(input);
    log.info(`Starting Jobat API-based scrape with ${startUrls.length} start URL(s).`);

    const seenListUrls = new Set();
    const seenJobIds = new Set();
    const collectedJobs = [];

    const queue = startUrls.map((url) => ({ url, pageNo: 1 }));

    while (queue.length > 0 && collectedJobs.length < resultsWanted) {
        const { url, pageNo } = queue.shift();
        if (!url || seenListUrls.has(url) || pageNo > maxPages) continue;
        seenListUrls.add(url);

        log.info(`Fetching list page ${pageNo}: ${url}`);

        let html;
        try {
            html = await fetchText(url, proxyConfiguration);
        } catch (error) {
            log.warning(`List page request failed (${url}): ${error.message}`);
            continue;
        }

        const parsed = parseListPage(html, url);
        log.info(
            `Parsed ${parsed.jobs.length} listing entries from page ${pageNo}${parsed.total ? ` (total ${parsed.total})` : ''}.`,
        );

        if (parsed.jobs.length === 0 && pageNo === 1) {
            const fallbackUrls = resolveFallbackStartUrls(url, html);
            if (fallbackUrls.length > 0) {
                log.warning(`No jobs found on initial URL. Trying ${fallbackUrls.length} fallback listing URL(s).`);
                for (const fallbackUrl of fallbackUrls) {
                    if (!seenListUrls.has(fallbackUrl)) queue.push({ url: fallbackUrl, pageNo: 1 });
                }
                continue;
            }
        }

        for (const job of parsed.jobs) {
            if (!job.jobId || seenJobIds.has(job.jobId)) continue;
            seenJobIds.add(job.jobId);
            collectedJobs.push(job);
            if (collectedJobs.length >= resultsWanted) break;
        }

        if (parsed.nextUrl && pageNo < maxPages && collectedJobs.length < resultsWanted) {
            queue.push({ url: parsed.nextUrl, pageNo: pageNo + 1 });
        }
    }

    const targetJobs = collectedJobs.slice(0, resultsWanted);
    log.info(`Collected ${targetJobs.length} unique job IDs for detail enrichment.`);

    let saved = 0;

    for (let i = 0; i < targetJobs.length; i += detailConcurrency) {
        const batch = targetJobs.slice(i, i + detailConcurrency);
        const batchItems = await Promise.all(
            batch.map(async (job) => {
                const detailUrl = new URL('/api/jobat/jobdetail/getjobcontent', BASE_URL);
                detailUrl.searchParams.set('jobId', String(job.jobId));
                detailUrl.searchParams.set('filter', job.filter || '');
                detailUrl.searchParams.set('logListClick', 'false');
                detailUrl.searchParams.set('setMetaData', 'false');
                detailUrl.searchParams.set('isResultsPage', 'true');

                try {
                    const detailHtml = await fetchText(detailUrl.href, proxyConfiguration, {
                        accept: 'text/html, */*; q=0.8',
                        'x-requested-with': 'XMLHttpRequest',
                        referer: job.sourceUrl,
                    });

                    const parsed = parseJobDetail(detailHtml, job);
                    return removeEmptyValues({
                        ...parsed,
                        detail_api_url: detailUrl.href,
                        fetched_at: new Date().toISOString(),
                    });
                } catch (error) {
                    log.warning(`Detail request failed for jobId=${job.jobId}: ${error.message}`);
                    return removeEmptyValues({
                        job_id: job.jobId,
                        title: job.title,
                        listing_url: job.listingUrl,
                        source_search_url: job.sourceUrl,
                        source_search_filter: job.filter,
                        source_index: job.index,
                        detail_api_url: detailUrl.href,
                        detail_error: error.message,
                        fetched_at: new Date().toISOString(),
                    });
                }
            }),
        );

        for (const item of batchItems) {
            if (!item) continue;
            await Actor.pushData(item);
            saved++;
        }

        log.info(`Saved ${saved}/${targetJobs.length} items.`);
    }

    log.info(`Finished. Total saved: ${saved}.`);
}

try {
    await main();
} catch (error) {
    log.exception(error, 'Actor failed');
    throw error;
} finally {
    await Actor.exit();
}
