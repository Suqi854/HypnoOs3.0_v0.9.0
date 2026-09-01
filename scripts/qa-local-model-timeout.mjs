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

let frame = null;
let configSnapshot = null;
try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]'), null, { timeout: 30_000 });
  if (!await page.evaluate(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId))) {
    await page.evaluate(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]')?.click());
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId), null, { timeout: 30_000 });
  }
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(700);
  frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '真实酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_SETTINGS_APP__ === 'function', null, { timeout: 30_000 });

  configSnapshot = await frame.evaluate(() => {
    globalThis.__ST_QA_ORIGINAL_GENERATE_RAW__ = globalThis.generateRaw;
    globalThis.__ST_QA_ORIGINAL_FETCH__ = globalThis.fetch;
    globalThis.__ST_HYPNOOS_MODEL_REQUEST_TIMEOUT_MS__ = 1000;
    return localStorage.getItem('hypnoos:model-connectors:v1');
  });

  await frame.evaluate(() => globalThis.__ST_OPEN_SETTINGS_APP__());
  let settings = frame.locator('.st-settings-app').last();
  await settings.waitFor({ state: 'visible' });
  await frame.waitForFunction(() => document.querySelectorAll('[data-settings-profile-worldbooks]').length > 0, null, { timeout: 30_000 });
  await settings.locator('[data-settings-profile-worldbooks]').first().evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await frame.evaluate(() => {
    globalThis.generateRaw = () => new Promise(() => {});
  });
  await settings.locator('[data-settings-action="import-profile-worldbooks"]').click();
  await frame.waitForFunction(() => /酒馆当前模型连接超时（1秒）/.test(document.querySelector('.st-settings-app')?.dataset?.settingsProfileImportStatus || ''), null, { timeout: 8_000 });
  settings = frame.locator('.st-settings-app').last();
  assert.equal(await settings.locator('[data-settings-action="import-profile-worldbooks"]').isDisabled(), false, '档案超时后按钮仍处于忙碌状态');

  await frame.evaluate(() => {
    globalThis.generateRaw = globalThis.__ST_QA_ORIGINAL_GENERATE_RAW__;
    const profile = {
      id: 'qa-timeout', enabled: true, mode: 'direct', endpoint: 'https://qa-timeout.local/v1', model: 'qa-timeout-model',
      secretRef: '', presetName: 'QA timeout', additionalBody: '', excludedBody: '', additionalHeaders: '', temperature: 0.7, topP: 1, maxTokens: 900,
    };
    localStorage.setItem('hypnoos:model-connectors:v1', JSON.stringify({
      schemaVersion: 2, activePresetId: profile.id, presets: [profile], text: profile,
      context: { story: false, variables: false, worldbook: false, notes: '' },
    }));
    globalThis.fetch = (input, init = {}) => {
      if (String(input).startsWith('https://qa-timeout.local/')) {
        return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      }
      return globalThis.__ST_QA_ORIGINAL_FETCH__(input, init);
    };
  });
  await settings.locator('[data-settings-region]').selectOption('auto');
  await frame.waitForFunction(() => document.querySelectorAll('[data-settings-worldbook]').length > 0, null, { timeout: 30_000 });
  settings = frame.locator('.st-settings-app').last();
  await settings.locator('[data-settings-worldbook]').first().evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await settings.locator('[data-settings-action="generate-adaptive"]').click();
  await frame.waitForFunction(() => /文生文模型连接超时（1秒）/.test(document.querySelector('.st-settings-app')?.dataset?.settingsStatus || ''), null, { timeout: 8_000 });
  settings = frame.locator('.st-settings-app').last();
  assert.equal(await settings.locator('[data-settings-action="generate-adaptive"]').isDisabled(), false, '适配模板超时后按钮没有恢复');
  assert.deepEqual(errors, []);
  console.log('PASS local SillyTavern profile and adaptation model timeouts recover their controls');
} finally {
  try {
    if (frame) await frame.evaluate((savedConfig) => {
      globalThis.generateRaw = globalThis.__ST_QA_ORIGINAL_GENERATE_RAW__;
      globalThis.fetch = globalThis.__ST_QA_ORIGINAL_FETCH__;
      delete globalThis.__ST_QA_ORIGINAL_GENERATE_RAW__;
      delete globalThis.__ST_QA_ORIGINAL_FETCH__;
      delete globalThis.__ST_HYPNOOS_MODEL_REQUEST_TIMEOUT_MS__;
      if (savedConfig === null) localStorage.removeItem('hypnoos:model-connectors:v1');
      else localStorage.setItem('hypnoos:model-connectors:v1', savedConfig);
    }, configSnapshot);
  } finally {
    await browser.close();
  }
}
