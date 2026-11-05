import { Actor, log } from 'apify';
import { Impit } from 'impit';

const BASE_URL = 'https://www.jobat.be';
const DEFAULT_START_URL = `${BASE_URL}/nl/jobs/administratie`;
const DETAIL_CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 4;

// Only okhttp profiles pass the listing-page bot check; desktop ones stay as
// detail-endpoint fallbacks. Measured in API_DISCOVERY.md.
const BROWSER_PROFILES = ['okhttp5', 'okhttp4', 'okhttp3', 'chrome151', 'firefox144', 'chrome'];

const LISTING_MARKER = /id=["']jobresults["']|id=["']article_\d+["']/i;
const DETAIL_MARKER = /"event"\s*:\s*"job_information"|JobDetails-content|itemprop=["']description["']/i;

await Actor.init();

function toAbsoluteUrl(input, base = BASE_URL) {
    try {
        return new URL(input, base).href;
    } catch {
        return null;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
    const match = tag.match(new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, 'i'));
    return match?.[1] ?? null;
}

function toInt(value) {
    const parsed = Number.parseInt(value ?? '', 10);
    return Number.isFinite(parsed) ? parsed : null;
}

function positiveInt(value, fallback) {
    const parsed = toInt(value);
    return parsed !== null && parsed > 0 ? parsed : fallback;
}

function looksBlocked(body) {
    return /Just a moment|cf_chl|challenge-platform|captcha|Access Denied|Attention Required/i.test(body);
}

function shortMessage(error) {
    const message = String(error?.message ?? error)
        .split('\n')[0]
        .replace(/https?:\/\/[^\s)'"]+/gi, '<url>')
        .trim();
    return message.length > 140 ? `${message.slice(0, 140)}…` : message;
}

function parseRetryAfter(value) {
    if (!value) return null;
    const seconds = Number.parseInt(value, 10);
    const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return Math.min(ms, 10_000);
}

// One reused client per profile. A blocked or unexpected response moves that
// profile to the back so the next attempt uses a different fingerprint.
function createTransport(proxyConfiguration) {
    let routes = [];
    let fallbackTried = false;
    let proxyRefreshTried = false;
    let directOnly = false;

    const buildRoutes = async (url) => {
        routes = BROWSER_PROFILES.map((browser) => ({
            browser,
            client: new Impit({
                browser,
                timeout: REQUEST_TIMEOUT_MS,
                ...(url ? { proxyUrl: url } : {}),
            }),
        }));
    };

    const rebuild = async () => {
        if (directOnly) return;
        await buildRoutes(proxyConfiguration ? await proxyConfiguration.newUrl() : undefined);
    };

    // Apify's datacenter IPs are refused by Jobat's bot check, so a failed run
    // gets one last chance: residential when running direct, direct when the
    // configured proxy is refused.
    const tryFallback = async () => {
        if (fallbackTried) return false;
        fallbackTried = true;

        if (!proxyConfiguration) {
            if (!Actor.isAtHome()) return false;
            try {
                const auto = await Actor.createProxyConfiguration({
                    useApifyProxy: true,
                    apifyProxyGroups: ['RESIDENTIAL'],
                    apifyProxyCountry: 'BE',
                });
                const url = auto ? await auto.newUrl() : undefined;
                if (!url) return false;
                await buildRoutes(url);
                log.warning('Direct access is blocked. Retrying through Apify residential proxy (BE).');
                return true;
            } catch (error) {
                log.warning(`Residential proxy fallback unavailable (${shortMessage(error)}).`);
                return false;
            }
        }

        directOnly = true;
        await buildRoutes(undefined);
        log.warning('The configured proxy is not returning content. Retrying with a direct connection.');
        return true;
    };

    const rotate = () => {
        if (routes.length > 1) routes.push(routes.shift());
    };

    return {
        init: rebuild,
        get profile() {
            return routes[0]?.browser ?? 'none';
        },
        async fetchText(url, validate) {
            for (let phase = 0; phase < 3; phase++) {
                let lastError;
                let blocked = false;

                for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    const route = routes[0];
                    let failure;
                    let retryAfterMs = null;

                    try {
                        const response = await route.client.fetch(url);
                        retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
                        const body = await response.text();

                        if (response.ok && validate(body)) return body;

                        failure = new Error(
                            response.ok
                                ? looksBlocked(body)
                                    ? 'Bot check returned instead of content'
                                    : 'Response missing expected content'
                                : `HTTP ${response.status}`,
                        );
                        failure.status = response.status;
                    } catch (error) {
                        failure = error instanceof Error ? error : new Error(String(error));
                    }

                    lastError = failure;
                    const status = failure.status;
                    // A 200 with the wrong body means the page itself changed, not
                    // that the network is blocked, so it must not trigger the proxy.
                    blocked = blocked || status !== 200;
                    const permanent = status >= 400 && status < 500 && ![403, 408, 429].includes(status);
                    if (permanent) throw failure;
                    if (attempt === MAX_ATTEMPTS) break;

                    rotate();
                    const wait = retryAfterMs ?? Math.min(8000, 500 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 400);
                    log.warning(
                        `${shortMessage(failure)} via ${route.browser}. Retrying with ${routes[0].browser} (attempt ${attempt + 1}/${MAX_ATTEMPTS}).`,
                    );
                    await sleep(wait);
                }

                if (!blocked) throw lastError ?? new Error('Request failed');

                // A residential exit can be unlucky; one fresh session is cheaper
                // than failing the run.
                if (proxyConfiguration && !directOnly && !proxyRefreshTried) {
                    proxyRefreshTried = true;
                    try {
                        await rebuild();
                        log.warning('Proxy exit was refused. Retrying with a fresh proxy session.');
                        continue;
                    } catch (error) {
                        log.warning(`Could not refresh the proxy session (${shortMessage(error)}).`);
                    }
                }

                if (!(await tryFallback())) throw lastError ?? new Error('Request failed');
            }

            throw new Error('Request failed');
        },
    };
}

function resultsPathFor(pathname) {
    if (pathname.startsWith('/fr/emplois')) return '/fr/emplois/titres';
    if (pathname.startsWith('/en/jobs')) return '/en/jobs/results';
    return '/nl/jobs/results';
}

function normalizeStartUrl(raw) {
    const absolute = toAbsoluteUrl(String(raw).trim());
    if (!absolute) return null;

    const urlObj = new URL(absolute);
    if (!/(^|\.)jobat\.be$/i.test(urlObj.hostname)) return null;

    // `/nl/jobs?keyword=x` redirects to a category overview with no cards, so
    // keyword URLs here are rewritten to the locale results path.
    const keyword =
        urlObj.searchParams.get('keyword')
        || urlObj.searchParams.get('keywords')
        || urlObj.searchParams.get('q')
        || urlObj.searchParams.get('what');

    const slug = toSlug(keyword ?? '');
    if (slug) {
        const resultsUrl = toAbsoluteUrl(`${resultsPathFor(urlObj.pathname)}/${slug}`, urlObj.origin);
        if (resultsUrl) return resultsUrl;
    }

    return absolute;
}

function resolveStartUrls(input) {
    const keyword = typeof input.keyword === 'string' ? input.keyword.trim() : '';
    if (keyword) {
        const slug = toSlug(keyword);
        if (slug) return [`${BASE_URL}/nl/jobs/results/${slug}`];
        log.warning(`Keyword "${keyword}" has no usable characters; using the default search page.`);
        return [DEFAULT_START_URL];
    }

    const startUrl = typeof input.startUrl === 'string' ? input.startUrl.trim() : '';
    if (!startUrl) return [DEFAULT_START_URL];

    const normalized = normalizeStartUrl(startUrl);
    if (!normalized) {
        log.warning('startUrl is not a public Jobat.be URL; using the default search page.');
        return [DEFAULT_START_URL];
    }
    return [normalized];
}

function parseListPage(html, sourceUrl) {
    const jobs = [];
    const seenJobIds = new Set();

    const containerTag = html.match(/<[^>]*id=["']jobresults["'][^>]*>/i)?.[0] ?? '';
    const filter = getAttribute(containerTag, 'data-filter');
    const total = toInt(getAttribute(containerTag, 'data-total'));
    const pageSize = toInt(getAttribute(containerTag, 'data-pagesize'));

    const cardTagRegex = /<(?:div|article|li)[^>]*(?:id=["']article_(\d+)["']|data-jobid=["'](\d+)["'])[^>]*>/gi;
    let cardMatch;
    while ((cardMatch = cardTagRegex.exec(html)) !== null) {
        const tag = cardMatch[0];
        const jobId = cardMatch[1] || cardMatch[2];
        if (!jobId || seenJobIds.has(jobId)) continue;
        seenJobIds.add(jobId);

        const block = html.slice(cardMatch.index, cardMatch.index + 2000);
        const listingPath =
            getAttribute(tag, 'data-id')
            || block.match(new RegExp(`href=["']([^"']*job_${jobId}[^"']*)["']`, 'i'))?.[1]
            || null;

        const title = stripHtml(
            block.match(/<h[12][^>]*class=["'][^"']*jobTitle[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
            ?? block.match(new RegExp(`<a[^>]*href=["'][^"']*job_${jobId}[^"']*["'][^>]*>([\\s\\S]*?)</a>`, 'i'))?.[1]
            ?? '',
        );

        jobs.push({
            jobId,
            index: toInt(getAttribute(tag, 'data-index')),
            title: title || null,
            listingUrl: listingPath ? toAbsoluteUrl(listingPath, sourceUrl) : null,
            filter,
            sourceUrl,
        });
    }

    return { jobs, total, nextUrl: resolveNextPageUrl(html, sourceUrl, total, pageSize) };
}

function resolveNextPageUrl(html, sourceUrl, total, pageSize) {
    let urlObj;
    try {
        urlObj = new URL(sourceUrl);
    } catch {
        return null;
    }

    const currentPage = toInt(urlObj.searchParams.get('pagenum')) || 1;
    if (total !== null && pageSize && currentPage * pageSize >= total) return null;

    const nextRelative =
        html.match(/<a[^>]+data-pagination=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1]
        ?? html.match(/<a[^>]+href=["']([^"']+)["'][^>]+data-pagination=["']next["']/i)?.[1]
        ?? html.match(/<a[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i)?.[1]
        ?? null;

    const linked = nextRelative ? toAbsoluteUrl(nextRelative, sourceUrl) : null;
    if (linked && linked !== sourceUrl) return linked;

    urlObj.searchParams.set('pagenum', String(currentPage + 1));
    return urlObj.href;
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

function readMetaProp(html, prop) {
    return html.match(new RegExp(`<meta[^>]+itemprop=["']${prop}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i'))?.[1] ?? null;
}

function parseJobDetail(html, listingJob) {
    const dataLayerObjects = extractDataLayerObjects(html);
    const jobInfo = dataLayerObjects.find((obj) => /job_information/i.test(obj?.event ?? '')) ?? {};

    const title = stripHtml(
        html.match(/<h[12][^>]*class=["'][^"']*JobDetails-contentTitle[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]
            || html.match(/<h[12][^>]*class=["'][^"']*jobTitle[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1]
            || listingJob.title
            || '',
    );

    const company = stripHtml(
        jobInfo.jobCompanyName
            || html.match(/class=["'][^"']*jobCard-company[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]
            || html.match(/itemprop=["']hiringOrganization["'][\s\S]*?itemprop=["']name["'][^>]*content=["']([^"']+)["']/i)?.[1]
            || '',
    );

    const descriptionHtml = extractDescriptionHtml(html);
    const descriptionText = stripHtml(descriptionHtml) || decodeHtmlEntities(readMetaProp(html, 'description') ?? '').trim();
    const jobUrlRelative = html.match(/data-joburl=["']([^"']+)["']/i)?.[1] ?? null;

    return {
        job_id: listingJob.jobId,
        title: title || null,
        company: company || null,
        description_html: descriptionHtml || null,
        description_text: descriptionText || null,
        job_url: listingJob.listingUrl || (jobUrlRelative ? toAbsoluteUrl(jobUrlRelative, BASE_URL) : null),
        listing_url: listingJob.listingUrl,
        source_search_url: listingJob.sourceUrl,
        source_search_filter: listingJob.filter,
        source_index: listingJob.index,
        date_posted: readMetaProp(html, 'datePosted'),
        valid_through: readMetaProp(html, 'validThrough'),
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

function detailUrl(job) {
    const url = new URL('/api/jobat/jobdetail/getjobcontent', BASE_URL);
    url.searchParams.set('jobId', String(job.jobId));
    url.searchParams.set('filter', job.filter || '');
    url.searchParams.set('logListClick', 'false');
    url.searchParams.set('setMetaData', 'false');
    url.searchParams.set('isResultsPage', 'true');
    return url.href;
}

async function main() {
    const input = (await Actor.getInput()) || {};
    const resultsWanted = positiveInt(input.results_wanted, 20);
    const maxPages = positiveInt(input.max_pages, 5);

    let proxyConfiguration;
    const wantsProxy =
        input.proxyConfiguration?.useApifyProxy === true
        || (Array.isArray(input.proxyConfiguration?.proxyUrls) && input.proxyConfiguration.proxyUrls.length > 0);
    if (wantsProxy) {
        try {
            proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);
        } catch (error) {
            log.warning(`Proxy configuration failed (${shortMessage(error)}). Continuing without it.`);
        }
    }

    let transport = createTransport(proxyConfiguration);
    try {
        await transport.init();
    } catch (error) {
        log.warning(`Proxy session could not be created (${shortMessage(error)}). Continuing without a proxy.`);
        proxyConfiguration = undefined;
        transport = createTransport(undefined);
        await transport.init();
    }
    log.info(`Transport | profile=${transport.profile} | proxy=${proxyConfiguration ? 'on' : 'off'}`);

    const startUrls = resolveStartUrls(input);
    log.info(`Start | results=${resultsWanted} | max_pages=${maxPages} | urls=${startUrls.length}`);

    const queue = startUrls.map((url) => ({ url, pageNo: 1 }));
    const seenListUrls = new Set();
    const seenJobIds = new Set();
    let saved = 0;
    let pagesProcessed = 0;

    while (queue.length > 0 && saved < resultsWanted) {
        const { url, pageNo } = queue.shift();
        if (!url || seenListUrls.has(url) || pageNo > maxPages) continue;
        seenListUrls.add(url);

        let html;
        try {
            html = await transport.fetchText(url, (body) => LISTING_MARKER.test(body));
        } catch (error) {
            log.warning(`Listing page ${pageNo} failed: ${shortMessage(error)}`);
            continue;
        }

        const parsed = parseListPage(html, url);
        pagesProcessed++;
        if (parsed.jobs.length === 0 && parsed.total) {
            log.warning(`Page ${pageNo} reports ${parsed.total} jobs but no cards were parsed. The listing markup may have changed.`);
        }

        const pageJobs = [];
        for (const job of parsed.jobs) {
            if (seenJobIds.has(job.jobId)) continue;
            seenJobIds.add(job.jobId);
            pageJobs.push(job);
            if (saved + pageJobs.length >= resultsWanted) break;
        }

        const savedBefore = saved;
        for (let i = 0; i < pageJobs.length; i += DETAIL_CONCURRENCY) {
            const batch = pageJobs.slice(i, i + DETAIL_CONCURRENCY);
            const items = await Promise.all(
                batch.map(async (job) => {
                    const apiUrl = detailUrl(job);

                    try {
                        const detailHtml = await transport.fetchText(apiUrl, (body) => DETAIL_MARKER.test(body));
                        return removeEmptyValues({
                            ...parseJobDetail(detailHtml, job),
                            detail_api_url: apiUrl,
                            fetched_at: new Date().toISOString(),
                        });
                    } catch (error) {
                        log.warning(`Details unavailable for job ${job.jobId}: ${shortMessage(error)}`);
                        return removeEmptyValues({
                            job_id: job.jobId,
                            title: job.title,
                            listing_url: job.listingUrl,
                            source_search_url: job.sourceUrl,
                            source_search_filter: job.filter,
                            source_index: job.index,
                            detail_api_url: apiUrl,
                            detail_error: shortMessage(error),
                            fetched_at: new Date().toISOString(),
                        });
                    }
                }),
            );

            const pushed = items.filter(Boolean);
            if (pushed.length === 0) continue;
            await Actor.pushData(pushed);
            saved += pushed.length;
        }

        log.info(`Page ${pageNo} | listings=${parsed.jobs.length} | saved=${saved - savedBefore} | total=${saved}/${resultsWanted}`);

        if (parsed.nextUrl && pageNo < maxPages && saved < resultsWanted) {
            queue.push({ url: parsed.nextUrl, pageNo: pageNo + 1 });
        }
    }

    if (pagesProcessed === 0) {
        throw new Error(
            `No listing page could be fetched (${seenListUrls.size} URL(s) tried). Jobat.be refused every request profile and the proxy fallback; check the run log for the response reasons.`,
        );
    }

    if (saved === 0) {
        log.warning('Run finished without results. The search may genuinely have no matching jobs.');
    }

    const stopReason = saved >= resultsWanted ? 'result limit' : pagesProcessed >= maxPages ? 'page limit' : 'no more pages';
    log.info(`Finished | saved=${saved} | pages=${pagesProcessed} | stopped_at=${stopReason}`);
}

try {
    await main();
} catch (error) {
    log.exception(error, 'Actor failed');
    throw error;
}

await Actor.exit();
