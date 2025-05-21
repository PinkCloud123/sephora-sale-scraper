import { Actor } from 'apify';
import { CheerioCrawler } from 'crawlee';

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

const crawler = new CheerioCrawler({
    requestQueue,
    maxRequestsPerCrawl: 100,
    useSessionPool: true,
    useApifyProxy: true,
    handlePageFunction: async ({ $, request }) => {
        let category = 'Unknown';
        if (request.url.includes('node=cat150006')) category = 'Skincare';
        else if (request.url.includes('node=cat140006')) category = 'Makeup';

        $('.css-1ez7n0j').each(async (_, el) => {
            const brand = $(el).find('[data-comp="ProductGridItem  BrandLink"]').text().trim();
            const name = $(el).find('[data-comp="ProductGridItem  Title"]').text().trim();
            const priceText = $(el).find('[data-comp="DisplayPrimaryPrice"]').text().replace('$', '').trim();
            const originalText = $(el).find('[data-comp="DisplaySecondaryPrice"]').text().replace('$', '').trim();
            const price = parseFloat(priceText) || null;
            const originalPrice = parseFloat(originalText) || null;
            const discount = (originalPrice && price) ? Math.round((1 - price / originalPrice) * 100) : 0;
            const productUrl = 'https://www.sephora.com' + $(el).find('a').attr('href');
            const image = $(el).find('img').attr('src') || null;
            const ratingText = $(el).find('[data-comp="Rating  Stars"]').attr('aria-label');
            const rating = ratingText ? parseFloat(ratingText.split(' ')[0]) : null;

            await Actor.pushData({
                name,
                brand,
                price,
                originalPrice,
                discount,
                productUrl,
                image,
                rating,
                category,
                scrapedFrom: request.url
            });
        });
    },
});

await crawler.run();
await Actor.exit();
