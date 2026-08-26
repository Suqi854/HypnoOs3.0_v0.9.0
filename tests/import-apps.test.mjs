import test from 'node:test';
import assert from 'node:assert/strict';
import { AppDataService } from '../src/app-data-service.js';
import { PHONE_APPS } from '../src/apps.js';
import { createDefaultRole, createDefaultState } from '../src/contracts.js';
import { getRegionPack } from '../src/regions.js';
import { importRoleFile, validateAvatar } from '../src/role-import.js';

test('app registry uses versioned declarations and unique IDs', () => {
  assert.equal(PHONE_APPS.length, 23);
  assert.equal(new Set(PHONE_APPS.map((app) => app.id)).size, PHONE_APPS.length);
  assert.ok(PHONE_APPS.every((app) => app.schema === 'PhoneAppModule/v1' && Array.isArray(app.readPaths) && app.fallback));
});

test('map calendar monitor work and task apps read through AppDataService', async () => {
  const state = createDefaultState(getRegionPack('jp'));
  const role = createDefaultRole('服务角色');
  state.roles[role.id] = role;
  state.tasks = [{ id: 'task-1', title: '服务任务' }];
  state.achievements = [{ id: 'achievement-1', title: '服务成就' }];
  state.work = [{ id: 'work-1', title: '服务打工' }];
  const host = {
    getWorldbookNames: () => ['主世界书'],
    getCharacterWorldbookNames: async () => ({ primary: '主世界书', additional: [] }),
    loadWorldbook: async (name) => ({ name }),
  };
  const service = new AppDataService(host, {
    get state() { return structuredClone(state); },
    async importLegacyVariables() {},
  });

  assert.equal(service.readAppData('map').location.current, state.location.current);
  assert.equal(service.readAppData('map').locations[0].name, '自宅');
  assert.equal(service.readAppData('calendar').calendar.weekdays[0], '月曜日');
  assert.equal(Object.values(service.readAppData('monitor').roles)[0].name, '服务角色');
  assert.equal(service.readAppData('work').work[0].title, '服务打工');
  assert.equal(service.readAppData('achievements').tasks[0].title, '服务任务');
  assert.deepEqual(await service.getCharacterWorldbookNames(), { primary: '主世界书', additional: [] });
  assert.equal((await service.getWorldbook('主世界书')).name, '主世界书');
});

test('JSON card imports as inert role data', async () => {
  const card = { spec: 'chara_card_v3', data: { name: '测试角色', description: '<script>alert(1)</script>仅作为文本', personality: '冷静', character_book: { entries: [{ id: 1, name: '资料', keys: ['测试'], content: '<iframe src=x></iframe>' }] } } };
  const file = new Blob([JSON.stringify(card)], { type: 'application/json' });
  Object.defineProperty(file, 'name', { value: 'card.json' });
  const role = await importRoleFile(file);
  assert.equal(role.name, '测试角色');
  assert.match(role.summary, /script/);
  assert.equal(role.worldbookFragments.length, 1);
});

test('avatar rejects executable or unknown content', async () => {
  await assert.rejects(validateAvatar(new Blob(['<svg onload=alert(1)>'], { type: 'image/svg+xml' })), /PNG、JPEG、WebP 或 GIF/);
});

test('native JSON role pack accepts a bounded image data URL', async () => {
  const payload = { schema: 'RolePack/v1', name: '原生包', assets: { avatarDataUrl: `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]).toString('base64')}` } };
  const file = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  Object.defineProperty(file, 'name', { value: 'hypnoos-role.json' });
  const role = await importRoleFile(file);
  assert.equal(role.name, '原生包');
  assert.equal(role.pendingAvatar.type, 'image/png');
});
