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
let originalChatId = '';
let secondChatId = '';
let originalAState = null;
let originalAStorage = null;
let originalBStorage = null;

const storageKeys = (scope) => [
  `hypnoos:adaptive-region:v1:${scope}`,
  `hypnoos:world-adaptation:v1:${scope}`,
];

async function switchChat(chatId) {
  await page.evaluate((id) => globalThis.SillyTavern.getContext().openCharacterChat(id), chatId);
  await page.waitForFunction((id) => globalThis.SillyTavern?.getContext?.()?.chatId === id, chatId, { timeout: 30_000 });
}

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]'), null, { timeout: 30_000 });
  if (!await page.evaluate(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId))) {
    await page.evaluate(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]')?.click());
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId), null, { timeout: 30_000 });
  }
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(900);
  for (const candidate of page.frames().filter((item) => item !== page.mainFrame())) {
    try {
      if (await candidate.evaluate(() => typeof globalThis.getArchiveWorldbookOptions === 'function')) {
        frame = candidate;
        break;
      }
    } catch {}
  }
  assert.ok(frame, '真实酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.getArchiveWorldbookOptions === 'function' && typeof globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__ === 'function', null, { timeout: 30_000 });

  originalChatId = await page.evaluate(() => String(globalThis.SillyTavern.getContext().chatId || ''));
  const candidates = await page.evaluate(async () => {
    const st = globalThis.SillyTavern.getContext();
    const character = st.characters?.[st.characterId];
    const response = await fetch('/api/characters/chats', { method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ avatar_url: character?.avatar }) });
    const data = response.ok ? await response.json() : {};
    return Object.values(data || {}).map((item) => String(item?.file_name || '')).filter((name) => name && name !== st.chatId);
  });
  assert.ok(candidates.length, '当前角色没有第二个聊天，无法做真实跨聊天验收');
  secondChatId = candidates[0];

  originalAState = await page.evaluate(() => structuredClone(globalThis.__HYPNOOS3_RUNTIME__.store.state));
  const scopeA = await frame.evaluate(() => String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__()));
  originalAStorage = await frame.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), storageKeys(scopeA));
  await frame.evaluate((scope) => {
    const profile = {
      schema: 'HypnoWorldAdaptation/v1', worldbookName: 'QA聊天A世界书', worldbookNames: ['QA聊天A世界书'], sourceHash: 'qa-chat-a', generatedAt: new Date().toISOString(),
      apps: {
        map: [{ id: 'qa-map', title: 'QA-A-地图', summary: '聊天A地图存档' }],
        specialLocations: [{ id: 'qa-special', title: 'QA-A-特殊地点', summary: '聊天A特殊地点存档' }],
        monitor: [{ id: 'qa-monitor', title: 'QA-A-监控', summary: '聊天A监控存档' }],
        calendar: [{ id: 'qa-calendar', title: 'QA-A-日历', summary: '聊天A日历存档', meta: '4月9日' }],
        timetable: [{ id: 'qa-timetable', title: 'QA-A-课程', summary: '聊天A课程存档', meta: '周一 第1节 08:40-09:30' }],
        rewards: [{ id: 'qa-reward', title: 'QA-A-成就任务', summary: '聊天A成就任务存档', meta: '成就 +10' }],
        work: [{ id: 'qa-work', title: 'QA-A-工作', summary: '聊天A工作存档' }],
        mchan: [{ id: 'qa-mchan', title: 'QA-A-帖子', summary: '聊天A帖子存档' }],
      },
    };
    localStorage.setItem(`hypnoos:adaptive-region:v1:${scope}`, 'auto');
    localStorage.setItem(`hypnoos:world-adaptation:v1:${scope}`, JSON.stringify(profile));
  }, scopeA);
  await page.evaluate(async () => {
    globalThis.__HYPNOOS_QA_STATE_TRACE__ = [];
    globalThis.__HYPNOOS3_RUNTIME__.store.addEventListener('change', (event) => {
      const state = globalThis.__HYPNOOS3_RUNTIME__.store.state;
      globalThis.__HYPNOOS_QA_STATE_TRACE__.push({ reason: event.detail?.reason || '', chatId: globalThis.SillyTavern?.getContext?.()?.chatId || '', schedule: state.time?.scheduleLabel, task: state.tasks?.[0]?.title, marker: state.custom?.qaChatRestore || '' });
    });
    await globalThis.__HYPNOOS3_RUNTIME__.store.update((state) => {
      state.location.current = 'QA-A-当前位置';
      state.time.date = 'QA-A-日期';
      state.time.scheduleLabel = 'QA-A-日程';
      state.tasks = [{ id: 'qa-a-task', title: 'QA-A-任务' }];
      state.achievements = [{ id: 'qa-a-achievement', title: 'QA-A-成就' }];
      state.custom.qaChatRestore = 'QA-A-完整存档';
      return state;
    }, 'qa-chat-a-full-save');
  });

  let readyEvents = 0;
  await frame.evaluate(() => {
    globalThis.__HYPNOOS_QA_CHAT_READY_COUNT__ = 0;
    globalThis.eventOn('HYPNOOS3_CHAT_CHANGED', (payload) => {
      if (payload?.ready) globalThis.__HYPNOOS_QA_CHAT_READY_COUNT__ += 1;
    });
  });
  await switchChat(secondChatId);
  const scopeB = await frame.evaluate(() => String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__()));
  originalBStorage = await frame.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), storageKeys(scopeB));
  await frame.evaluate((scope) => localStorage.setItem(`hypnoos:adaptive-region:v1:${scope}`, 'china'), scopeB);

  await switchChat(originalChatId);
  await page.waitForFunction(() => globalThis.__HYPNOOS3_RUNTIME__?.store?.state?.custom?.qaChatRestore === 'QA-A-完整存档', null, { timeout: 30_000 });
  await frame.waitForFunction(() => globalThis.__HYPNOOS_QA_CHAT_READY_COUNT__ >= 2, null, { timeout: 30_000 });
  readyEvents = await frame.evaluate(() => globalThis.__HYPNOOS_QA_CHAT_READY_COUNT__);

  const restored = await page.evaluate(() => {
    const state = globalThis.__HYPNOOS3_RUNTIME__.store.state;
    return {
      location: state.location.current,
      date: state.time.date,
      schedule: state.time.scheduleLabel,
      task: state.tasks[0]?.title,
      achievement: state.achievements[0]?.title,
      marker: state.custom.qaChatRestore,
      binding: state.custom.archiveWorldbookBinding?.worldbookName || '',
      databaseAvailable: state.custom.databaseSource?.available === true,
    };
  });
  assert.equal(restored.location, 'QA-A-当前位置');
  assert.equal(restored.date, 'QA-A-日期');
  assert.equal(restored.achievement, 'QA-A-成就');
  assert.equal(restored.marker, 'QA-A-完整存档');
  assert.equal(restored.binding, originalAState.custom?.archiveWorldbookBinding?.worldbookName || '');
  const restoredApps = await frame.evaluate(() => {
    const scope = String(globalThis.__ST_HYPNOOS_CHAT_STORAGE_SCOPE__());
    const profile = JSON.parse(localStorage.getItem(`hypnoos:world-adaptation:v1:${scope}`) || 'null');
    return Object.fromEntries(Object.entries(profile?.apps || {}).map(([key, rows]) => [key, rows?.[0]?.title || '']));
  });
  assert.deepEqual(restoredApps, {
    map: 'QA-A-地图', specialLocations: 'QA-A-特殊地点', monitor: 'QA-A-监控', calendar: 'QA-A-日历', timetable: 'QA-A-课程', rewards: 'QA-A-成就任务', work: 'QA-A-工作', mchan: 'QA-A-帖子',
  });
  assert.equal(errors.length, 0, errors.join('\n'));

  await frame.evaluate(() => globalThis.__ST_OPEN_MAP_APP__());
  await frame.waitForFunction(() => document.querySelector('.st-map-app')?.innerText?.includes('QA-A-地图'), null, { timeout: 15_000 });
  const mapText = await frame.locator('.st-map-app').last().innerText();
  assert.match(mapText, /QA-A-地图/);
  await frame.evaluate(() => {
    document.querySelectorAll('.st-map-app,.st-city-map-app').forEach((node) => node.remove());
    globalThis.__ST_HYPNOOS_GO_HOME_APP__?.();
  });
  console.log('PASS local SillyTavern restores the complete chat-bound phone save after ready binding', { originalChatId, secondChatId, readyEvents, restored });
} finally {
  try {
    if (frame && secondChatId && originalBStorage) {
      await switchChat(secondChatId).catch(() => {});
      await frame.evaluate((entries) => Object.entries(entries).forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)), originalBStorage).catch(() => {});
    }
    if (originalChatId) await switchChat(originalChatId).catch(() => {});
    if (frame && originalAStorage) await frame.evaluate((entries) => Object.entries(entries).forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)), originalAStorage).catch(() => {});
    if (originalAState) await page.evaluate((state) => globalThis.__HYPNOOS3_RUNTIME__?.store?.replace?.(state, 'qa-chat-restore-cleanup'), originalAState).catch(() => {});
  } finally {
    await browser.close();
  }
}
