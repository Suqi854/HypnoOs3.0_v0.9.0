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
  await page.waitForTimeout(500);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_PENDING_INPUT_APP__ === 'function', null, { timeout: 30_000 });

  await frame.evaluate(() => {
    globalThis.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__ = () => true;
    globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
    globalThis.__ST_SET_PENDING_OPERATION_NOTE__?.('', { emit: false });
    globalThis.__ST_QA_SAVED_HYPNOSIS_DRAFTS__ = Object.fromEntries(
      Object.keys(localStorage).filter((key) => key.startsWith('hypnoos.hypnosis-lite.v1:')).map((key) => [key, localStorage.getItem(key)]),
    );
    globalThis.__ST_APPEND_OPERATION_TO_INPUT__?.({
      来源: '催眠APP',
      操作: '启动催眠',
      功能列表: [{ 指令ID: 'vip3_hypnosis_trigger', 指令: '催眠扳机', 备注: '真实酒馆完整催眠原文' }],
      催眠指令: [{ 指令: '催眠扳机', 备注: '真实酒馆完整催眠原文' }],
      MC能量消耗: '1000点',
    });
    globalThis.__ST_OPEN_PENDING_INPUT_APP__();
  });
  const note = frame.locator('[data-operation-note]');
  await note.waitFor({ state: 'visible' });
  const hypnosisDetail = frame.locator('.st-operation-item-detail').first();
  assert.match(await hypnosisDetail.locator('summary').innerText(), /查看完整催眠指令/);
  if (!await hypnosisDetail.evaluate((element) => element.open)) {
    await hypnosisDetail.locator('summary').dispatchEvent('pointerdown', { pointerId: 1, button: 0 });
  }
  const hypnosisDetailState = await hypnosisDetail.evaluate((element) => ({
    open: element.open,
    innerText: element.innerText,
    textContent: element.textContent,
    detailsDisplay: getComputedStyle(element.querySelector('dl')).display,
  }));
  assert.equal(hypnosisDetailState.open, true);
  assert.match(hypnosisDetailState.textContent, /真实酒馆完整催眠原文/);
  assert.notEqual(hypnosisDetailState.detailsDisplay, 'none');
  const initialInputMetrics = await frame.evaluate(() => {
    const input = document.querySelector('[data-operation-note]');
    const header = document.querySelector('.st-operation-panel-head');
    const item = document.querySelector('.st-operation-item');
    const style = getComputedStyle(input);
    return { height: input.getBoundingClientRect().height, top: input.getBoundingClientRect().top, headerTop: header.getBoundingClientRect().top, itemTop: item.getBoundingClientRect().top, fontSize: style.fontSize };
  });
  assert.equal(initialInputMetrics.height, 50);
  assert.equal(initialInputMetrics.fontSize, '22px');
  await note.fill(Array.from({ length: 9 }, (_, index) => `真实酒馆输入第${index + 1}行`).join('\n'));
  const expandedInputMetrics = await frame.evaluate(() => {
    const input = document.querySelector('[data-operation-note]');
    const header = document.querySelector('.st-operation-panel-head');
    const item = document.querySelector('.st-operation-item');
    return { height: input.getBoundingClientRect().height, top: input.getBoundingClientRect().top, headerTop: header.getBoundingClientRect().top, itemTop: item.getBoundingClientRect().top };
  });
  assert.ok(expandedInputMetrics.height > initialInputMetrics.height, '输入框没有随输入向下增高');
  assert.ok(Math.abs(expandedInputMetrics.top - initialInputMetrics.top) <= 1, '输入框顶边在增高时发生移动');
  assert.ok(Math.abs(expandedInputMetrics.headerTop - initialInputMetrics.headerTop) <= 1, '上方标题在输入时发生移动');
  assert.ok(Math.abs(expandedInputMetrics.itemTop - initialInputMetrics.itemTop) <= 1, '上方暂存指令在输入时发生移动');
  await note.fill('');
  await note.focus();
  await note.pressSequentially('拿起水杯', { delay: 30 });
  assert.equal(await note.inputValue(), '拿起水杯');
  assert.equal(await frame.evaluate(() => document.activeElement?.matches?.('[data-operation-note]')), true, '输入过程中编辑焦点已退出');
  const sizeBefore = await page.evaluate(() => {
    const panel = document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.panel');
    return { width: panel.offsetWidth, height: panel.offsetHeight };
  });
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  assert.equal(await frame.evaluate(() => document.activeElement?.matches?.('[data-operation-note]')), true, '页面 resize 事件使编辑焦点退出');
  await page.setViewportSize({ width: 390, height: 520 });
  await page.waitForTimeout(250);
  const sizeAfter = await page.evaluate(() => {
    const panel = document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.panel');
    return { width: panel.offsetWidth, height: panel.offsetHeight };
  });
  assert.deepEqual(sizeAfter, sizeBefore, '手机键盘视口变化时整台催眠手机被重新缩放');
  assert.equal(await note.inputValue(), '拿起水杯', '视口变化后玩家输入内容丢失');

  await frame.evaluate(() => {
    globalThis.__ST_SET_PENDING_OPERATION_NOTE__?.('', { emit: false });
    globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || 'global');
    localStorage.setItem('hypnoos.settings.cheatMode.v1:' + scope, '1');
    globalThis.__ST_OPEN_HYPNOSIS_LITE_APP__();
  });
  const hypnosis = frame.locator('.st-hypnosis-lite-app');
  await hypnosis.waitFor({ state: 'visible' });
  while (await hypnosis.locator('[data-hypnosis-feature]:checked').count()) {
    await hypnosis.locator('[data-hypnosis-feature]:checked').first().evaluate((input) => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  await hypnosis.locator('[data-hypnosis-delivery-mode="number"]').evaluate((button) => button.click());
  const feature = hypnosis.locator('[data-hypnosis-feature]:not([disabled])').first();
  await feature.evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const featureId = await feature.getAttribute('data-hypnosis-feature');
  const featureNote = hypnosis.locator(`[data-hypnosis-feature-note="${featureId}"]`);
  if (await featureNote.count()) await featureNote.fill('真实酒馆触摸启动测试');
  await hypnosis.locator('[data-hypnosis-start]').dispatchEvent('touchstart');
  await page.waitForTimeout(1000);
  const mobileStartState = await frame.evaluate(() => ({
    notice: document.querySelector('.st-hypnosis-notice')?.textContent || '',
    pending: globalThis.__ST_GET_PENDING_OPERATION_INPUT_LOG__?.() || [],
    selected: Array.from(document.querySelectorAll('[data-hypnosis-feature]:checked')).map((input) => input.getAttribute('data-hypnosis-feature')),
  }));
  assert.ok(mobileStartState.pending.some((entry) => String((entry?.payload || entry)?.来源 || '') === '催眠APP'), `触摸启动没有写入本轮输入：${JSON.stringify(mobileStartState)}`);
  const operation = await frame.evaluate(() => {
    const entry = (globalThis.__ST_GET_PENDING_OPERATION_INPUT_LOG__?.() || []).findLast((item) => String((item?.payload || item)?.来源 || '') === '催眠APP');
    return entry?.payload || entry || null;
  });
  assert.match(String(operation?.操作 || ''), /^(启动催眠|追加催眠)$/);
  await frame.evaluate(() => {
    globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || 'global');
    localStorage.removeItem('hypnoos.settings.cheatMode.v1:' + scope);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('hypnoos.hypnosis-lite.v1:')) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(globalThis.__ST_QA_SAVED_HYPNOSIS_DRAFTS__ || {})) {
      if (value !== null) localStorage.setItem(key, value);
    }
    delete globalThis.__ST_QA_SAVED_HYPNOSIS_DRAFTS__;
  });
  console.log('PASS local SillyTavern mobile pending input focus and hypnosis touch start');
} finally {
  await context.close();
  await browser.close();
}
