import fs from 'fs';
import path from 'path';
import { getSetting } from './db.js';

// Helper to launch playwright chromium (used for image downloads and generic sessions)
async function getBrowserInstance() {
  const { chromium } = await import('playwright');
  
  // Determine headless mode:
  // On macOS/Windows host, run headfully for better anti-bot bypass.
  // On Linux (WSL), run headfully only if a DISPLAY (like Xvfb) is available.
  let headless = true;
  if (process.platform === 'darwin' || process.platform === 'win32') {
    headless = false;
  }

  return await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-http2'
    ]
  });
}

// Helper to launch playwright chromium with a persistent context (saves session, cookies, login state)
async function getPersistentContext() {
  const { chromium } = await import('playwright');
  
  let headless = true;
  if (process.platform === 'darwin' || process.platform === 'win32') {
    headless = false;
  }

  const userDataDir = path.join(process.cwd(), 'data/playwright-profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log(`[Playwright Scraper] Launching standalone Chromium with persistent profile at: ${userDataDir}`);
  return await chromium.launchPersistentContext(userDataDir, {
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-http2'
    ],
    viewport: { width: 1280, height: 800 }
  });
}

/**
 * Scrape a URL using Playwright Chromium to bypass dynamic client-side hydration and anti-bot systems.
 * Uses a persistent browser profile to maintain login sessions and cookies.
 * @param {string} url - Target URL to scrape
 * @returns {Promise<{title: string, html: string, bodyText: string}>}
 */
export async function scrapeUrlPlaywright(url) {
  let browserOrContext;
  let isCDP = true;
  try {
    const { chromium } = await import('playwright');
    const { getCDPEndpoint } = await import('./cdp-helper.js');
    const endpoint = await getCDPEndpoint();
    
    console.log(`[Playwright Scraper] Connecting to Google Chrome via CDP on ${endpoint}...`);
    try {
      browserOrContext = await chromium.connectOverCDP(endpoint, { noDefaults: true });
    } catch (err) {
      console.warn(`[Playwright Scraper] CDP Connection failed: ${err.message}. Falling back to standalone persistent Chromium context...`);
      isCDP = false;
      browserOrContext = await getPersistentContext();
    }

    let context;
    if (isCDP) {
      const contexts = browserOrContext.contexts();
      if (contexts.length === 0) {
        throw new Error('Tidak ada konteks peramban aktif. Pastikan Google Chrome asli Anda terbuka.');
      }
      context = contexts[0];
    } else {
      context = browserOrContext;
    }
    
    const page = await context.newPage();
    
    // 1. Inject anti-detection script to hide webdriver properties
    console.log('[Playwright Scraper] Injecting anti-detection fingerprint spoofing...');
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
    });

    // 2. Set realistic browser headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': 'https://shopee.co.id/'
    });

    // 3. Random delay before navigation
    const initDelay = Math.floor(Math.random() * 1500) + 1000;
    console.log(`[Playwright Scraper] Waiting initial human delay: ${initDelay}ms...`);
    await page.waitForTimeout(initDelay);
    
    console.log(`[Playwright Scraper] Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('[Playwright Scraper] Waiting for page load and hydration...');
    await page.waitForTimeout(4000);

    // 4. Simulate human-like mouse movements across the page
    console.log('[Playwright Scraper] Simulating human mouse movements...');
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(Math.random() * 800) + 100;
      const y = Math.floor(Math.random() * 600) + 100;
      const steps = Math.floor(Math.random() * 12) + 8;
      await page.mouse.move(x, y, { steps });
      await page.waitForTimeout(Math.random() * 400 + 100);
    }
    
    // 5. Human-like smooth reading scrolls with random intervals and backs
    console.log('[Playwright Scraper] Simulating human smooth scrolling and reading patterns...');
    await page.evaluate(async () => {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      let currentPosition = 0;
      const maxScroll = Math.min(document.body.scrollHeight, 3200);
      
      while (currentPosition < maxScroll) {
        const step = Math.floor(Math.random() * 140) + 70; // random scroll step (70px - 210px)
        window.scrollBy(0, step);
        currentPosition += step;
        
        // 10% chance to do a micro back-scroll to simulate reading lookbacks
        if (Math.random() < 0.1 && currentPosition > 200) {
          const backStep = Math.floor(Math.random() * 40) + 10;
          window.scrollBy(0, -backStep);
          currentPosition -= backStep;
        }
        
        await delay(Math.floor(Math.random() * 400) + 150); // reading pause (150ms - 550ms)
      }
    });
    
    await page.waitForTimeout(2000);
    
    const html = await page.content();
    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText);
    
    await page.close(); // Close only the page
    
    if (!isCDP) {
      await browserOrContext.close(); // Close the persistent context (browser closes)
    }
    
    return { title, html, bodyText };
  } catch (error) {
    console.error(`[Playwright Scraper] Error scraping ${url}:`, error.message);
    if (browserOrContext && !isCDP) {
      try { await browserOrContext.close(); } catch (_) {}
    }
    throw error;
  }
}

/**
 * Download product image directly using Playwright browser context to bypass hotlink and referrer checks.
 * @param {string} imageUrl - The CDN URL of the product image
 * @param {string} absolutePath - Path to save the image to
 * @returns {Promise<boolean>}
 */
export async function downloadImagePlaywright(imageUrl, absolutePath) {
  let browser;
  try {
    browser = await getBrowserInstance();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    console.log(`[Playwright Scraper] Downloading image via context request context: ${imageUrl}`);
    const response = await context.request.get(imageUrl, {
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      }
    });

    const status = response.status();
    if (status !== 200) {
      throw new Error(`HTTP ${status} saat mengunduh gambar`);
    }

    const buffer = await response.body();

    // Ensure parent directories exist
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(absolutePath, buffer);
    console.log(`[Playwright Scraper] Gambar berhasil disimpan ke: ${absolutePath}`);

    await browser.close();
    browser = null;
    return true;
  } catch (error) {
    console.error(`[Playwright Scraper] Error downloading image:`, error);
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
    throw error;
  }
}

