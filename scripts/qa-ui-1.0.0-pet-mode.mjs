import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const previewPort = Number(process.env.HYPNOOS_PREVIEW_PORT || 6633);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined,
});

const expectedNames = ['初音未来', '蕾姆', '樱岛麻衣', '土间埋', '爱丽莎', '千杀百花'];

async function verify(viewport, label) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  await page.goto(`http://127.0.0.1:${previewPort}/preview.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const menu = document.createElement('div');
    menu.id = 'extensionsMenu';
    menu.className = 'options-content';
    menu.style.cssText = 'display:none;position:fixed;left:8px;bottom:50px;width:260px;background:#252525;color:white;z-index:2147483000';
    document.body.appendChild(menu);
  });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '手机 iframe 未加载');
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));
  await frame.locator('[aria-label="打开信息"]').dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
  await frame.waitForSelector('.st-information-app');

  const buttons = frame.locator('.st-information-pet-grid [data-information-pet]');
  assert.equal(await buttons.count(), 6, '桌宠选项不是六个');
  assert.deepEqual(await buttons.allTextContents(), expectedNames);
  const grid = await frame.locator('.st-information-pet-grid').evaluate((node) => ({
    columns: getComputedStyle(node).gridTemplateColumns.split(' ').length,
    rows: getComputedStyle(node).gridTemplateRows.split(' ').length,
    overflow: node.scrollWidth > node.clientWidth,
  }));
  assert.deepEqual(grid, { columns: 2, rows: 3, overflow: false }, '桌宠选择没有保持2x3布局');

  await frame.locator('[data-information-pet="rem"]').click();
  await frame.waitForFunction(() => document.querySelector('[data-information-pet="rem"]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hypnoos3.extension.floatingPhone.ui.v1') || '{}').petCharacterId), 'rem');

  await frame.getByRole('button', { name: '切换至收纳模式' }).click();
  await page.waitForFunction(() => {
    const host = document.querySelector('#hypnoos3-extension-floating-phone-host');
    const entry = document.querySelector('#hypnoos-pet-wand-container');
    return host?.shadowRoot?.querySelector('.launcher')?.hidden === true && entry?.style.display !== 'none';
  });
  assert.equal(await page.evaluate(() => document.querySelector('#extensionsMenu')?.lastElementChild?.id), 'hypnoos-pet-wand-container');
  assert.match(await page.locator('#hypnoos-pet-wand-container').innerText(), /桌宠 · 蕾姆/);
  await page.evaluate(() => { document.querySelector('#extensionsMenu').style.display = 'block'; });
  await page.locator('[data-hypnoos-pet-wand]').click();
  assert.equal(await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel')?.classList.contains('open')), true);

  await page.screenshot({ path: `docs/screenshots/1.0.0-${label}-pet-mode.png`, fullPage: true });
  await frame.getByRole('button', { name: '切换至悬浮模式' }).click();
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher')?.hidden === false);
  assert.equal(await page.evaluate(() => document.querySelector('#hypnoos-pet-wand-container')?.style.display), 'none');
  assert.deepEqual(errors, [], `浏览器控制台错误：${errors.join('\n')}`);
  await context.close();
}

try {
  await verify({ width: 1440, height: 1000 }, 'desktop');
  await verify({ width: 390, height: 844 }, 'narrow');
  console.log('PASS six-pet selector and floating/wand storage mode checks');
} finally {
  await browser.close();
}
