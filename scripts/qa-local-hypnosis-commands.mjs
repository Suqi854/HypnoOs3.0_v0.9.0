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
const runtimeErrors = [];
let originalState = null;
const databaseFixture = {
  mate: { version: 'qa-hypnosis-start' },
  sheet_global: { uid: 1, name: '全局数据表', content: [['', '主角当前所在地点', '当前时间'], [1, '催眠QA室', '21:15']] },
  sheet_user: { uid: 2, name: '主角信息', content: [['', '人物名称', '性别/年龄'], [1, '测试玩家', '男/20岁']] },
  sheet_roles: { uid: 3, name: '重要人物表', content: [['', '姓名', '性别/年龄', '外貌特征'], [7, '催眠QA角色', '女/22岁', '测试档案']] },
  sheet_skills: { uid: 4, name: '主角技能表', content: [['', '技能名称', '技能效果']] },
  sheet_inventory: { uid: 5, name: '背包物品表', content: [['', '物品名称', '数量', '描述/效果', '类别']] },
  sheet_tasks: { uid: 6, name: '任务与事件表', content: [['', '任务名称', '详细描述', '当前进度']] },
  sheet_summary: { uid: 7, name: '总结表', content: [['', '时间跨度', '纪要']] },
  sheet_outline: { uid: 8, name: '总体大纲', content: [['', '阶段', '目标']] },
};
page.on('pageerror', (error) => runtimeErrors.push(String(error?.stack || error)));

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]'), null, { timeout: 30_000 });
  if (!await page.evaluate(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId))) {
    await page.evaluate(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]')?.click());
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId), null, { timeout: 30_000 });
  }
  await page.waitForFunction(() => Boolean(globalThis.__HYPNOOS3_RUNTIME__?.store?.state), null, { timeout: 30_000 });
  originalState = await page.evaluate(() => globalThis.__HYPNOOS3_RUNTIME__.store.state);
  await page.evaluate(async (fixture) => {
    const runtime = globalThis.__HYPNOOS3_RUNTIME__;
    runtime.host.__qaHypnosisOriginalReadDatabaseSnapshot = runtime.host.readDatabaseSnapshot;
    runtime.host.readDatabaseSnapshot = async () => fixture;
    await runtime.store.syncDatabaseRuntimeState('qa-hypnosis-command-start');
    await runtime.store.initialize();
  }, databaseFixture);
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'), null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  await page.waitForTimeout(500);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_HYPNOSIS_LITE_APP__ === 'function', null, { timeout: 30_000 });

  const setup = await frame.evaluate(() => {
    globalThis.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__ = () => true;
    globalThis.__ST_QA_SAVED_HYPNOSIS_DRAFTS__ = Object.fromEntries(
      Object.keys(localStorage).filter((key) => key.startsWith('hypnoos.hypnosis-lite.v1:')).map((key) => [key, localStorage.getItem(key)]),
    );
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || 'global');
    globalThis.__ST_QA_CHEAT_KEY__ = 'hypnoos.settings.cheatMode.v1:' + scope;
    globalThis.__ST_QA_SAVED_CHEAT__ = localStorage.getItem(globalThis.__ST_QA_CHEAT_KEY__);
    localStorage.setItem(globalThis.__ST_QA_CHEAT_KEY__, '1');
    globalThis.__ST_OPEN_HYPNOSIS_LITE_APP__();
    const features = Array.from(document.querySelectorAll('[data-hypnosis-feature]'));
    const first = features[0];
    first.checked = true;
    first.dispatchEvent(new Event('change', { bubbles: true }));
    globalThis.__ST_QA_HYPNOSIS_DRAFT_KEY__ = Object.keys(localStorage).find((key) => {
      if (!key.startsWith('hypnoos.hypnosis-lite.v1:')) return false;
      try { return JSON.parse(localStorage.getItem(key) || '{}')?.enabled?.trial_basic === true; } catch { return false; }
    });
    if (!globalThis.__ST_QA_HYPNOSIS_DRAFT_KEY__) throw new Error('没有定位当前聊天的催眠草稿存储键');
    return features.map((node) => node.getAttribute('data-hypnosis-feature')).filter(Boolean);
  });
  assert.equal(setup.length, 36, `预期 36 条催眠指令，实际 ${setup.length}`);

  const results = [];
  for (const featureId of setup.filter((id) => id !== 'vip3_hypnosis_trigger')) {
    await frame.evaluate(() => {
      globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
      globalThis.__ST_OPEN_HYPNOSIS_LITE_APP__();
    });
    const hypnosis = frame.locator('.st-hypnosis-lite-app').last();
    while (await hypnosis.locator('[data-hypnosis-feature]:checked').count()) {
      await hypnosis.locator('[data-hypnosis-feature]:checked').first().evaluate((input) => {
        input.checked = false;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }
    await hypnosis.locator(`[data-hypnosis-feature="${featureId}"]`).evaluate((input) => {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await hypnosis.locator('[data-hypnosis-delivery-mode="number"]').evaluate((button) => button.click());
    assert.match(await hypnosis.locator('[data-hypnosis-delivery-mode="number"]').getAttribute('class') || '', /\bactive\b/, `数字模式没有生效：${featureId}`);
    const note = hypnosis.locator(`[data-hypnosis-feature-note="${featureId}"]`);
    if (await note.count()) await note.fill('QA指令内容');
    const preStart = await frame.evaluate(() => ({
      slotScope: String(globalThis.__ST_HYPNOOS_FRONTEND_SLOT_SCOPE__?.() || ''),
      chatScope: String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || ''),
      drafts: Object.fromEntries(Object.keys(localStorage).filter((key) => key.startsWith('hypnoos.hypnosis-lite.v1:')).map((key) => [key, localStorage.getItem(key)])),
    }));
    const button = hypnosis.locator('[data-hypnosis-start]');
    await button.dispatchEvent('click');
    await page.waitForTimeout(300);
    results.push(await frame.evaluate(({ id, preStart }) => {
      const pending = globalThis.__ST_GET_PENDING_OPERATION_INPUT_LOG__?.() || [];
      const operation = pending.map((entry) => entry?.payload || entry).findLast((entry) => entry?.来源 === '催眠APP');
      return {
        featureId: id,
        notice: document.querySelector('.st-hypnosis-lite-app:last-of-type .st-hypnosis-notice')?.textContent || '',
        operationId: operation?.功能列表?.[0]?.指令ID || '',
        preStart,
      };
    }, { id: featureId, preStart }).then((item) => ({ ...item, featureId: item.featureId || featureId })));
  }

  await frame.evaluate(() => {
    globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
    globalThis.__ST_OPEN_HYPNOSIS_LITE_APP__();
  });
  const triggerPage = frame.locator('.st-hypnosis-lite-app').last();
  while (await triggerPage.locator('[data-hypnosis-feature]:checked').count()) {
    await triggerPage.locator('[data-hypnosis-feature]:checked').first().evaluate((input) => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  await triggerPage.locator('[data-hypnosis-feature="vip3_hypnosis_trigger"]').evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await triggerPage.locator('[data-hypnosis-picker-toggle][data-feature-id="vip3_hypnosis_trigger"]').evaluate((button) => button.click());
  const triggerTargets = triggerPage.locator('[data-hypnosis-select-option="role"][data-feature-id="vip3_hypnosis_trigger"]');
  assert.ok(await triggerTargets.count(), '真实酒馆当前聊天没有可用于催眠扳机 QA 的档案角色');
  const triggerRole = await triggerTargets.first().getAttribute('value');
  await triggerTargets.first().evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await triggerPage.locator('[data-hypnosis-trigger-field="triggerStimuli"]').fill(`{{user}}→${triggerRole}→QA扳机→QA效果`);
  await triggerPage.locator('[data-hypnosis-start]').dispatchEvent('click');
  await page.waitForTimeout(300);
  results.push(await frame.evaluate(() => {
    const pending = globalThis.__ST_GET_PENDING_OPERATION_INPUT_LOG__?.() || [];
    const operation = pending.map((entry) => entry?.payload || entry).findLast((entry) => entry?.来源 === '催眠APP');
    return {
      featureId: 'vip3_hypnosis_trigger',
      notice: document.querySelector('.st-hypnosis-lite-app:last-of-type .st-hypnosis-notice')?.textContent || '',
      operationId: operation?.功能列表?.[0]?.指令ID || '',
    };
  }));

  const failed = results.filter((item) => item.operationId !== item.featureId);
  assert.deepEqual(failed, [], `催眠指令启动失败：${JSON.stringify(failed, null, 2)}`);
  await frame.evaluate(() => {
    globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
    globalThis.__ST_OPEN_HYPNOSIS_LITE_APP__();
  });
  const dedupePage = frame.locator('.st-hypnosis-lite-app').last();
  while (await dedupePage.locator('[data-hypnosis-feature]:checked').count()) {
    await dedupePage.locator('[data-hypnosis-feature]:checked').first().evaluate((input) => {
      input.checked = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  await dedupePage.locator('[data-hypnosis-feature="trial_basic"]').evaluate((input) => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await dedupePage.locator('[data-hypnosis-delivery-mode="number"]').evaluate((button) => button.click());
  await dedupePage.locator('[data-hypnosis-start]').click();
  await page.waitForTimeout(300);
  assert.equal(await frame.evaluate(() => (globalThis.__ST_GET_PENDING_OPERATION_INPUT_LOG__?.() || []).filter((entry) => (entry?.payload || entry)?.来源 === '催眠APP').length), 1, '一次真实点击产生了重复催眠暂存');
  assert.deepEqual(runtimeErrors, [], `运行时异常：${JSON.stringify(runtimeErrors, null, 2)}`);
  console.log(`PASS local SillyTavern hypnosis command click-fallback matrix ${results.length}/36 and physical-click dedupe`);
} finally {
  try {
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
    await frame?.evaluate(() => {
      globalThis.__ST_FORCE_CLEAR_OPERATION_INPUT_LOG__?.();
      if (globalThis.__ST_QA_SAVED_CHEAT__ === null) localStorage.removeItem(globalThis.__ST_QA_CHEAT_KEY__);
      else localStorage.setItem(globalThis.__ST_QA_CHEAT_KEY__, globalThis.__ST_QA_SAVED_CHEAT__);
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('hypnoos.hypnosis-lite.v1:')) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(globalThis.__ST_QA_SAVED_HYPNOSIS_DRAFTS__ || {})) {
        if (value !== null) localStorage.setItem(key, value);
      }
      delete globalThis.__ST_QA_SAVED_HYPNOSIS_DRAFTS__;
      delete globalThis.__ST_QA_HYPNOSIS_DRAFT_KEY__;
      delete globalThis.__ST_QA_CHEAT_KEY__;
      delete globalThis.__ST_QA_SAVED_CHEAT__;
    });
  } catch {}
  if (originalState) {
    try {
      await page.evaluate(async (state) => {
        const runtime = globalThis.__HYPNOOS3_RUNTIME__;
        if (runtime?.host?.__qaHypnosisOriginalReadDatabaseSnapshot) {
          runtime.host.readDatabaseSnapshot = runtime.host.__qaHypnosisOriginalReadDatabaseSnapshot;
          delete runtime.host.__qaHypnosisOriginalReadDatabaseSnapshot;
        }
        await runtime?.store?.replace?.(state, 'qa-hypnosis-command-restore');
      }, originalState);
    } catch {}
  }
  await context.close();
  await browser.close();
}
