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

try {
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel'), null, { timeout: 30_000 });
  await page.evaluate(() => globalThis.__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__?.openPhone?.());
  await page.waitForTimeout(800);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载 HypnoOS 手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.getArchiveWorldbookOptions === 'function' && typeof globalThis.configureArchiveWorldbook === 'function', null, { timeout: 30_000 });
  const options = await frame.evaluate(() => globalThis.getArchiveWorldbookOptions());
  if (!options?.binding?.worldbookName) {
    try {
      await frame.locator('.st-archive-bind-overlay').waitFor({ state: 'visible', timeout: 10_000 });
    } catch (error) {
      const debug = await frame.evaluate(() => ({
        bodyChildren: document.body.children.length,
        appChildren: document.querySelector('#app')?.children?.length || 0,
        phoneRoot: Boolean(document.querySelector('#app')),
        latest: globalThis.__ST_HYPNOOS_IS_LATEST_MESSAGE_FRONTEND__?.(),
        retry: globalThis.__ST_ARCHIVE_BIND_PROMPT_RETRY__,
        overlays: document.querySelectorAll('.st-archive-bind-overlay').length,
        ready: globalThis.__ST_HYPNOOS_PATCH_READY__,
        href: location.href,
        htmlRetry: document.documentElement.innerHTML.includes('const retryLater = () =>'),
        apiOptions: typeof globalThis.getArchiveWorldbookOptions,
        apiConfigure: typeof globalThis.configureArchiveWorldbook,
      }));
      throw new Error(`${error.message}; debug=${JSON.stringify(debug)}`);
    }
    assert.equal(await frame.locator('[data-archive-first="dedicated"]').count(), 1);
    assert.equal(await frame.locator('[data-archive-first="character"]').count(), 1);
  }

  await frame.evaluate(() => {
    document.querySelector('.st-archive-bind-overlay')?.remove();
    globalThis.__ST_OPEN_SETTINGS_APP__?.();
  });
  const settings = frame.locator('.st-settings-app').last();
  await settings.waitFor({ state: 'visible' });
  await settings.locator('.st-settings-archive-binding-panel').waitFor({ state: 'visible' });
  const order = await settings.evaluate((node) => ({
    binding: node.innerHTML.indexOf('<h3>档案世界书绑定</h3>'),
    archive: node.innerHTML.indexOf('<h3>档案</h3>'),
  }));
  assert.ok(order.binding >= 0 && order.binding < order.archive, '档案世界书绑定模块没有位于档案设置之前');

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
  console.log('PASS local SillyTavern archive binding and stored-mode outside close', { bound: Boolean(options?.binding?.worldbookName), closeResults });
} finally {
  await browser.close();
}
