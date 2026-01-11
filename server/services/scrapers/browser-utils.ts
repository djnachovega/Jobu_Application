import puppeteer, { Browser, Page } from "puppeteer";

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    // Find chromium executable - check common Replit/Nix paths
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || 
      "/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium";
    
    console.log("Launching browser with executable:", executablePath);
    
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--single-process",
        "--no-zygote",
        "--window-size=1920x1080",
      ],
      executablePath,
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );
  
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set default timeout
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(30000);
  
  return page;
}

export async function waitAndClick(page: Page, selector: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
}

export async function waitAndType(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForSelector(selector, { visible: true });
  await page.type(selector, text, { delay: 50 });
}

export async function extractText(page: Page, selector: string): Promise<string | null> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    return await page.$eval(selector, el => el.textContent?.trim() || null);
  } catch {
    return null;
  }
}

export async function extractNumber(page: Page, selector: string): Promise<number | null> {
  const text = await extractText(page, selector);
  if (!text) return null;
  const num = parseFloat(text.replace(/[^0-9.-]/g, ""));
  return isNaN(num) ? null : num;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
