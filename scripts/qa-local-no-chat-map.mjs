import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.stack || error)));

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  assert.equal(await page.evaluate(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chat?.length)), false, '新浏览器上下文意外载入了聊天消息');
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(700);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '真实酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_MAP_APP__ === 'function', null, { timeout: 30_000 });
  await frame.evaluate(() => globalThis.__ST_OPEN_MAP_APP__());
  const map = frame.locator('.st-map-app').last();
  await map.waitFor({ state: 'visible' });
  const result = await frame.evaluate(() => ({
    active: Boolean(globalThis.__ST_HYPNOOS_HAS_ACTIVE_CHAT__?.()),
    text: document.querySelector('.st-map-app:last-of-type')?.textContent || '',
    locationCount: document.querySelectorAll('.st-map-app:last-of-type .st-location-item').length,
    locationText: document.querySelector('.st-map-app:last-of-type .st-location-list')?.textContent || '',
  }));
  assert.equal(result.active, false, '宿主桥错误地把空消息上下文判定为已加载聊天');
  assert.equal(result.locationCount, 0, `无聊天地图仍显示 ${result.locationCount} 条地点`);
  assert.match(result.text, /0\s*地点\s*\/\s*0\s*收藏/);
  assert.match(result.text, /未记录/);
  for (const stale of ['私立斋明学园', '警视厅', '综合医院', '西园寺的家']) {
    assert.ok(!result.locationText.includes(stale), `无聊天地图地点列表泄漏旧地点：${stale}`);
  }
  assert.deepEqual(errors, [], `真实酒馆页面异常：${errors.join('\n')}`);
  console.log('PASS local SillyTavern no-chat map stays empty');
} finally {
  await browser.close();
}
