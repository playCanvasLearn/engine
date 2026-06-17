/**
 * This file spawns a pool of puppeteer instances to take screenshots of each example for thumbnail.
 */
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';

import { launch } from 'puppeteer';
import sharp from 'sharp';

import { loadExampleMetaData } from './build-examples.mjs';

/**
 * @import { ChildProcess } from 'node:child_process'
 * @import { Browser, Page } from 'puppeteer'
 * @import { ExampleMetadata } from './build-examples.mjs'
 */

/**
 * @typedef {Parameters<typeof launch>[0]} PuppeteerLaunchOptions
 *
 * @typedef {object} PoolItem
 * @property {Browser} browser - Browser instance.
 * @property {number} pages - Number of open pages.
 */

const PORT = process.env.PORT ?? '12321';
const TIMEOUT = 1e8;
const POOL_SIZE = Number(process.env.THUMBNAIL_POOL_SIZE ?? '4');
const CONCURRENCY = Number(process.env.THUMBNAIL_CONCURRENCY ?? String(POOL_SIZE));

/**
 * @param {number} ms - The milliseconds to sleep.
 * @returns {Promise<void>} - The sleep promise.
 */
const sleep = (ms = 0) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

/**
 * @param {Buffer} imageData - Image buffer.
 * @returns {Promise<boolean>} true if the screenshot looks blank (mostly a flat color).
 */
const isLikelyBlankScreenshot = async (imageData) => {
    const { channels } = await sharp(imageData).stats();
    const mean = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
    const stdev = (channels[0].stdev + channels[1].stdev + channels[2].stdev) / 3;
    return mean < 8 && stdev < 6;
};

/**
 * Wait for a few animation frames to ensure the first real render has happened.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page.
 * @param {number} count - Number of rAF ticks to wait for.
 * @returns {Promise<void>} completion promise.
 */
