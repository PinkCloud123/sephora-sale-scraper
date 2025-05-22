import { Actor } from 'apify';
import { PuppeteerCrawler } from 'crawlee';

await Actor.init();

const input = await Actor.getInput();
const { startUrls, maxPages = 10 } = input;

const requestQueue = await Actor.openRequestQueue();

for (let i = 1; i <= maxPages; i++) {
    for (const { url } of startUrls) {
        const paginatedUrl = `${url}&currentPage=${i}`;
        await requestQueue.addRequest({ url: paginatedUrl });
    }
}

const proxyConfiguration = await Actor.createProxyConfiguration();

const crawler = new PuppeteerCrawler({
    requestQueue,
    maxRequestsPerCrawl: 100,
    useSessionPool: true,
    proxyConfiguration,
    headless: true,
    requestHandler: async ({ page, request }) => {
        const category = request.url.includes('cat150006') ? 'Skincare' :
                         request.url.includes('cat140006') ? 'Makeup' : 'Unknown';

        await page.waitForSelector('.css-12egk0t', { timeout: 15000 });

        const products = await page.$$eval('.css-12egk0t', (cards, category) => {
            return cards.map(card => {
                const brand = card.querySelector('[data-comp="ProductGridItem  BrandLink"]')?.textContent?.trim() || null;
                const name = card.querySelector('[data-comp="ProductGridItem  Title"]')?.textContent?.trim() || null;
                const priceText = card.querySelector('[data-comp="DisplayPrimaryPrice"]')?.textContent?.replace('$', '').trim();
                const originalText = card.querySelector('[data-comp="DisplaySecondaryPrice"]')?.textContent?.replace('$', '').trim();
                const price = parseFloat(priceText) || null;
                const originalPrice = parseFloat(originalText) || null;
                const discount = (originalPrice && price) ? Math.round((1 - price / originalPrice) * 100) : 0;
                const productUrl = 'https://www.sephora.com' + (card.querySelector('a')?.getAttribute('href') || '');
                const image = card.querySelector('img')?.getAttribute('src') || null;
                const ratingText = card.querySelector('[data-comp="Rating  Stars"]')?.getAttribute('aria-label');
                const rating = ratingText ? parseFloat(ratingText.split(' ')[0]) : null;

                return {
                    name,
                    brand,
                    price,
                    originalPrice,
                    discount,
                    productUrl,
                    image,
                    rating,
                    category
                };
            });
        }, category);

        for (const product of products) {
            await Actor.pushData(product);
        }
    },
});

await crawler.run();
await Actor.exit();
