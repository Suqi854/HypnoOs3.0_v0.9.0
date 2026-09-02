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
let originalState = null;
page.on('pageerror', (error) => errors.push(String(error?.stack || error)));

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]'), null, { timeout: 30_000 });
  const active = await page.evaluate(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId));
  if (!active) {
    await page.evaluate(() => document.querySelector('#rm_print_characters_block .character_select[data-chid]')?.click());
    await page.waitForFunction(() => Boolean(globalThis.SillyTavern?.getContext?.()?.chatId), null, { timeout: 30_000 });
  }
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const pending = [window]; const seen = [];
    while (pending.length) {
      const view = pending.shift(); if (!view || seen.includes(view)) continue;
      try { seen.push(view); if (typeof view.AutoCardUpdaterAPI?.exportTableAsJson === 'function') return true; for (const frame of view.document.querySelectorAll('iframe')) pending.push(frame.contentWindow); } catch {}
    }
    return false;
  }, null, { timeout: 30_000 });
  await page.evaluate(async () => {
    const runtime = globalThis.__HYPNOOS3_RUNTIME__;
    const state = runtime?.store?.state;
    const qaRoleNames = new Set(['QA数据库人物', 'QA数据库女性', 'QA数据库男性']);
    const hasStaleFixture = Object.values(state?.roles || {}).some((role) => qaRoleNames.has(role?.name))
      || (state?.inventory || []).some((item) => item?.id === 'QA物品' || item?.name === 'QA物品' || item?.物品名称 === 'QA物品')
      || (state?.tasks || []).some((item) => item?.id === 'QA任务' || item?.name === 'QA任务' || item?.任务 === 'QA任务');
    if (!hasStaleFixture) return;
    const snapshots = await runtime.host.readOptionalRuntimeState?.() || [];
    const pending = snapshots.map((item) => item?.value ?? item);
    const seen = new Set();
    let fallbackSystem = null;
    while (pending.length && !fallbackSystem) {
      const value = pending.shift();
      if (!value || typeof value !== 'object' || Array.isArray(value) || seen.has(value)) continue;
      seen.add(value);
      if (value.系统 && typeof value.系统 === 'object' && value.系统.当前地点 !== 'QA地点') fallbackSystem = value.系统;
      for (const key of ['stat_data', 'variables', 'mvu']) if (value[key] && typeof value[key] === 'object') pending.push(value[key]);
    }
    await runtime.store.update((draft) => {
      draft.roles = Object.fromEntries(Object.entries(draft.roles || {}).filter(([, role]) => !qaRoleNames.has(role?.name)));
      draft.inventory = (draft.inventory || []).filter((item) => item?.id !== 'QA物品' && item?.name !== 'QA物品' && item?.物品名称 !== 'QA物品');
      draft.tasks = (draft.tasks || []).filter((item) => item?.id !== 'QA任务' && item?.name !== 'QA任务' && item?.任务 !== 'QA任务');
      for (const [key, field, value] of [['skills', '技能名称', 'QA技能'], ['summaries', '纪要', 'QA纪要'], ['outline', '阶段', 'QA阶段']]) {
        if (Array.isArray(draft.custom?.databaseAppData?.[key])) draft.custom.databaseAppData[key] = draft.custom.databaseAppData[key].filter((item) => item?.[field] !== value);
      }
      const legacy = draft.custom?.legacyVariables;
      if (legacy?.角色) for (const name of qaRoleNames) delete legacy.角色[name];
      if (legacy?.任务) delete legacy.任务.QA任务;
      if (legacy?.系统?.持有物品) delete legacy.系统.持有物品.QA物品;
      if (Array.isArray(legacy?.系统?.主角技能)) legacy.系统.主角技能 = legacy.系统.主角技能.filter((item) => item?.技能名称 !== 'QA技能');
      if (Array.isArray(legacy?.系统?._数据库总结)) legacy.系统._数据库总结 = legacy.系统._数据库总结.filter((item) => item?.纪要 !== 'QA纪要');
      if (Array.isArray(legacy?.系统?._数据库总体大纲)) legacy.系统._数据库总体大纲 = legacy.系统._数据库总体大纲.filter((item) => item?.阶段 !== 'QA阶段');
      if (fallbackSystem && draft.location?.current === 'QA地点') draft.location.current = String(fallbackSystem.当前地点 || '');
      if (fallbackSystem && draft.time?.clock === '12:34') draft.time.clock = String(fallbackSystem.当前时间 || draft.time.clock);
      return draft;
    }, 'qa-database-stale-fixture-cleanup');
  });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(1200);
  let frame = null;
  for (const candidate of page.frames().filter((item) => item !== page.mainFrame())) {
    try {
      if (await candidate.evaluate(() => typeof globalThis.getDatabaseSnapshot === 'function')) { frame = candidate; break; }
    } catch {}
  }
  assert.ok(frame, '真实酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.getDatabaseSnapshot === 'function', null, { timeout: 30_000 });

  await frame.evaluate(() => globalThis.__ST_OPEN_SETTINGS_APP__?.());
  const settings = frame.locator('.st-settings-app').last();
  await settings.waitFor({ state: 'visible' });
  assert.deepEqual(await settings.locator('[data-settings-tab]').allTextContents(), ['聊天与变量', '模型插头', '日志']);
  await settings.locator('[data-lite-action="back"]').click();

  const databaseTile = frame.locator('[data-home-app-id="database"]').last();
  await databaseTile.waitFor({ state: 'visible' });
  await databaseTile.click();
  const app = frame.locator('.st-database-app').last();
  await app.waitFor({ state: 'visible' });
  await frame.waitForFunction(() => document.querySelector('.st-database-status')?.textContent?.includes('数据库已连接'), null, { timeout: 30_000 });
  const snapshot = await frame.evaluate(() => globalThis.getDatabaseSnapshot());
  assert.equal(snapshot.available, true);
  assert.ok(snapshot.sheets.length >= 8, `数据库标准表数量不足：${snapshot.sheets.length}`);
  assert.ok(snapshot.sheets.some((sheet) => sheet.name === '重要人物表'));
  assert.ok(snapshot.sheets.some((sheet) => sheet.name === '任务与事件表'));
  await frame.evaluate(() => globalThis.syncDatabaseState());
  const projection = await page.evaluate(() => {
    const state = globalThis.__HYPNOOS3_RUNTIME__?.store?.state;
    const legacy = globalThis.__HYPNOOS3_RUNTIME__?.floatingHost?.dataService?.readLegacyVariables?.();
    const source = state?.custom?.databaseSource || {};
    const count = (value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 0;
    return {
      sourceAvailable: source.available === true,
      sourceSignature: String(source.signature || ''),
      stateRoleCount: count(state?.roles),
      legacyRoleCount: count(legacy?.角色),
      femaleRoleCount: Object.values(legacy?.角色 || {}).filter((role) => String(role?.信息?.性别 || '').trim() === '女').length,
      maleRoleCount: Object.values(legacy?.角色 || {}).filter((role) => String(role?.信息?.性别 || '').trim() === '男').length,
      inventoryCount: Array.isArray(state?.inventory) ? state.inventory.length : 0,
      taskCount: Array.isArray(state?.tasks) ? state.tasks.length : 0,
      skillCount: Array.isArray(state?.custom?.databaseAppData?.skills) ? state.custom.databaseAppData.skills.length : 0,
      summaryCount: Array.isArray(state?.custom?.databaseAppData?.summaries) ? state.custom.databaseAppData.summaries.length : 0,
      outlineCount: Array.isArray(state?.custom?.databaseAppData?.outline) ? state.custom.databaseAppData.outline.length : 0,
      qaFixtureResidue: Object.values(state?.roles || {}).some((role) => ['QA数据库人物', 'QA数据库女性', 'QA数据库男性'].includes(role?.name))
        || (state?.inventory || []).some((item) => item?.id === 'QA物品' || item?.name === 'QA物品' || item?.物品名称 === 'QA物品')
        || (state?.tasks || []).some((item) => item?.id === 'QA任务' || item?.name === 'QA任务' || item?.任务 === 'QA任务'),
    };
  });
  const roleSheet = snapshot.sheets.find((sheet) => sheet.name === '重要人物表');
  assert.equal(projection.sourceAvailable, true);
  assert.equal(projection.sourceSignature, snapshot.signature);
  if (projection.qaFixtureResidue) console.warn('WARN existing QA-named rows are present in the external database; leaving user database untouched');
  if (roleSheet.rows.length) {
    assert.ok(projection.legacyRoleCount >= roleSheet.rows.length, '数据库人物没有完整同步到手机变量');
    assert.ok(projection.femaleRoleCount + projection.maleRoleCount >= roleSheet.rows.length, '数据库人物性别没有完整投影到档案应用');
  }
  if (!roleSheet.rows.length) {
    const fallbackVisible = await frame.evaluate(async () => {
      await globalThis.__ST_OPEN_FEMALE_PROFILE_APP__?.();
      await new Promise((resolve) => setTimeout(resolve, 800));
      const count = document.querySelectorAll('.st-profile-app [data-profile-desk-role]').length;
      document.querySelector('.st-profile-app [data-lite-action="back"]')?.click();
      return count;
    });
    assert.ok(fallbackVisible > 0, `数据库人物表为空时仍遮住了已导入的世界书档案：档案选项 ${fallbackVisible}，手机变量人物 ${projection.legacyRoleCount}`);
  }

  originalState = await page.evaluate(() => globalThis.__HYPNOOS3_RUNTIME__.store.state);
  await page.evaluate(async () => {
    const runtime = globalThis.__HYPNOOS3_RUNTIME__;
    runtime.host.__qaDatabaseOriginalReadSnapshot = runtime.host.readDatabaseSnapshot;
    runtime.host.readDatabaseSnapshot = async () => ({
      mate: { version: 'qa' },
      sheet_global: { name: '全局数据表', content: [['', '主角当前所在地点', '当前时间'], [1, 'QA地点', '12:34']] },
      sheet_user: { name: '主角信息', content: [['', '人物名称'], [1, 'QA玩家']] },
      sheet_roles: { name: '重要人物表', content: [['', '姓名', '性别/年龄', '外貌特征'], [1, 'QA数据库女性', '女/20', '女性第一次资料'], [2, 'QA数据库男性', '男/22', '男性第一次资料']] },
      sheet_skills: { name: '主角技能表', content: [['', '技能名称'], [1, 'QA技能']] },
      sheet_inventory: { name: '背包物品表', content: [['', '物品名称', '数量'], [1, 'QA物品', 2]] },
      sheet_tasks: { name: '任务与事件表', content: [['', '任务名称', '当前进度'], [1, 'QA任务', '进行中']] },
      sheet_summary: { name: '总结表', content: [['', '纪要'], [1, 'QA纪要']] },
      sheet_outline: { name: '总体大纲', content: [['', '阶段'], [1, 'QA阶段']] },
    });
    await runtime.store.syncDatabaseRuntimeState('qa-database-projection');
  });
  const fixtureProjection = await page.evaluate(() => {
    const runtime = globalThis.__HYPNOOS3_RUNTIME__;
    const legacy = runtime.floatingHost.dataService.readLegacyVariables();
    return {
      femaleRoleVisible: legacy?.角色?.QA数据库女性?.信息?.性别 === '女',
      maleRoleVisible: legacy?.角色?.QA数据库男性?.信息?.性别 === '男',
      femaleAppearanceVisible: legacy?.角色?.QA数据库女性?.信息?.外貌特征 === '女性第一次资料',
      maleAppearanceVisible: legacy?.角色?.QA数据库男性?.信息?.外貌特征 === '男性第一次资料',
      locationVisible: legacy?.系统?.当前地点 === 'QA地点',
      inventoryVisible: Boolean(legacy?.系统?.持有物品?.QA物品),
      taskVisible: Boolean(legacy?.任务?.QA任务),
      skillVisible: Array.isArray(legacy?.系统?.主角技能) && legacy.系统.主角技能.some((item) => item?.技能名称 === 'QA技能'),
      summaryVisible: Array.isArray(legacy?.系统?._数据库总结) && legacy.系统._数据库总结.some((item) => item?.纪要 === 'QA纪要'),
      outlineVisible: Array.isArray(legacy?.系统?._数据库总体大纲) && legacy.系统._数据库总体大纲.some((item) => item?.阶段 === 'QA阶段'),
    };
  });
  assert.deepEqual(fixtureProjection, {
    femaleRoleVisible: true,
    maleRoleVisible: true,
    femaleAppearanceVisible: true,
    maleAppearanceVisible: true,
    locationVisible: true,
    inventoryVisible: true,
    taskVisible: true,
    skillVisible: true,
    summaryVisible: true,
    outlineVisible: true,
  });
  assert.equal(await app.locator('[data-database-sheet] option').count(), snapshot.sheets.length);
  await app.locator('[data-database-refresh]').click();
  await frame.waitForFunction(() => !document.querySelector('[data-database-refresh]')?.disabled, null, { timeout: 15_000 });

  await frame.evaluate(() => globalThis.__ST_OPEN_PROFILE_APP__('info', 'QA数据库女性'));
  const female = frame.locator('.st-profile-app[aria-label="女性档案"]').last();
  await female.waitFor({ state: 'visible', timeout: 15_000 });
  assert.match(await female.textContent(), /年　龄20/);

  await page.evaluate(async () => {
    const runtime = globalThis.__HYPNOOS3_RUNTIME__;
    const updated = {
      sheet_roles: { name: '重要人物表', content: [['', '姓名', '性别/年龄', '外貌特征'], [1, 'QA数据库女性', '女/21', '女性第二次资料'], [2, 'QA数据库男性', '男/23', '男性第二次资料']] },
    };
    await runtime.store.syncDatabaseRuntimeState('qa-database-update-callback', updated);
  });
  await frame.waitForFunction(() => document.querySelector('.st-profile-app[aria-label="女性档案"]')?.textContent?.includes('年　龄21'), null, { timeout: 15_000 });
  assert.equal(await page.evaluate(() => globalThis.__HYPNOOS3_RUNTIME__?.floatingHost?.dataService?.readLegacyVariables?.()?.角色?.QA数据库女性?.信息?.外貌特征), '女性第二次资料');

  await frame.evaluate(() => globalThis.__ST_OPEN_PROFILE_APP__('info', 'QA数据库男性'));
  const male = frame.locator('.st-profile-app[aria-label="男性档案"]').last();
  await male.waitFor({ state: 'visible', timeout: 15_000 });
  assert.match(await male.textContent(), /年　龄23/);
  assert.equal(await page.evaluate(() => globalThis.__HYPNOOS3_RUNTIME__?.floatingHost?.dataService?.readLegacyVariables?.()?.角色?.QA数据库男性?.信息?.外貌特征), '男性第二次资料');
  assert.deepEqual(errors, []);
  console.log('PASS local SillyTavern database app, callback projection, open female/male dossier refresh and three settings tabs', { sheetCount: snapshot.sheets.length, signature: snapshot.signature, sheetRows: Object.fromEntries(snapshot.sheets.map((sheet) => [sheet.name, sheet.rows.length])), ...projection });
} finally {
  if (originalState) {
    try {
      await page.evaluate(async (state) => {
        const runtime = globalThis.__HYPNOOS3_RUNTIME__;
        if (runtime?.host?.__qaDatabaseOriginalReadSnapshot) {
          runtime.host.readDatabaseSnapshot = runtime.host.__qaDatabaseOriginalReadSnapshot;
          delete runtime.host.__qaDatabaseOriginalReadSnapshot;
        }
        await runtime?.store?.replace?.(state, 'qa-database-restore');
      }, originalState);
    } catch {}
  }
  await browser.close();
}
