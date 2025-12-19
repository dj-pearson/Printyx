import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function capture() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // Set a large viewport
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    console.log('Navigating to icon export file...');
    const iconPath = path.join(__dirname, 'client/public/logos/icon-export.html');
    await page.goto(`file://${iconPath}`, { waitUntil: 'load' });

    console.log('Capturing icon...');
    await page.screenshot({
      path: 'client/public/logos/icon.png',
      omitBackground: false,
    });

    console.log('Navigating to logo export file...');
    const logoPath = path.join(__dirname, 'client/public/logos/logo-export.html');
    await page.goto(`file://${logoPath}`, { waitUntil: 'load' });

    // Resize viewport for logo
    await page.setViewport({ width: 1000, height: 300, deviceScaleFactor: 2 });

    console.log('Capturing logo...');
    await page.screenshot({
      path: 'client/public/logos/logo.png',
      omitBackground: false,
    });

    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

capture();
