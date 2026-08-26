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

async function verify(viewport, screenshotName) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  await page.goto(`http://127.0.0.1:${previewPort}/preview.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const context = {
      characterId: 0,
      chatId: 'qa-hypnosis-trigger',
      chatMetadata: {},
      characters: [{ name: 'QA角色', avatar: 'qa.png', data: { extensions: {} } }],
      chat: [{
        mes: '测试消息',
        is_user: false,
        name: 'QA角色',
        variables: {
          stat_data: {
            系统: { MC能量: 9999, MC能量上限: 9999, 催眠APP订阅等级: 'VIP3' },
            角色: {
              测试甲: { 信息: { 性别: '女' }, 状态: {}, 效果: { 催眠扳机: {}, 临时催眠效果: {}, 永久催眠效果: {} } },
              测试乙: { 信息: { 性别: '男' }, 状态: {}, 效果: { 催眠扳机: {}, 临时催眠效果: {}, 永久催眠效果: {} } },
            },
          },
        },
      }],
      saveMetadataDebounced() {},
      setExtensionPrompt() {},
      getWorldInfoNames() { return []; },
      eventSource: { on() {}, removeListener() {} },
      eventTypes: {},
    };
    globalThis.SillyTavern = { getContext: () => context };
  });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '手机 iframe 未加载');
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));
  await frame.evaluate(() => {
    localStorage.setItem('hypnoos:profile-worldbook-roles:v1:global', JSON.stringify({
      roles: {
        测试甲: { 信息: { 性别: '女' }, 状态: {}, 效果: { 催眠扳机: {}, 临时催眠效果: {}, 永久催眠效果: {} } },
        测试乙: { 信息: { 性别: '男' }, 状态: {}, 效果: { 催眠扳机: {}, 临时催眠效果: {}, 永久催眠效果: {} } },
      },
    }));
  });
  await frame.locator('[aria-label="打开催眠APP"]').dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
  await frame.waitForSelector('.st-hypnosis-lite-app');
  assert.equal(await frame.locator('[data-hypnosis-feature="vip3_hypnosis_trigger"]').isDisabled(), true, '未开VIP3或作弊模式时催眠扳机仍可用');
  await frame.locator('.st-hypnosis-lite-app [data-lite-action="back"]').click();
  await frame.evaluate(() => {
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || 'global');
    localStorage.setItem('hypnoos.settings.cheatMode.v1:' + scope, '1');
  });
  await frame.locator('[aria-label="打开催眠APP"]').dispatchEvent('pointerdown', { button: 0, pointerId: 1 });
  await frame.waitForSelector('.st-hypnosis-lite-app');

  const vip3 = frame.locator('[data-hypnosis-tier-details="VIP3"]');
  if (await vip3.getAttribute('open') === null) await vip3.locator('summary').click();
  const vip3Ids = await vip3.locator('[data-hypnosis-feature]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-hypnosis-feature')));
  assert.equal(vip3Ids[0], 'vip3_hypnosis_trigger');
  assert.equal(await frame.locator('[data-hypnosis-feature="vip3_hypnosis_trigger"]').isDisabled(), false, '作弊模式没有解锁催眠扳机');
  await frame.locator('[data-hypnosis-feature="vip3_hypnosis_trigger"]').check();
  await frame.evaluate(() => {
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__?.() || 'global');
    localStorage.removeItem('hypnoos.settings.cheatMode.v1:' + scope);
  });
  assert.equal(await frame.locator('[data-hypnosis-delivery-mode="number"]').isDisabled(), true);
  for (const label of ['催眠者', '目标角色']) assert.match(await vip3.innerText(), new RegExp(label));
  assert.equal(await frame.locator('[data-hypnosis-trigger-field="triggerStimuli"]').getAttribute('placeholder'), '催眠者→目标角色→催眠扳机→效果');
  assert.equal(await frame.locator('[data-hypnosis-trigger-field="triggerEffects"]').count(), 0);

  await frame.locator('[data-hypnosis-picker-toggle][data-feature-id="vip3_hypnosis_trigger"]').click();
  await frame.locator('[data-hypnosis-select-option="role"][data-feature-id="vip3_hypnosis_trigger"][value="测试甲"]').check();
  await frame.locator('[data-hypnosis-select-option="role"][data-feature-id="vip3_hypnosis_trigger"][value="测试乙"]').check();
  await frame.locator('[data-hypnosis-trigger-field="triggerStimuli"]').fill('{{user}}→测试甲、测试乙→晚安/测试→立即进入预先设定的安静等待状态');
  assert.match(await frame.locator('.st-hypnosis-total').innerText(), /2000 MC/);
  const overflow = await frame.evaluate(() => {
    const body = document.querySelector('.st-hypnosis-lite-app .st-lite-body');
    return body ? body.scrollWidth - body.clientWidth : 0;
  });
  assert.ok(overflow <= 1, `催眠扳机表单横向溢出 ${overflow}px`);
  await page.screenshot({ path: `docs/screenshots/${screenshotName}`, fullPage: true });

  await frame.locator('[data-hypnosis-start]').click();
  await frame.waitForFunction(() => /(?:启动|追加)催眠已暂存/.test(document.querySelector('.st-hypnosis-lite-app')?.innerText || ''));
  const operation = await frame.evaluate(() => {
    const entry = (globalThis.__ST_GET_PENDING_OPERATION_INPUT_LOG__?.() || []).findLast((item) => (item?.payload || item)?.来源 === '催眠APP');
    return entry?.payload || entry || null;
  });
  const command = operation?.功能列表?.find((item) => item?.指令ID === 'vip3_hypnosis_trigger');
  assert.equal(operation?.MC能量消耗, '2000点');
  assert.equal(command?.永久效果, '是；无结束时间，直到明确解除或删除');
  assert.deepEqual(command?.催眠扳机变量路径, [
    '/角色/测试甲/效果/催眠扳机/晚安~1测试',
    '/角色/测试乙/效果/催眠扳机/晚安~1测试',
  ]);
  assert.deepEqual(errors, []);
  await page.close();
}

await verify({ width: 1180, height: 900 }, '1.0.0-desktop-hypnosis-trigger.png');
await verify({ width: 760, height: 900 }, '1.0.0-narrow-hypnosis-trigger.png');
console.log('PASS VIP3 permanent hypnosis trigger UI, pricing, paths, and responsive checks');
await browser.close();
