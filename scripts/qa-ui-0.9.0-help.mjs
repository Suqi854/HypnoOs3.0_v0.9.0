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

async function verifyHelp(viewport, screenshotName) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  await page.goto(`http://127.0.0.1:${previewPort}/preview.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '手机 iframe 未加载');
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));
  assert.equal(await frame.locator('[data-home-app-id="help"]').count(), 0, '主页仍显示帮助磁贴');

  await frame.locator('[aria-label="打开设置"]').dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
  await frame.waitForSelector('.st-settings-app');
  const toggle = frame.locator('[data-settings-action="toggle-help"]');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', '帮助按钮默认没有收起');
  const placement = await frame.evaluate(() => {
    const worldbookPanel = Array.from(document.querySelectorAll('.st-settings-panel'))
      .find((panel) => panel.querySelector('h3')?.textContent?.trim() === '世界书适配数据');
    const helpPanel = document.querySelector('.st-settings-help-panel');
    return {
      adjacent: worldbookPanel?.nextElementSibling === helpPanel,
      bodyOverflow: document.querySelector('.st-settings-app .st-lite-body')?.scrollWidth - document.querySelector('.st-settings-app .st-lite-body')?.clientWidth,
    };
  });
  assert.equal(placement.adjacent, true, '帮助按钮不在世界书适配数据正下方');
  assert.ok(placement.bodyOverflow <= 1, '收起状态发生横向溢出');

  await toggle.click();
  const expandedToggle = frame.locator('[data-settings-action="toggle-help"]');
  assert.equal(await expandedToggle.getAttribute('aria-expanded'), 'true', '帮助按钮点击后没有展开');
  const helpText = await frame.locator('.st-settings-help-content').innerText();
  assert.match(helpText, /本插件基于二创改编，原作者：Ramiel；二改作者：louisHM；本插件作者SuQi/);
  assert.doesNotMatch(helpText, /社区提醒|本卡完全免费且为社区大家共同努力的结果/);
  const expandedOverflow = await frame.evaluate(() => {
    const body = document.querySelector('.st-settings-app .st-lite-body');
    return body ? body.scrollWidth - body.clientWidth : 0;
  });
  assert.ok(expandedOverflow <= 1, '展开状态发生横向溢出');
  await frame.evaluate(() => {
    const worldbookPanel = Array.from(document.querySelectorAll('.st-settings-panel'))
      .find((panel) => panel.querySelector('h3')?.textContent?.trim() === '世界书适配数据');
    const body = document.querySelector('.st-settings-app .st-lite-body');
    if (worldbookPanel && body) body.scrollTop = Math.max(0, worldbookPanel.offsetTop - 130);
  });
  await page.screenshot({ path: `docs/screenshots/${screenshotName}`, fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
}

await verifyHelp({ width: 1180, height: 900 }, '0.9.0-desktop-settings-help.png');
await verifyHelp({ width: 760, height: 900 }, '0.9.0-narrow-settings-help.png');
console.log('PASS 0.9.0 help placement, accordion, notice, and overflow checks');
await browser.close();