const waitForAnimationFrames = async (page, count = 3) => {
    await page.evaluate(async (c) => {
        await new Promise((resolve) => {
            let n = 0;
            const tick = () => {
                n++;
                if (n >= c) {
                    resolve(true);
                    return;
                }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }, count);
};

const waitForServer = async (url, timeoutMs = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        try {
            const res = await fetch(url, { signal: controller.signal });
            void res;
            return;
        } catch {
        } finally {
            clearTimeout(timer);
        }
        await sleep(250);
    }
    throw new Error(`Server not responding: ${url}`);
};

class PuppeteerPool {
    /**
     * Index of browser with the fewest open pages
     *
     * @type {number}
     */
    _minPageIdx = 0;

    /**
     * Internal size of pool size. Defaults to 4.
     *
     * @type {number}
     */
    _size = 4;

    /**
     * @type {PoolItem[]}
     */
    _pool = [];

    /**
     * @param {number} size - Pool size.
     */
    constructor(size) {
        if (size < 1) {
            throw new Error('size must be >1');
        }
        this._size = size;
    }

    /**
     * @param {PuppeteerLaunchOptions} options - Launch options.
     * @returns {Promise<void>} completion promise.
     */
    async launch(options = {}) {
        const promises = [];
        for (let i = 0; i < this._size; i++) {
            promises.push(launch(options));
        }
        const browsers = await Promise.all(promises);

        for (let i = 0; i < browsers.length; i++) {
            this._pool.push({
                browser: browsers[i],
                pages: 0
            });
        }
    }

    /**
     * Allocates the pool items whos browser has the fewest pages open.
     *
     * @returns {PoolItem} - The pool item
     */
    allocPoolItem() {
        for (let i = 0; i < this._pool.length; i++) {
            if (this._pool[i].pages < this._pool[this._minPageIdx].pages) {
                this._minPageIdx = i;
            }
        }
        const item = this._pool[this._minPageIdx];
        return item;
    }

    /**
     * @param {PoolItem} item - The pool item.
     * @returns {Promise<Page>} - The created page
     */
    newPage(item) {
        const promise = item.browser.newPage();
        item.pages++;
        return promise;
    }

    /**
     * @param {PoolItem} item - The pool item.
     * @param {Page} page - The page to close.
     * @returns {Promise<void>} - The close promise
     */
    closePage(item, page) {
        const promise = page.close();
        item.pages--;
        return promise;
    }

    /**
     * @returns {Promise<void[]>} close promises.
     */
    close() {
        return Promise.all(
            this._pool.map((item) => {
                item.pages = 0;
                return item.browser.close();
            })
        );
    }
}

/**
 * @param {PuppeteerPool} pool - The pool instance.
 * @param {string} categoryKebab - Category kebab name.
 * @param {string} exampleNameKebab - Example kebab name.
 * @param {string} externalUrl - External URL (if this example is an embedded external page).
 * @param {boolean} debug - Enable debug logs.
 * @returns {Promise<void>} completion promise.
 */
const takeThumbnails = async (pool, categoryKebab, exampleNameKebab, externalUrl, debug) => {
    const poolItem = pool.allocPoolItem();
    const page = await pool.newPage(poolItem);
    page.setDefaultTimeout(TIMEOUT);
    page.setDefaultNavigationTimeout(TIMEOUT);

    if (debug) {
        page.on('console', message => console.log(`[CONSOLE] ${message.type().substring(0, 3).toUpperCase()} ${message.text()}`)
        );
        page.on('pageerror', ({ message }) => console.log(`[PAGE ERROR] ${message}`));
        page.on('requestfailed', request => console.log(`[REQUEST FAILED] ${request.failure()?.errorText} ${request.url()}`)
        );
    }

    const outputLarge = `thumbnails/${categoryKebab}_${exampleNameKebab}_large.webp`;
    const outputSmall = `thumbnails/${categoryKebab}_${exampleNameKebab}_small.webp`;

    try {
        if (!externalUrl) {
            await page.evaluateOnNewDocument(() => {
                window.__thumbnailExampleProgress = null;
                window.addEventListener('exampleProgress', (e) => {
                    window.__thumbnailExampleProgress = e.detail;
                });
            });
        }

        const link = externalUrl || `http://localhost:${PORT}/iframe/${categoryKebab}_${exampleNameKebab}.html?miniStats=false&deviceType=webgl2`;
        if (debug) {
            console.log('goto', link);
        }
        await page.goto(link, { timeout: TIMEOUT, waitUntil: 'domcontentloaded' });

        if (debug) {
            console.log('wait for', link);
        }
        if (externalUrl) {
            await sleep(2000);
        } else {
            await page.waitForFunction(
                `window.__thumbnailExampleProgress?.stage === 'ready' || window.__thumbnailExampleProgress?.stage === 'error'`,
                { timeout: TIMEOUT }
            );

            const progress = await page.evaluate(() => window.__thumbnailExampleProgress);
            if (progress?.stage === 'error') {
                throw new Error(`Example failed to load: ${categoryKebab}/${exampleNameKebab}`);
            }

            await page.waitForFunction(`(() => {
                const app = window?.pc?.AppBase?.getApplication?.('application-canvas');
                return !app || app.frame > 10;
            })()`, { timeout: TIMEOUT });
            await waitForAnimationFrames(page, 3);
            await sleep(250);
        }

        let screenshotData = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            screenshotData = /** @type {Buffer} */ (await page.screenshot({ type: 'webp' }));
            if (!(await isLikelyBlankScreenshot(screenshotData))) {
                break;
            }
            await sleep(750);
            await waitForAnimationFrames(page, 2);
        }

        await sharp(screenshotData).resize(320, 240).toFile(outputLarge);
        await sharp(screenshotData).resize(64, 48).toFile(outputSmall);

        console.log(`screenshot taken for: ${categoryKebab}/${exampleNameKebab}`);
    } finally {
        await pool.closePage(poolItem, page).catch(() => {});
    }
};

/**
 * @param {ExampleMetadata[]} metadata - Example metadata.
 * @param {object} options - Thumbnail options.
 * @param {boolean} options.clean - Remove cached thumbnails first.
 * @param {boolean} options.debug - Enable debug logs.
 * @returns {Promise<void>} completion promise.
 */
const takeScreenshots = async (metadata, options) => {
    if (metadata.length === 0) {
        return;
    }

    if (options.clean) {
        fs.rmSync('thumbnails', { recursive: true, force: true });
    }
    if (!fs.existsSync('thumbnails')) {
        fs.mkdirSync('thumbnails');
    }

    const pool = new PuppeteerPool(POOL_SIZE);
    await pool.launch({ headless: true, protocolTimeout: TIMEOUT });

    try {
        const inFlight = [];
        for (let i = 0; i < metadata.length; i++) {
            const { categoryKebab, exampleNameKebab, externalUrl } = metadata[i];

            if (fs.existsSync(`thumbnails/${categoryKebab}_${exampleNameKebab}_large.webp`)) {
                console.log(`skipped (cached): ${categoryKebab}/${exampleNameKebab}`);
                continue;
            }

            let taskPromise;
            taskPromise = takeThumbnails(pool, categoryKebab, exampleNameKebab, externalUrl ?? '', options.debug)
            .finally(() => {
                const idx = inFlight.indexOf(taskPromise);
                if (idx !== -1) {
                    inFlight.splice(idx, 1);
                }
            });

            inFlight.push(taskPromise);
            if (inFlight.length >= CONCURRENCY) {
                await Promise.race(inFlight);
            }
        }

        await Promise.all(inFlight);
    } finally {
        await pool.close();
    }
};

/**
 * @param {ChildProcess} server - The server process.
 * @param {boolean} isWin - True when running on Windows.
 * @returns {void} no return value.
 */
const stopServer = (server, isWin) => {
    if (isWin) {
        execSync(`taskkill /f /pid ${server.pid}`);
        console.log('Killed server on', PORT);
        return;
    }
    server.kill();
    console.log('Killed server on', PORT);
};

/**
 * @param {object} [options] - Thumbnail options.
 * @param {boolean} [options.clean] - Remove cached thumbnails first.
 * @param {boolean} [options.debug] - Enable debug logs.
 * @returns {Promise<void>} completion promise.
 */
export const buildThumbnails = async (options = {}) => {
    const metadata = await loadExampleMetaData();
    console.log('Spawn server on', PORT);
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'npx.cmd' : 'npx';
    const server = spawn(cmd, ['vite', 'preview'], {
        env: {
            ...process.env,
            EXAMPLES_PORT: PORT
        },
        shell: true
    });
    await waitForServer(`http://localhost:${PORT}/`, 60000);
    console.log('Starting puppeteer screenshot process');

    const task = Promise.resolve().then(async () => {
        console.time('Time');
        await takeScreenshots(metadata, {
            clean: !!options.clean,
            debug: !!options.debug
        });
        console.timeEnd('Time');
    });
    const err = await task.then(() => null, err => err);

    stopServer(server, isWin);
    if (err) {
        throw err;
    }
};
