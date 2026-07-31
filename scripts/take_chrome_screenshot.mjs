import { chromium } from 'playwright';
import { getCDPEndpoint } from '../lib/cdp-helper.js';
import path from 'path';

async function main() {
  try {
    const endpoint = await getCDPEndpoint();
    console.log(`Connecting to CDP on ${endpoint} with noDefaults: true...`);
    const browser = await chromium.connectOverCDP(endpoint, {
      noDefaults: true
    });
    const contexts = browser.contexts();
    if (contexts.length === 0) {
      console.log('No contexts found.');
      return;
    }
    const context = contexts[0];
    const pages = context.pages();
    console.log(`Found ${pages.length} open pages:`);
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`- Page ${i}: Url: "${page.url()}", Title: "${await page.title()}"`);
      
      // Capture a screenshot of the page
      const screenshotPath = path.join(process.cwd(), `data/chrome_screenshot_page_${i}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`  Saved screenshot to ${screenshotPath}`);
    }
    
    await browser.close();
  } catch (err) {
    console.error('Failed to capture screenshot:', err);
  }
}

main();
