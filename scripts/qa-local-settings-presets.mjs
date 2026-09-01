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
const fulfillModelRoute = async (route) => {
  if (route.request().url().endsWith('/models')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: 'qa-persistent-model' }] }) });
    return;
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: null, reasoning_content: 'OK' } }] }) });
};
await page.route('https://qa-hypnoos.local/**', fulfillModelRoute);
await page.route('**/api/backends/chat-completions/generate', fulfillModelRoute);

let frame = null;
let storageSnapshot = null;
let originalChatId = '';
const presetName = 'Codex QA 临时预设 ' + Date.now();
try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#rm_print_characters_block .character_select[data-chid]')).some((node) => Number.isInteger(Number(node.getAttribute('data-chid')))), null, { timeout: 30_000 });
  const initialRuntime = await page.evaluate(() => {
    const st = globalThis.SillyTavern?.getContext?.();
    return { characterId: st?.characterId, chatId: st?.chatId };
  });
  if (!Number.isInteger(Number(initialRuntime.characterId)) || !initialRuntime.chatId) {
    await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('#rm_print_characters_block .character_select[data-chid]')).find((node) => Number.isInteger(Number(node.getAttribute('data-chid'))));
      card?.click();
    });
    await page.waitForFunction(() => {
      const st = globalThis.SillyTavern?.getContext?.();
      return Number.isInteger(Number(st?.characterId)) && Boolean(st?.chatId);
    }, null, { timeout: 30_000 });
  }
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('dialog[open]')).some((dialog) => /正在初始化/.test(dialog.innerText || '')), null, { timeout: 30_000 });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(700);
  frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '真实酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.getArchiveWorldbookOptions === 'function', null, { timeout: 30_000 });
  storageSnapshot = await frame.evaluate(() => {
    const secretPrefix = 'hypnoos:model-connectors:persistent-secret:v2:';
    const secrets = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(secretPrefix)) secrets[key] = localStorage.getItem(key);
    }
    return { config: localStorage.getItem('hypnoos:model-connectors:v1'), secrets };
  });
  originalChatId = await page.evaluate(() => String(globalThis.SillyTavern?.getContext?.()?.chatId || ''));

  await frame.evaluate(() => globalThis.__ST_OPEN_SETTINGS_APP__?.());
  const settings = frame.locator('.st-settings-app').last();
  await settings.waitFor({ state: 'visible' });
  await settings.locator('[data-settings-tab="models"]').click();
  await settings.locator('[data-connector-profile="text"]').waitFor({ state: 'visible' });
  await settings.locator('[data-connector-preset-new]').click();
  assert.equal(await settings.evaluate((node) => node.dataset.connectorPresetDraft), 'new', '新增预设按钮没有进入草稿状态');
  assert.equal(await settings.locator('[data-connector-preset-select]').inputValue(), '', '新增预设下拉状态不正确');
  await settings.locator('[data-connector-field="presetName"]').fill(presetName);
  const enabledButton = settings.locator('[data-connector-enabled]');
  if (await enabledButton.getAttribute('aria-pressed') !== 'true') await enabledButton.click();
  assert.equal(await enabledButton.getAttribute('aria-pressed'), 'true');
  await settings.locator('[data-connector-field="endpoint"]').fill('https://qa-hypnoos.local/v1');
  await settings.locator('[data-connector-secret="text"]').fill('qa-persistent-secret');
  await settings.getByRole('button', { name: '加载模型' }).click();
  await settings.locator('[data-connector-model-list="text"]').selectOption('qa-persistent-model');
  await settings.getByRole('button', { name: '保存当前预设' }).click();
  await frame.waitForFunction((name) => document.body?.innerText?.includes(`API 预设“${name}”已保存`), presetName, { timeout: 15_000 });
  const saved = await frame.evaluate((name) => {
    const config = JSON.parse(localStorage.getItem('hypnoos:model-connectors:v1'));
    const preset = config.presets.find((item) => item.presetName === name);
    return { config, preset, secret: preset ? localStorage.getItem('hypnoos:model-connectors:persistent-secret:v2:' + preset.id) : '' };
  }, presetName);
  assert.equal(saved.config.schemaVersion, 2);
  assert.equal(saved.preset.model, 'qa-persistent-model');
  assert.equal(saved.secret, 'qa-persistent-secret');

  await settings.locator('[data-connector-test="text"]').click();
  await frame.waitForFunction(() => document.querySelector('.st-settings-app')?.dataset?.settingsStatus === '文生文插头连接成功。', null, { timeout: 30_000 });

  const candidates = await page.evaluate(async () => {
    const st = globalThis.SillyTavern?.getContext?.();
    const character = st?.characters?.[st?.characterId];
    const response = await fetch('/api/characters/chats', { method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ avatar_url: character?.avatar }) });
    const data = response.ok ? await response.json() : {};
    return Object.values(data || {}).map((item) => String(item?.file_name || '')).filter((name) => name && name !== st?.chatId);
  });
  assert.ok(originalChatId && candidates.length, '当前角色没有第二个聊天，无法验证密钥跨聊天持久化');
  await page.evaluate((chatId) => globalThis.SillyTavern.getContext().openCharacterChat(chatId), candidates[0]);
  await page.waitForFunction((chatId) => globalThis.SillyTavern?.getContext?.()?.chatId === chatId, candidates[0], { timeout: 30_000 });
  const afterSwitch = await frame.evaluate((id) => ({
    config: JSON.parse(localStorage.getItem('hypnoos:model-connectors:v1')),
    secret: localStorage.getItem('hypnoos:model-connectors:persistent-secret:v2:' + id),
  }), saved.preset.id);
  assert.equal(afterSwitch.config.presets.some((preset) => preset.id === saved.preset.id), true);
  assert.equal(afterSwitch.secret, 'qa-persistent-secret');

  await page.evaluate((chatId) => globalThis.SillyTavern.getContext().openCharacterChat(chatId), originalChatId);
  await page.waitForFunction((chatId) => globalThis.SillyTavern?.getContext?.()?.chatId === chatId, originalChatId, { timeout: 30_000 });
  await frame.evaluate(() => globalThis.__ST_OPEN_SETTINGS_APP__?.());
  const returnedSettings = frame.locator('.st-settings-app').last();
  await returnedSettings.locator('[data-settings-tab="models"]').click();
  await returnedSettings.locator('[data-connector-profile="text"]').waitFor({ state: 'visible' });
  await returnedSettings.locator('[data-connector-preset-delete="' + saved.preset.id + '"]').click();
  await returnedSettings.getByRole('button', { name: '确认删除' }).click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('已删除 API 预设'), null, { timeout: 15_000 });
  const removed = await frame.evaluate((id) => {
    const config = JSON.parse(localStorage.getItem('hypnoos:model-connectors:v1'));
    return { exists: config.presets.some((preset) => preset.id === id), secret: localStorage.getItem('hypnoos:model-connectors:persistent-secret:v2:' + id) };
  }, saved.preset.id);
  assert.deepEqual(removed, { exists: false, secret: null });
  assert.deepEqual(errors, []);
  console.log('PASS local SillyTavern model presets persist across chat switching and delete cleanly', { presetName, switchedChatId: candidates[0] });
} finally {
  try {
    if (originalChatId) {
      await page.evaluate((chatId) => globalThis.SillyTavern?.getContext?.()?.openCharacterChat?.(chatId), originalChatId);
      await page.waitForFunction((chatId) => globalThis.SillyTavern?.getContext?.()?.chatId === chatId, originalChatId, { timeout: 15_000 }).catch(() => {});
    }
    if (frame && storageSnapshot) await frame.evaluate((snapshot) => {
      const configKey = 'hypnoos:model-connectors:v1';
      const secretPrefix = 'hypnoos:model-connectors:persistent-secret:v2:';
      if (snapshot.config === null) localStorage.removeItem(configKey); else localStorage.setItem(configKey, snapshot.config);
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(secretPrefix)) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
      Object.entries(snapshot.secrets || {}).forEach(([key, value]) => localStorage.setItem(key, value));
    }, storageSnapshot);
  } finally {
    await browser.close();
  }
}
