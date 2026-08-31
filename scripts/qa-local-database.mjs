import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.stack || error)));

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]'), null, { timeout: 30_000 });
  const active = await page.evaluate(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId));
  if (!active) {
    await page.evaluate(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]')?.click());
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId), null, { timeout: 30_000 });
  }
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const pending = [window]; const seen = [];
    while (pending.length) {
      const view = pending.shift(); if (!view || seen.includes(view)) continue;
      try { seen.push(view); if (typeof view.AutoCardUpdaterAPI?.exportTableAsJson === 'function') return true; for (const frame of view.document.querySelectorAll('iframe')) pending.push(frame.contentWindow); } catch {}
    }
    return false;
  }, null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(1200);
  let frame = null;
  for (const candidate of page.frames().filter((item) => item !== page.mainFrame())) {
    try {
      if (await candidate.evaluate(() => typeof globalThis.getDatabaseSnapshot === 'function')) { frame = candidate; break; }
    } catch {}
  }
  assert.ok(frame, '真实酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.getDatabaseSnapshot === 'function', null, { timeout: 30_000 });

  await frame.evaluate(() => globalThis.__ST_OPEN_SETTINGS_APP__?.());
  const settings = frame.locator('.st-settings-app').last();
  await settings.waitFor({ state: 'visible' });
  assert.deepEqual(await settings.locator('[data-settings-tab]').allTextContents(), ['聊天与变量', '模型插头', '日志']);
  await settings.locator('[data-lite-action="back"]').click();

  const databaseTile = frame.locator('[data-home-app-id="database"]').last();
  await databaseTile.waitFor({ state: 'visible' });
  await databaseTile.click();
  const app = frame.locator('.st-database-app').last();
  await app.waitFor({ state: 'visible' });
  await frame.waitForFunction(() => document.querySelector('.st-database-status')?.textContent?.includes('数据库已连接'), null, { timeout: 30_000 });
  const snapshot = await frame.evaluate(() => globalThis.getDatabaseSnapshot());
  assert.equal(snapshot.available, true);
  assert.ok(snapshot.sheets.length >= 8, `数据库标准表数量不足：${snapshot.sheets.length}`);
  assert.ok(snapshot.sheets.some((sheet) => sheet.name === '重要人物表'));
  assert.ok(snapshot.sheets.some((sheet) => sheet.name === '任务与事件表'));
  assert.equal(await app.locator('[data-database-sheet] option').count(), snapshot.sheets.length);
  await app.locator('[data-database-refresh]').click();
  await frame.waitForFunction(() => !document.querySelector('[data-database-refresh]')?.disabled, null, { timeout: 15_000 });
  assert.deepEqual(errors, []);
  console.log('PASS local SillyTavern database app, three settings tabs and live AutoCardUpdaterAPI tables', { sheetCount: snapshot.sheets.length, signature: snapshot.signature });
} finally {
  await browser.close();
}
