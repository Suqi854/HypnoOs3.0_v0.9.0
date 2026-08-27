import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

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
  assert.ok(frame, '本地酒馆没有加载手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_OPEN_AVATAR_LIBRARY_APP__ === 'function', null, { timeout: 30_000 });
  const runtimeMarkup = await frame.content();
  assert.ok(runtimeMarkup.includes('data-profile-avatar-library-picker'), '本地酒馆仍在运行未包含档案头像库选择器的旧构建');

  const roleName = 'HypnoOS_QA_头像角色';
  await frame.evaluate((name) => {
    let current = { stat_data: { 系统: {}, 角色: { [name]: { 信息: { 姓名: name, 性别: '女' }, 状态: {}, 效果: {} } } } };
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
    localStorage.setItem('hypnoos:profile-worldbook-roles:v1:global', JSON.stringify({
      schema: 'HypnoProfileWorldbooks/v1',
      roles: { [name]: current.stat_data.角色[name] },
    }));
    globalThis.__ST_OPEN_AVATAR_LIBRARY_APP__();
  }, roleName);

  const avatarPage = frame.locator('.st-avatar-library-app');
  await avatarPage.waitFor({ state: 'visible' });
  const fixture = resolve('public/assets/maps/public-toilet-monitor-map.png');
  await avatarPage.locator('[data-avatar-files]').setInputFiles(fixture);
  await frame.waitForFunction(() => document.querySelector('.st-avatar-feedback')?.textContent?.includes('已导入 1 张'));
  await frame.evaluate((name) => globalThis.__ST_OPEN_FEMALE_PROFILE_APP__('info', name), roleName);
  const profile = frame.locator('.st-profile-app');
  await profile.waitFor({ state: 'visible' });
  await profile.locator('[data-profile-action="upload-photo"]').dispatchEvent('mousedown', { button: 0 });
  const photoDialog = profile.locator('[data-profile-photo-dialog]');
  await photoDialog.waitFor({ state: 'visible' });
  assert.equal(await photoDialog.locator('.st-profile-photo-slot').count(), 4, '照片夹不再保持四个槽位');
  await photoDialog.locator('.st-profile-photo-preview[data-profile-photo-slot="0"]').dispatchEvent('mousedown', { button: 0 });
  const picker = profile.locator('[data-profile-avatar-library-picker]');
  await picker.waitFor({ state: 'visible' });
  assert.equal(await photoDialog.locator('.st-profile-photo-slot').count(), 4, '打开头像库后改变了原照片夹布局');
  assert.equal(await picker.locator('[data-profile-avatar-library-select]').count(), 1, '档案内头像库没有读取已上传头像');
  if (process.env.HYPNOOS_QA_SCREENSHOT) await profile.screenshot({ path: process.env.HYPNOOS_QA_SCREENSHOT });
  await picker.locator('[data-profile-avatar-library-select]').dispatchEvent('mousedown', { button: 0 });
  await picker.waitFor({ state: 'detached' });
  const slotSource = await photoDialog.locator('[data-profile-photo-slot="0"]').locator('xpath=ancestor::article[1]').locator('img').getAttribute('src');
  const source = await profile.locator('.st-person-photo img').getAttribute('src');
  assert.match(String(slotSource || ''), /^data:image\/png;base64,/, '所选头像没有写入指定照片槽位');
  assert.equal(source, slotSource, '主档案头像没有同步为所选槽位');
  assert.deepEqual(errors, [], `页面脚本报错：${errors.join('\n')}`);
  console.log('PASS local SillyTavern profile slot avatar picker', { roleName, sourceLength: source.length });
} finally {
  await context.close();
  await browser.close();
}
