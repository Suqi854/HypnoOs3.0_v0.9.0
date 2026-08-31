import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { getHypnosisRules } from '../src/hypnosis-rules.js';

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
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(800);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.getArchiveWorldbookOptions === 'function' && typeof globalThis.configureArchiveWorldbook === 'function', null, { timeout: 30_000 });
  let options = await frame.evaluate(() => globalThis.getArchiveWorldbookOptions());
  assert.equal(await frame.locator('.st-archive-bind-overlay').count(), 0, '手机打开时不应自动弹出档案存储界面');
  assert.equal(await frame.evaluate(() => typeof globalThis.__ST_ENSURE_ARCHIVE_BINDING_PROMPT__), 'undefined');

  await frame.evaluate(() => {
    globalThis.__ST_OPEN_SETTINGS_APP__?.();
  });
  const settings = frame.locator('.st-settings-app').last();
  await settings.waitFor({ state: 'visible' });
  await settings.locator('.st-settings-archive-binding-panel').waitFor({ state: 'visible' });
  assert.equal(await settings.locator('[data-settings-action="archive-create"]').count(), 1);
  assert.equal(await settings.locator('[data-settings-action="archive-character"]').count(), 1);
  assert.equal(await settings.locator('[data-settings-action="archive-migrate"]').count(), 1);
  const order = await settings.evaluate((node) => ({
    binding: node.innerHTML.indexOf('<h3>世界书绑定</h3>'),
    archive: node.innerHTML.indexOf('<h3>档案</h3>'),
  }));
  assert.ok(order.binding >= 0 && order.binding < order.archive, '档案世界书绑定模块没有位于档案设置之前');

  const targetName = String(options?.binding?.worldbookName || options?.names?.find((name) => String(name).startsWith('HypnoOS档案 - ')) || options?.names?.[0] || '');
  const createButton = settings.locator('[data-settings-action="archive-create"]');
  await createButton.click();
  assert.equal(await createButton.evaluate((node) => node.classList.contains('st-button-feedback')), true, '按钮点击后没有可见微动效反馈');
  const createPopup = settings.locator('[data-settings-text-prompt]');
  await createPopup.waitFor({ state: 'visible' });
  assert.match(await createPopup.textContent(), /新建专属世界书/);
  assert.equal(await createPopup.locator('[data-settings-text-prompt-input]').count(), 1, '新建世界书没有显示催眠手机输入框');
  assert.ok(String(await createPopup.locator('[data-settings-text-prompt-input]').inputValue()).startsWith('HypnoOS档案 - '), '新建世界书没有提供专属名称');
  await createPopup.locator('[data-settings-text-prompt-cancel]').click();

  const characterButton = settings.locator('[data-settings-action="archive-character"]');
  if (await characterButton.isEnabled()) {
    await characterButton.click();
    const characterPopup = settings.locator('.st-encounter-confirm-card[aria-label="绑定角色卡世界书"]');
    await characterPopup.waitFor({ state: 'visible' });
    assert.match(await characterPopup.textContent(), /绑定角色卡世界书/);
    await characterPopup.locator('[data-encounter-confirm="cancel"]').click();
  }

  if (!targetName) throw new Error('真实酒馆没有已有世界书，无法验证迁移弹窗和写入');
  const migrateButton = settings.locator('[data-settings-action="archive-migrate"]');
  await migrateButton.click();
  const migratePopup = settings.locator('[data-settings-select-prompt]');
  await migratePopup.waitFor({ state: 'visible' });
  assert.match(await migratePopup.textContent(), /迁移到已有世界书/);
  const migrateSelect = migratePopup.locator('[data-settings-select-prompt-input]');
  assert.ok(await migrateSelect.locator('option').count(), '迁移弹窗没有列出已有世界书');
  await migrateSelect.selectOption(targetName);
  await migratePopup.locator('button[type="submit"]').click();
  await frame.waitForFunction(() => document.querySelector('[data-settings-archive-status]')?.textContent?.includes('内置催眠规则已加载'), null, { timeout: 30_000 });
  assert.match(await settings.locator('[data-settings-archive-status]').textContent(), /内置催眠规则已加载/);
  assert.equal(await settings.locator('[data-settings-action="archive-migrate"]').isEnabled(), true, '迁移完成后按钮仍处于卡死状态');

  const configured = await frame.evaluate(() => globalThis.getArchiveWorldbookOptions());
  const binding = configured?.binding;
  assert.ok(binding?.worldbookName, '真实酒馆没有建立可写世界书绑定');
  await frame.evaluate((name) => globalThis.configureArchiveWorldbook({ mode: 'selected', worldbookName: name }), binding.worldbookName);
  options = await frame.evaluate(() => globalThis.getArchiveWorldbookOptions());
  assert.equal(options?.binding?.rulesetVersion, getHypnosisRules().version);
  await page.evaluate(() => globalThis.SillyTavern?.getContext?.()?.saveMetadata?.());

  const runtimeRules = await page.evaluate(async (worldbookName) => {
    const st = globalThis.SillyTavern?.getContext?.();
    const book = await st?.loadWorldInfo?.(worldbookName);
    const entries = Array.isArray(book?.entries) ? book.entries : Object.values(book?.entries || {});
    const rules = entries.filter((entry) => entry?.extensions?.hypnoosRules?.owner === 'hypnoos3-hypnosis-rules');
    const archives = entries.filter((entry) => entry?.extensions?.hypnoosArchive?.owner === 'hypnoos3-archive');
    const managedRuleBooks = [];
    for (const name of await Promise.resolve(st?.getWorldInfoNames?.()) || []) {
      const candidate = await st?.loadWorldInfo?.(name);
      const candidateEntries = Array.isArray(candidate?.entries) ? candidate.entries : Object.values(candidate?.entries || {});
      if (candidateEntries.some((entry) => entry?.extensions?.hypnoosRules?.owner === 'hypnoos3-hypnosis-rules')) managedRuleBooks.push(String(name));
    }
    const scanChat = Array.isArray(st?.chat) ? st.chat.map((message) => String(message?.mes || message?.message || '')).reverse() : [];
    const worldInfoPrompt = await st?.getWorldInfoPrompt?.(scanChat, 32_768, true);
    return {
      entryCount: rules.length,
      entry: rules[0] || null,
      archives: archives.map((entry) => ({ comment: entry.comment, archiveWrappers: (String(entry.content || '').match(/<HypnoOS人物档案存储>/g) || []).length, contextWrappers: (String(entry.content || '').match(/<HypnoOS剧情融合规则>/g) || []).length })),
      managedRuleBooks,
      runtimePrompt: String(st?.extensionPrompts?.['hypnoos3-runtime-state']?.value || ''),
      worldInfoPrompt: String(worldInfoPrompt?.worldInfoString || ''),
    };
  }, binding.worldbookName);
  assert.equal(runtimeRules.entryCount, 1, '真实世界书中的内置催眠规则不是唯一条目');
  assert.equal(runtimeRules.archives.filter((entry) => entry.comment === '[HypnoOS档案]人物状态').length, 1, '真实世界书人物状态条目不是唯一条目');
  assert.equal(runtimeRules.archives.filter((entry) => entry.comment === '[HypnoOS档案]剧情与催眠上下文').length, 1, '真实世界书剧情上下文条目不是唯一条目');
  assert.equal(runtimeRules.archives.reduce((total, entry) => total + entry.archiveWrappers, 0), 1, '人物状态正文存在重复包裹');
  assert.equal(runtimeRules.archives.reduce((total, entry) => total + entry.contextWrappers, 0), 1, '剧情上下文正文存在重复包裹');
  assert.equal(runtimeRules.entry.comment, '[HypnoOS内置]催眠规则');
  assert.equal(runtimeRules.entry.constant, true);
  assert.equal(runtimeRules.entry.position, 0);
  assert.equal(runtimeRules.entry.order, 17);
  assert.equal(runtimeRules.entry.ignoreBudget, true);
  assert.equal(runtimeRules.entry.preventRecursion, true);
  assert.equal(runtimeRules.entry.useProbability, false);
  assert.match(runtimeRules.entry.content, /<HypnoOS催眠规则.+source-count="2">/);
  assert.match(runtimeRules.entry.content, /只对人类生效/);
  assert.match(runtimeRules.entry.content, /主角可疑度反映环境/);
  assert.doesNotMatch(runtimeRules.entry.content, /<催眠指令白名单>|<结果分类>|<输出硬检查>|封闭白名单/);
  assert.doesNotMatch(runtimeRules.runtimePrompt, /<HypnoOS催眠规则/, '绑定世界书后扩展提示仍重复注入催眠规则');
  assert.equal((runtimeRules.worldInfoPrompt.match(/<HypnoOS催眠规则/g) || []).length, 1, `真实酒馆 World Info 扫描没有且仅有一份催眠规则；含规则世界书：${runtimeRules.managedRuleBooks.join('、')}`);
  assert.doesNotMatch(runtimeRules.worldInfoPrompt, /<催眠指令白名单>|<结果分类>|<输出硬检查>/);

  const chatSwitch = await page.evaluate(async () => {
    const st = globalThis.SillyTavern?.getContext?.();
    const character = st?.characters?.[st?.characterId];
    const response = await fetch('/api/characters/chats', {
      method: 'POST',
      headers: st.getRequestHeaders(),
      body: JSON.stringify({ avatar_url: character?.avatar }),
    });
    const data = response.ok ? await response.json() : {};
    return {
      originalChatId: String(st?.chatId || ''),
      candidates: Object.values(data || {}).map((item) => String(item?.file_name || '')).filter((name) => name && name !== st?.chatId),
    };
  });
  assert.ok(chatSwitch.originalChatId && chatSwitch.candidates.length, '真实酒馆当前角色没有第二个聊天，无法验证规则退出删除/进入加载');
  let exitVerified = false;
  let switchedChatId = '';
  try {
    for (const candidate of chatSwitch.candidates.slice(0, 8)) {
      await page.evaluate((chatId) => globalThis.SillyTavern.getContext().openCharacterChat(chatId), candidate);
      await page.waitForFunction((chatId) => globalThis.SillyTavern?.getContext?.()?.chatId === chatId, candidate, { timeout: 30_000 });
      try {
        await page.waitForFunction(async (worldbookName) => {
          const st = globalThis.SillyTavern?.getContext?.();
          const book = await st?.loadWorldInfo?.(worldbookName);
          const entries = Array.isArray(book?.entries) ? book.entries : Object.values(book?.entries || {});
          const rules = entries.filter((entry) => entry?.extensions?.hypnoosRules?.owner === 'hypnoos3-hypnosis-rules');
          const archives = entries.filter((entry) => entry?.extensions?.hypnoosArchive?.owner === 'hypnoos3-archive');
          return rules.length === 0 && archives.length === 2;
        }, binding.worldbookName, { timeout: 5_000 });
        exitVerified = true;
        switchedChatId = candidate;
        break;
      } catch {}
    }
  } finally {
    await page.evaluate((chatId) => globalThis.SillyTavern.getContext().openCharacterChat(chatId), chatSwitch.originalChatId);
    await page.waitForFunction((chatId) => globalThis.SillyTavern?.getContext?.()?.chatId === chatId, chatSwitch.originalChatId, { timeout: 30_000 });
  }
  assert.equal(exitVerified, true, '离开绑定聊天后，内置催眠规则未自动删除或档案条目被误删');
  await page.waitForFunction(async (worldbookName) => {
    const st = globalThis.SillyTavern?.getContext?.();
    const book = await st?.loadWorldInfo?.(worldbookName);
    const entries = Array.isArray(book?.entries) ? book.entries : Object.values(book?.entries || {});
    return entries.filter((entry) => entry?.extensions?.hypnoosRules?.owner === 'hypnoos3-hypnosis-rules').length === 1;
  }, binding.worldbookName, { timeout: 30_000 });

  const closeResults = await page.evaluate(() => {
    const registry = globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__;
    const host = document.querySelector('#hypnoos3-extension-floating-phone-host');
    const shadow = host.shadowRoot;
    if (registry.readInformation().petDisplayMode !== 'stored') registry.toggleInformationPetMode();
    registry.openPhone();
    shadow.querySelector('[data-phone-resize="left"]').click();
    const afterResize = shadow.querySelector('.panel').classList.contains('open');
    shadow.querySelector('[data-phone-drag]').click();
    const afterDrag = shadow.querySelector('.panel').classList.contains('open');
    document.body.click();
    const afterOutside = shadow.querySelector('.panel').classList.contains('open');
    return { afterResize, afterDrag, afterOutside };
  });
  assert.deepEqual(closeResults, { afterResize: true, afterDrag: true, afterOutside: false });
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS local SillyTavern plug-and-play hypnosis worldbook rule and stored-mode outside close', { worldbookName: binding.worldbookName, switchedChatId, rulesetVersion: options.binding.rulesetVersion, commands: getHypnosisRules().commands.length, closeResults });
} finally {
  await browser.close();
}
