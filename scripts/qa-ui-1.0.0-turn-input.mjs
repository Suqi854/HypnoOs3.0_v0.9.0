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

const page = await browser.newPage({ viewport: { width: 1180, height: 980 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
await page.goto(`http://127.0.0.1:${previewPort}/preview.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const context = {
    characterId: 0,
    chatId: 'qa-turn-input',
    chatMetadata: {},
    characters: [{ name: 'QA角色', avatar: 'qa.png', data: { extensions: {} } }],
    chat: [{
      mes: 'QA消息', is_user: false, name: 'QA角色',
      variables: { stat_data: {
        系统: { MC能量: 9999, MC能量上限: 9999, 催眠APP订阅等级: 'VIP3' },
        角色: { QA女性: { 信息: { 性别: '女' }, 状态: {}, 效果: {} } },
      } },
    }],
    saveMetadataDebounced() {}, setExtensionPrompt() {}, getWorldInfoNames() { return []; },
    eventSource: { on() {}, removeListener() {} }, eventTypes: {},
  };
  globalThis.SillyTavern = { getContext: () => context };
});
await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
assert.ok(frame, '手机 iframe 未加载');
await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));
await frame.evaluate(async () => {
  globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
  globalThis.__ST_SET_PENDING_OPERATION_NOTE__?.('', { emit: false });
  await globalThis.__ST_APPEND_OPERATION_TO_INPUT__?.({
    来源: '催眠APP',
    操作: '启动催眠',
    功能列表: [{ 指令ID: 'vip3_hypnosis_trigger', 指令: '催眠扳机', 催眠者: '{{user}}', 被催眠者: 'QA女性', 备注: 'QA完整催眠原文' }],
    催眠指令: [{ 指令: '催眠扳机', 催眠者: '{{user}}', 被催眠者: 'QA女性', 备注: 'QA完整催眠原文' }],
    MC能量消耗: '1000点',
  });
});
await frame.locator('[aria-label="打开本轮输入"]').dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
await frame.waitForSelector('.st-operation-phone-app [data-operation-note]');

const detail = frame.locator('.st-operation-item-detail').first();
assert.match(await detail.locator('summary').innerText(), /查看完整催眠指令/);
await detail.locator('summary').click();
assert.match(await detail.innerText(), /完整催眠指令/);
assert.match(await detail.innerText(), /QA完整催眠原文/);

const input = frame.locator('[data-operation-note]');
const initial = await frame.evaluate(() => {
  const input = document.querySelector('[data-operation-note]');
  const header = document.querySelector('.st-operation-panel-head');
  const item = document.querySelector('.st-operation-item');
  const style = getComputedStyle(input);
  return {
    height: input.getBoundingClientRect().height,
    top: input.getBoundingClientRect().top,
    headerTop: header.getBoundingClientRect().top,
    itemTop: item.getBoundingClientRect().top,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
  };
});
assert.equal(initial.height, 50);
assert.equal(initial.fontSize, '22px');
assert.equal(initial.lineHeight, '36.3px');

await input.fill(Array.from({ length: 9 }, (_, index) => `玩家本轮输入第${index + 1}行`).join('\n'));
const expanded = await frame.evaluate(() => {
  const input = document.querySelector('[data-operation-note]');
  const header = document.querySelector('.st-operation-panel-head');
  const item = document.querySelector('.st-operation-item');
  return {
    height: input.getBoundingClientRect().height,
    top: input.getBoundingClientRect().top,
    headerTop: header.getBoundingClientRect().top,
    itemTop: item.getBoundingClientRect().top,
    overflowY: getComputedStyle(input).overflowY,
  };
});
assert.ok(expanded.height > initial.height, `输入框没有随多行输入向下增高：${JSON.stringify({ initial, expanded })}`);
assert.ok(Math.abs(expanded.top - initial.top) <= 1, `输入框顶边发生移动：${JSON.stringify({ initial, expanded })}`);
assert.ok(Math.abs(expanded.headerTop - initial.headerTop) <= 1, '上方标题在输入时发生移动');
assert.ok(Math.abs(expanded.itemTop - initial.itemTop) <= 1, '上方暂存指令在输入时发生移动');
assert.equal(expanded.overflowY, 'hidden');
assert.deepEqual(errors, []);
await page.screenshot({ path: 'docs/screenshots/1.0.0-turn-input-readable.png', fullPage: true });
await browser.close();
console.log(JSON.stringify({ initial, expanded }, null, 2));
