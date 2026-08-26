import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const modules = process.env.CODEX_NODE_MODULES;
if (!modules) throw new Error('请设置 CODEX_NODE_MODULES 为包含 playwright 的 node_modules 路径');
const require = createRequire(import.meta.url);
const { chromium } = require(join(modules, 'playwright'));
const previewPort = Number(process.env.HYPNOOS_PREVIEW_PORT || 6633);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_BROWSER_EXECUTABLE || undefined });

async function verify(viewport, screenshotName) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
  await page.goto(`http://127.0.0.1:${previewPort}/preview.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const context = globalThis.SillyTavern.getContext();
    context.chatId = 'qa-chaos-monitor';
    context.chat = [
      { mes: '今天放学后去了旧图书馆。', is_user: true, name: 'user' },
      { mes: '走廊里有人在讨论新开放的资料室。', is_user: false, name: '角色', mesid: 9 },
    ];
    context.generateRaw = () => JSON.stringify({
      newPosts: [{ boardId: 'general', title: '旧图书馆的新动静', body: '有人也看见资料室开放了吗？', replies: ['刚路过，走廊确实有人。'] }],
      replyUpdates: [],
    });
    globalThis.SillyTavern = { getContext: () => context };
  });
  await page.waitForFunction(() => document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher'));
  await page.evaluate(() => document.querySelector('#hypnoos3-extension-floating-phone-host').shadowRoot.querySelector('.launcher').click());
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame());
  assert.ok(frame, '手机 iframe 未加载');
  await frame.waitForFunction(() => document.body?.innerText?.includes('本轮输入'));

  await frame.evaluate(() => {
    const now = Date.now();
    const boards = [
      { id: 'notice', name: '公告区', description: '' },
      { id: 'guide', name: '新手引导区', description: '' },
      { id: 'general', name: '综合讨论区', description: '' },
      { id: 'showcase', name: '成果展示区', description: '' },
      { id: 'help', name: '求助区', description: '' },
    ];
    const threads = Array.from({ length: 20 }, (_, index) => ({
      id: `old-${index}`,
      boardId: 'general',
      title: `旧帖${index}`,
      author: 'anonymous',
      body: '旧内容',
      createdAt: now - (20 - index) * 1000,
      updatedAt: now - (20 - index) * 1000,
      replies: [{ id: `reply-${index}`, author: 'anonymous', body: '旧回复', createdAt: now }],
    }));
    localStorage.setItem('hypnoos:chaos-forum:v1:global', JSON.stringify({ version: 2, activeBoardId: 'general', activeThreadId: null, query: '', boards, threads, meta: {} }));
    localStorage.setItem('hypnoos:adaptive-region:v1', 'auto');
    localStorage.setItem('hypnoos:world-adaptation:v1:global', JSON.stringify({
      schema: 'HypnoWorldAdaptation/v1',
      worldbookName: 'QA世界书',
      worldbookNames: ['QA世界书'],
      apps: { monitor: [
        { title: '旧图书馆入口', summary: '观察资料室来访安排。', meta: '放学后' },
        { title: '钟楼走廊', summary: '记录钟楼附近的人员动向。', meta: '傍晚' },
        { title: '海滨车站', summary: '观察车站公共通道。', meta: '全天' },
      ] },
    }));
  });

  await frame.locator('[aria-label="打开混沌心海"]').click();
  await frame.locator('[aria-label="手动更新混沌心海"]').click();
  await frame.waitForFunction(() => document.body?.innerText?.includes('更新完成：新增1帖、1条回复。'));
  assert.equal(await frame.locator('.st-mchan-thread').count(), 20, '帖子数量没有限制为20');
  assert.equal(await frame.locator('.st-mchan-thread', { hasText: '旧帖0' }).count(), 0, '超过20帖后没有删除最旧帖子');
  assert.equal(await frame.locator('.st-mchan-thread', { hasText: '旧图书馆的新动静' }).count(), 1, '手动模型更新没有添加帖子');
  await page.screenshot({ path: `docs/screenshots/${screenshotName.replace('chaos-monitor', 'chaos-forum')}`, fullPage: true });
  await frame.locator('[data-mchan-action="back"]').click();

  await frame.locator('[aria-label="打开监控"]').click();
  const monitorText = await frame.locator('.st-monitor-app').innerText();
  for (const location of ['旧图书馆入口', '钟楼走廊', '海滨车站']) assert.match(monitorText, new RegExp(location));
  assert.equal(await frame.locator('.st-monitor-gate').count(), 3, '监控原三门UI发生变化');
  assert.ok(await frame.locator('.st-monitor-app .st-lite-body').evaluate((node) => node.scrollWidth - node.clientWidth <= 1), '监控页面发生横向溢出');
  await page.screenshot({ path: `docs/screenshots/${screenshotName}`, fullPage: true });
  assert.deepEqual(errors, []);
  await page.close();
}

await verify({ width: 1180, height: 900 }, '1.0.0-desktop-chaos-monitor.png');
await verify({ width: 760, height: 900 }, '1.0.0-narrow-chaos-monitor.png');
console.log('PASS 1.0.0 chaos forum model refresh, 20-post cap, adaptive monitor, and overflow checks');
await browser.close();
