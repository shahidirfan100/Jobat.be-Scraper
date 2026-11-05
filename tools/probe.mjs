// Profile matrix check: which Impit profiles reach Jobat.be right now.
// Usage: node tools/probe.mjs [url]
import { Impit } from 'impit';

const url = process.argv[2] || 'https://www.jobat.be/nl/jobs/administratie';
const profiles = ['okhttp5', 'okhttp4', 'okhttp3', 'chrome', 'chrome151', 'chrome142', 'firefox', 'firefox144', 'ios18'];

for (const browser of profiles) {
    const client = new Impit({ browser, timeout: 25_000 });
    try {
        const response = await client.fetch(url);
        const body = await response.text();
        console.log(
            `${browser.padEnd(11)} ${response.status}  ${String(body.length).padStart(7)}  cards=${(body.match(/id=["']article_\d+["']/g) || []).length}`,
        );
    } catch (error) {
        console.log(`${browser.padEnd(11)} ERR  ${String(error.message).split('\n')[0].slice(0, 70)}`);
    }
}
