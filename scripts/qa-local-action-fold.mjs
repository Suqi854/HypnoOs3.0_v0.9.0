import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host'), null, { timeout: 30_000 });
  await page.evaluate(() => {
    document.querySelector('#hypnoos-action-fold-qa')?.remove();
    const root = document.createElement('div');
    root.id = 'hypnoos-action-fold-qa';
    root.className = 'mes_text';
    root.textContent = '<本轮操作>\n<本轮执行边界>测试边界</本轮执行边界>\n<操作项><操作名>拿起水杯</操作名><操作内容>备注=拿起水杯</操作内容></操作项>\n</本轮操作>';
    document.body.appendChild(root);
  });
  const fold = page.locator('#hypnoos-action-fold-qa details[data-hypnoos-action-fold="v3"]');
  await fold.waitFor({ state: 'visible', timeout: 10_000 });
  assert.equal(await fold.getAttribute('open'), null, '本轮操作默认没有折叠');
  const summary = fold.locator(':scope > summary');
  assert.match(await summary.innerText(), /前端操作\s*本轮操作\s*点击展开/);
  await summary.click();
  assert.notEqual(await fold.getAttribute('open'), null, '点击后没有展开本轮操作');
  assert.match(await fold.locator('[data-hypnoos-action-body="v3"]').innerText(), /拿起水杯/);
  await page.evaluate(() => document.querySelector('#hypnoos-action-fold-qa')?.remove());
  console.log('PASS local SillyTavern built-in action fold');
} finally {
  await context.close();
  await browser.close();
}
