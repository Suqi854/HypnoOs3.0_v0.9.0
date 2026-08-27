import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.stack || error)));

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'), null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  await page.waitForTimeout(400);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载 1.0.0 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_FEMALE_PROFILE_APP__ === 'function', null, { timeout: 30_000 });

  const roleName = 'HypnoOS_QA_临时删除角色';
  await frame.evaluate((name) => {
    let current = {
      stat_data: {
        系统: { MC能量: 25, MC能量上限: 25 },
        角色: { [name]: { 信息: { 姓名: name, 性别: '女' }, 状态: {}, 效果: {} } },
      },
    };
    const qaMvu = {
      getMvuData() { return current; },
      replaceMvuData(next) { current = JSON.parse(JSON.stringify(next)); return true; },
    };
    for (const view of [globalThis, globalThis.parent, globalThis.top]) {
      try {
        view.Mvu = qaMvu;
        view.__ST_HYPNOOS_REQUIRE_WRITABLE_FLOOR__ = () => true;
      } catch {}
    }
    globalThis.__HYPNOOS_QA_MVU__ = () => current;
    localStorage.setItem('hypnoos:profile-worldbook-roles:v1:global', JSON.stringify({ schema: 'HypnoProfileWorldbooks/v1', roles: { [name]: current.stat_data.角色[name] } }));
    localStorage.setItem('hypnoos:favorite-roles:v1:global', JSON.stringify([name]));
    localStorage.setItem('hypnoos:profile-gender-overrides:v1:global', JSON.stringify({ [name]: '女' }));
  }, roleName);

  await frame.evaluate((name) => globalThis.__ST_OPEN_FEMALE_PROFILE_APP__('info', name), roleName);
  const profile = frame.locator('.st-profile-app').last();
  await profile.waitFor({ state: 'visible' });
  await profile.locator('[data-profile-action="delete-role"]').dispatchEvent('mousedown', { button: 0 });
  await frame.waitForTimeout(100);
  const afterOpen = await frame.evaluate(() => {
    const profiles = document.querySelectorAll('.st-profile-app');
    const current = profiles[profiles.length - 1];
    return {
      count: profiles.length,
      dialog: current?.dataset?.profileDeleteDialog || '',
      role: current?.dataset?.profileDeleteRole || '',
      action: current?.querySelector('[data-profile-action="delete-role"]')?.getAttribute('data-profile-action') || '',
      bound: current?.dataset?.profileCaptureBound || '',
      delegated: current?.dataset?.profileBound || '',
      direct: current?.querySelector('[data-profile-action="delete-role"]')?.dataset?.profileDeleteDirectBound || '',
      confirmDirect: current?.querySelector('[data-profile-delete-action="confirm"]')?.dataset?.profileDeleteDialogDirectBound || '',
    };
  });
  assert.equal(afterOpen.dialog, 'true', `删除确认框未打开：${JSON.stringify(afterOpen)}；页面错误：${errors.join(' | ')}`);
  assert.equal(afterOpen.confirmDirect, 'true', `删除确认按钮未绑定：${JSON.stringify(afterOpen)}`);
  await frame.locator('[data-profile-delete-action="confirm"]').dispatchEvent('mousedown', { button: 0 });
  await frame.waitForTimeout(500);

  const result = await frame.evaluate((name) => {
    const read = (key, fallback) => {
      try { return JSON.parse(localStorage.getItem(key) || fallback); } catch { return JSON.parse(fallback); }
    };
    return {
      runtimePresent: Boolean(globalThis.__HYPNOOS_QA_MVU__()?.stat_data?.角色?.[name]),
      importedPresent: Boolean(read('hypnoos:profile-worldbook-roles:v1:global', '{}')?.roles?.[name]),
      favoritePresent: read('hypnoos:favorite-roles:v1:global', '[]').includes(name),
      genderPresent: Object.prototype.hasOwnProperty.call(read('hypnoos:profile-gender-overrides:v1:global', '{}'), name),
      dismissed: read('hypnoos:dismissed-profile-roles:v1:global', '[]').includes(name),
      dialogOpen: Boolean(document.querySelector('[data-profile-delete-dialog]')),
      dossierCardPresent: Boolean(document.querySelector('[data-profile-desk-role="' + CSS.escape(name) + '"]')),
      dossierDetailPresent: document.querySelector('.st-profile-app')?.dataset?.profileDeskMode === 'detail',
    };
  }, roleName);

  assert.deepEqual(result, {
    runtimePresent: true,
    importedPresent: false,
    favoritePresent: false,
    genderPresent: false,
    dismissed: true,
    dialogOpen: false,
    dossierCardPresent: false,
    dossierDetailPresent: false,
  });
  assert.deepEqual(errors, [], `页面脚本报错：${errors.join('\n')}`);
  console.log('PASS local SillyTavern profile removal', result);
} finally {
  await context.close();
  await browser.close();
}
