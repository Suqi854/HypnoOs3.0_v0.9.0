import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const storageKey = 'hypnoos3.extension.floatingPhone.ui.v1';
const petScreenshotDirectory = process.env.HYPNOOS_QA_PET_SCREENSHOT_DIR || '';
if (petScreenshotDirectory) await mkdir(petScreenshotDirectory, { recursive: true });

function nondecreasing(values) {
  return values.every((value, index) => index === 0 || value + 0.2 >= values[index - 1]);
}

try {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  page.on('console', (message) => {
    const text = message.text();
    if ((message.type() === 'error' || message.type() === 'warning') && /HypnoOS3|\[HypnoOS\]/i.test(text)) {
      errors.push(`${message.type()}: ${text}`);
    }
  });
  await page.goto(process.env.HYPNOOS_ST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
  try {
    await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher.pet-ready'), null, { timeout: 30_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const node = document.querySelector('#hypnoos3-extension-floating-phone-host');
      const launcher = node?.shadowRoot?.querySelector('.launcher');
      return {
        host: Boolean(node),
        launcherClass: launcher?.className || '',
        launcherHtml: launcher?.innerHTML || '',
        scripts: Array.from(document.scripts).map((script) => script.src).filter((source) => source.includes('HypnoOS3.0')),
      };
    });
    throw new Error(`桌宠没有就绪：${JSON.stringify({ diagnostic, errors })}`, { cause: error });
  }
  await page.evaluate((key) => { globalThis.__ST_QA_PET_UI_STATE__ = localStorage.getItem(key); }, storageKey);

  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '本地酒馆没有加载手机 iframe');
  await frame.waitForFunction(() => typeof globalThis.__ST_HYPNOOS_SELECT_INFORMATION_PET__ === 'function', null, { timeout: 30_000 });

  for (const id of ['miku', 'rem', 'mai', 'umaru']) {
    await frame.evaluate((petId) => globalThis.__ST_HYPNOOS_SELECT_INFORMATION_PET__(petId), id);
    await page.waitForFunction((petId) => {
      const launcher = document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher.pet-ready');
      return launcher?.dataset.petCharacter === petId && launcher?.dataset.petState === 'idle';
    }, id);
    const spriteState = await page.evaluate(() => {
      const root = document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot;
      const sprite = root.querySelector('.pet-sprite');
      if (!sprite) {
        return {
          missing: true,
          launcherHtml: root.querySelector('.launcher')?.innerHTML || '',
          resources: performance.getEntriesByType('resource').map((entry) => entry.name).filter((name) => name.includes('floating-bootstrap')),
        };
      }
      return {
        opacity: Number(getComputedStyle(sprite).opacity),
        image: getComputedStyle(sprite).backgroundImage,
        underlayCount: root.querySelectorAll('.pet-sprite-underlay').length,
      };
    });
    assert.equal(spriteState.missing, undefined, `本地酒馆仍在运行旧悬浮宿主：${JSON.stringify(spriteState)}`);
    assert.ok(spriteState.opacity > 0.9, `${id} 的桌宠主体没有显示`);
    assert.match(spriteState.image, new RegExp(`/${id}/${id}-idle-v5\\.png`), `${id} 没有加载重建后的动作条`);
    assert.equal(spriteState.underlayCount, 0, `${id} 仍被旧模糊补层重复渲染`);
    const animationNames = await page.evaluate(() => {
      const launcher = document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher');
      const visual = launcher.querySelector('.pet-visual');
      const result = [];
      for (const state of ['unique_a', 'unique_b', 'held_scared']) {
        launcher.dataset.petState = state;
        result.push(getComputedStyle(visual).animationName);
      }
      launcher.dataset.petState = 'idle';
      return result;
    });
    assert.deepEqual(animationNames, [`pet-${id}-click`, `pet-${id}-long`, `pet-${id}-drag`], `${id} 没有使用各自的单击、长按和拖拽动作`);
    if (petScreenshotDirectory) {
      await page.locator('#hypnoos3-extension-floating-phone-host').locator('.launcher').screenshot({ path: join(petScreenshotDirectory, `${id}.png`), animations: 'disabled' });
    }
  }

  await frame.evaluate(() => globalThis.__ST_HYPNOOS_SELECT_INFORMATION_PET__('miku'));
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher')?.dataset.petCharacter === 'miku');
  const host = page.locator('#hypnoos3-extension-floating-phone-host');
  if (await host.evaluate((node) => node.shadowRoot.querySelector('.launcher').hidden)) {
    await frame.evaluate(() => globalThis.__ST_HYPNOOS_TOGGLE_INFORMATION_PET_MODE__());
    await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher')?.hidden === false);
  }
  if (await host.evaluate((node) => node.shadowRoot.querySelector('.panel').classList.contains('open'))) {
    await host.evaluate((node) => node.shadowRoot.querySelector('.launcher').click());
    await page.waitForTimeout(900);
  }
  const launcherBox = await host.evaluate((node) => node.shadowRoot.querySelector('.launcher').getBoundingClientRect().toJSON());
  const launcherCenter = { x: launcherBox.x + launcherBox.width / 2, y: launcherBox.y + launcherBox.height / 2 };

  await host.evaluate((node) => node.shadowRoot.querySelector('.launcher').click());
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher')?.dataset.petState === 'unique_a');
  await page.waitForTimeout(900);

  const holdState = await host.evaluate(async (node) => {
    const root = node.shadowRoot;
    const launcher = root.querySelector('.launcher');
    const rect = launcher.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', button: 0, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    launcher.dispatchEvent(new PointerEvent('pointerdown', init));
    await new Promise((resolve) => setTimeout(resolve, 560));
    const result = { menu: root.querySelector('.pet-menu').classList.contains('open'), state: launcher.dataset.petState };
    launcher.dispatchEvent(new PointerEvent('pointerup', init));
    return result;
  });
  assert.deepEqual(holdState, { menu: true, state: 'unique_b' }, '桌宠长按没有播放特殊动画并打开菜单');
  await page.keyboard.press('Escape');

  const dragState = await host.evaluate((node) => {
    const root = node.shadowRoot;
    const launcher = root.querySelector('.launcher');
    const rect = launcher.getBoundingClientRect();
    const start = { bubbles: true, cancelable: true, pointerId: 72, pointerType: 'mouse', button: 0, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    launcher.dispatchEvent(new PointerEvent('pointerdown', start));
    launcher.dispatchEvent(new PointerEvent('pointermove', { ...start, clientX: start.clientX - 34, clientY: start.clientY - 28 }));
    const held = launcher.dataset.petState;
    launcher.dispatchEvent(new PointerEvent('pointerup', { ...start, clientX: start.clientX - 34, clientY: start.clientY - 28 }));
    return { held, landed: launcher.dataset.petState };
  });
  assert.deepEqual(dragState, { held: 'held_scared', landed: 'landing' }, '桌宠拖拽或落地没有播放特殊动画');

  const panelOpen = await host.evaluate((node) => node.shadowRoot.querySelector('.panel').classList.contains('open'));
  if (!panelOpen) {
    await host.evaluate((node) => node.shadowRoot.querySelector('.launcher').click());
    if (!await host.evaluate((node) => node.shadowRoot.querySelector('.panel').classList.contains('open'))) {
      await host.evaluate((node) => node.shadowRoot.querySelector('.launcher').click());
    }
  }
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.panel.open'));
  const before = await host.evaluate((node) => {
    const panel = node.shadowRoot.querySelector('.panel');
    const rect = panel.getBoundingClientRect();
    const handle = node.shadowRoot.querySelector('[data-phone-resize="right"]').getBoundingClientRect();
    const phone = node.shadowRoot.querySelector('.phone');
    return { width: rect.width, height: rect.height, offsetWidth: panel.offsetWidth, handleX: handle.x + handle.width / 2, handleY: handle.y + handle.height / 2, phoneWidth: phone.clientWidth, phoneHeight: phone.clientHeight };
  });
  const widths = [];
  await page.mouse.move(before.handleX, before.handleY);
  await page.mouse.down();
  for (let step = 1; step <= 12; step += 1) {
    await page.mouse.move(before.handleX + step * 5, before.handleY + step * 7);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
    widths.push(await host.evaluate((node) => node.shadowRoot.querySelector('.panel').getBoundingClientRect().width));
  }
  await page.mouse.up();
  const after = await host.evaluate((node) => {
    const panel = node.shadowRoot.querySelector('.panel');
    const phone = node.shadowRoot.querySelector('.phone');
    const rect = panel.getBoundingClientRect();
    return { width: rect.width, height: rect.height, offsetWidth: panel.offsetWidth, phoneWidth: phone.clientWidth, phoneHeight: phone.clientHeight };
  });
  assert.ok(after.width > before.width && after.height > before.height, '右下角拖拽没有连续放大整台手机');
  assert.equal(before.offsetWidth, 430);
  assert.equal(after.offsetWidth, 430, '缩放过程中仍在逐帧修改手机布局宽度');
  assert.deepEqual([after.phoneWidth, after.phoneHeight], [before.phoneWidth, before.phoneHeight], '缩放过程中 iframe 布局尺寸发生重排');
  assert.ok(nondecreasing(widths), `缩放宽度发生回跳：${widths.join(',')}`);
  assert.deepEqual(errors, [], `浏览器控制台错误：${errors.join('\n')}`);

  if (process.env.HYPNOOS_QA_SCREENSHOT) await page.screenshot({ path: process.env.HYPNOOS_QA_SCREENSHOT, fullPage: true });
  console.log('PASS local SillyTavern rebuilt pet sprites, click/hold/drag actions and compositor resize');
} finally {
  try {
    await page.evaluate((key) => {
      const saved = globalThis.__ST_QA_PET_UI_STATE__;
      if (saved === null || saved === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, saved);
      delete globalThis.__ST_QA_PET_UI_STATE__;
    }, storageKey);
  } catch {}
  await context.close();
  await browser.close();
}
