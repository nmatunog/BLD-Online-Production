/**
 * Capture BEFORE (static HTML) and AFTER (Next preview) check-in UX screenshots.
 * Usage: node scripts/ux-screenshots/capture.mjs [before|after|all]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.SCREENSHOT_DIR || '/opt/cursor/artifacts/checkin-ux';
const mode = process.argv[2] || 'all';
const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:3000';

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

async function shot(page, name, size) {
  await page.setViewportSize(size);
  const dest = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: true });
  console.log('wrote', dest);
}

async function captureBefore(browser) {
  const page = await browser.newPage();
  const files = [
    ['before-staff-phone', 'before-staff.html', PHONE],
    ['before-member-phone', 'before-member.html', PHONE],
    ['before-nav-phone', 'before-nav.html', PHONE],
    ['before-desktop', 'before-desktop.html', DESKTOP],
  ];
  for (const [name, file, size] of files) {
    await page.goto(`file://${path.join(__dirname, file)}`);
    await shot(page, name, size);
  }
  await page.close();
}

async function captureAfter(browser) {
  const page = await browser.newPage();
  const shots = [
    ['after-staff-phone', `${baseUrl}/ux-preview/checkin?view=staff`, PHONE],
    ['after-staff-success-phone', `${baseUrl}/ux-preview/checkin?view=staff-success`, PHONE],
    ['after-member-phone', `${baseUrl}/ux-preview/checkin?view=member`, PHONE],
    ['after-nav-phone', `${baseUrl}/ux-preview/checkin?view=nav`, PHONE],
    ['after-desktop', `${baseUrl}/ux-preview/checkin?view=desktop`, DESKTOP],
  ];
  for (const [name, url, size] of shots) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, name, size);
  }
  await page.close();
}

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  if (mode === 'before' || mode === 'all') await captureBefore(browser);
  if (mode === 'after' || mode === 'all') await captureAfter(browser);
} finally {
  await browser.close();
}
