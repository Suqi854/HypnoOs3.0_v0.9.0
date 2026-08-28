import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const page = await context.newPage();

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'), null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_SETTINGS_APP__ === 'function' && globalThis.Mvu?.getMvuData, null, { timeout: 30_000 });

  await frame.evaluate(() => {
    globalThis.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__ = () => true;
    const core = parent.__HYPNOOS3_CORE_BRIDGE__;
    globalThis.__ST_QA_CHEAT_SNAPSHOT__ = core.Mvu.getMvuData();
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || 'global');
    const keys = ['hypnoos.settings.cheatMode.v1:phone', 'hypnoos.settings.cheatMode.v1:' + scope];
    globalThis.__ST_QA_CHEAT_STORAGE__ = keys.map((key) => ({ key, value: localStorage.getItem(key) }));
    keys.forEach((key) => localStorage.removeItem(key));
    globalThis.__ST_OPEN_SETTINGS_APP__();
  });
  await frame.locator('[data-settings-cheat-key]').fill('666666');
  await frame.locator('[data-settings-action="cheat-on"]').last().evaluate((button) => button.click());
  await frame.waitForTimeout(1_500);

  const granted = await frame.evaluate(() => ({
    system: globalThis.Mvu.getMvuData().stat_data['系统'],
    pageText: document.querySelector('.st-settings-app')?.textContent || '',
  }));
  assert.equal(granted.system['持有零花钱'], 99999999, granted.pageText);
  assert.equal(granted.system['星光点'], 99999999, granted.pageText);
  assert.equal(granted.system['MC能量'], 99999999, granted.pageText);
  assert.equal(granted.system['MC能量上限'], 99999999, granted.pageText);
  assert.doesNotMatch(granted.pageText, /∞/);

  await frame.evaluate(async () => {
    const core = parent.__HYPNOOS3_CORE_BRIDGE__;
    const next = core.Mvu.getMvuData();
    next.stat_data['系统']['持有零花钱'] -= 100;
    next.stat_data['系统']['星光点'] -= 5;
    next.stat_data['系统']['MC能量'] -= 10;
    await core.Mvu.replaceMvuData(next);
    globalThis.__ST_OPEN_INFORMATION_APP__();
  });
  await frame.waitForFunction(() => document.querySelector('.st-information-app'));
  const spent = await frame.evaluate(() => ({
    system: globalThis.Mvu.getMvuData().stat_data['系统'],
    pageText: document.querySelector('.st-information-app')?.textContent || '',
  }));
  assert.equal(spent.system['持有零花钱'], 99999899);
  assert.equal(spent.system['星光点'], 99999994);
  assert.equal(spent.system['MC能量'], 99999989);
  assert.doesNotMatch(spent.pageText, /∞/);
  assert.match(spent.pageText, /99,999,899/);
  assert.match(spent.pageText, /99,999,994/);
  assert.match(spent.pageText, /99,999,989/);

  await frame.evaluate(() => globalThis.__ST_OPEN_SETTINGS_APP__());
  await frame.locator('[data-settings-action="cheat-on"]').last().evaluate((button) => button.click());
  await frame.waitForTimeout(1_500);
  const refilled = await frame.evaluate(() => ({
    system: globalThis.Mvu.getMvuData().stat_data['系统'],
    pageText: document.querySelector('.st-settings-app')?.textContent || '',
  }));
  assert.equal(refilled.system['持有零花钱'], 99999999, refilled.pageText);
  assert.equal(refilled.system['星光点'], 99999999, refilled.pageText);
  assert.equal(refilled.system['MC能量'], 99999999, refilled.pageText);
  assert.equal(refilled.system['MC能量上限'], 99999999, refilled.pageText);
  console.log('PASS local SillyTavern finite cheat grant, spend, display and refill');
} finally {
  try {
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame?.evaluate(async () => {
      if (globalThis.__ST_QA_CHEAT_SNAPSHOT__) await parent.__HYPNOOS3_CORE_BRIDGE__?.Mvu?.replaceMvuData?.(globalThis.__ST_QA_CHEAT_SNAPSHOT__);
      for (const storage of globalThis.__ST_QA_CHEAT_STORAGE__ || []) {
        if (storage.value === null) localStorage.removeItem(storage.key);
        else localStorage.setItem(storage.key, storage.value);
      }
      delete globalThis.__ST_QA_CHEAT_SNAPSHOT__;
      delete globalThis.__ST_QA_CHEAT_STORAGE__;
    });
  } catch {}
  await context.close();
  await browser.close();
}
