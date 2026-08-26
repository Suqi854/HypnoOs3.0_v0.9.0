import assert from 'node:assert/strict';
import test from 'node:test';

import { CHAT_STATE_KEY } from '../src/constants.js';
import { createDefaultRole, createDefaultState } from '../src/contracts.js';
import { createStateBridge } from '../src/floating-host.js';
import { HostAdapter } from '../src/host-adapter.js';
import { getRegionPack } from '../src/regions.js';
import { StateStore } from '../src/state-store.js';

class MemorySettings {
  settings = {
    region: 'cn',
    directApi: {},
    enableTavernHelperBridge: true,
    enableMvuBridge: true,
  };

  async getSettings() { return structuredClone(this.settings); }
  async saveSettings(value) { this.settings = structuredClone(value); }
}

function savedState({ region = 'cn', money, roleName, location }) {
  const state = createDefaultState(getRegionPack(region));
  state.resources.money = money;
  state.location.current = location;
  state.tasks = [{ id: 'task-1', title: `${roleName}任务` }];
  state.achievements = [{ id: 'achievement-1', title: `${roleName}成就` }];
  state.work = [{ id: 'work-1', title: `${roleName}打工` }];
  state.hypnosis.activeEffects = [{ id: 'effect-1', roleName }];
  const role = createDefaultRole(roleName);
  state.roles[role.id] = role;
  return state;
}

class StubHost {
  constructor({ saved = null, snapshots = [] } = {}) {
    this.saved = saved;
    this.snapshots = snapshots;
    this.readCount = 0;
  }

  loadChatState() { return structuredClone(this.saved); }
  async readOptionalRuntimeState() { this.readCount += 1; return structuredClone(this.snapshots); }
  async saveChatState(value) { this.saved = structuredClone(value); return true; }
  setPromptText() {}
  async writeOptionalRuntimeState() {}
}

test('startup creates and persists a complete HypnoState without TH or MVU', async () => {
  const context = { characterId: 0, chatId: 'fresh-chat', chatMetadata: {}, saveMetadataDebounced() {} };
  globalThis.SillyTavern = { getContext: () => context };
  delete globalThis.Mvu;
  delete globalThis.updateVariablesWith;
  try {
    const store = new StateStore(new HostAdapter(), new MemorySettings());
    const state = await store.initialize();
    assert.equal(state.schema, 'HypnoState/v1');
    assert.deepEqual(state.roles, {});
    assert.ok(Array.isArray(state.tasks) && Array.isArray(state.achievements) && Array.isArray(state.work));
    assert.equal(context.chatMetadata[CHAT_STATE_KEY].schema, 'HypnoState/v1');
  } finally {
    delete globalThis.SillyTavern;
  }
});

test('startup migrates legacy runtime data once when HypnoState is absent', async () => {
  const host = new StubHost({
    snapshots: [{ source: 'mvu:message', value: { stat_data: {
      系统: { 持有零花钱: 4321, 外部字段: '保留' },
      角色: { 旧角色: { 好感度: 17 } },
    } } }],
  });
  const store = new StateStore(host, new MemorySettings());
  const state = await store.initialize();
  assert.equal(state.schema, 'HypnoState/v1');
  assert.equal(state.resources.money, 4321);
  assert.equal(Object.values(state.roles)[0].name, '旧角色');
  assert.equal(state.custom.legacyVariables.系统.外部字段, '保留');
  assert.equal(host.saved.schema, 'HypnoState/v1');
});

test('saved HypnoState wins over conflicting optional runtime snapshots', async () => {
  const saved = savedState({ money: 1200, roleName: '权威角色', location: '权威地点' });
  const host = new StubHost({
    saved,
    snapshots: [{ value: { stat_data: { 系统: { 持有零花钱: 9999 } } } }],
  });
  const store = new StateStore(host, new MemorySettings());
  const state = await store.initialize();
  assert.equal(state.resources.money, 1200);
  assert.equal(state.location.current, '权威地点');
  assert.equal(host.readCount, 0);
});

test('optional runtime updates enter HypnoState once without mirror loops', async () => {
  const saved = savedState({ money: 1200, roleName: '同步角色', location: '同步地点' });
  const host = new StubHost({ saved });
  const store = new StateStore(host, new MemorySettings());
  await store.initialize();
  host.snapshots = [{ value: { stat_data: { 系统: { 持有零花钱: 2468 } } } }];

  const changed = await store.syncOptionalRuntimeState();
  assert.equal(changed.resources.money, 2468);
  const revision = changed.revision;

  const unchanged = await store.syncOptionalRuntimeState();
  assert.equal(unchanged.revision, revision);
  assert.equal(unchanged.resources.money, 2468);
});

test('phone bridge reads and writes HypnoState even when external runtimes disagree', async () => {
  const state = createDefaultState(getRegionPack('cn'));
  state.resources.money = 1200;
  const imports = [];
  const store = {
    get state() { return structuredClone(state); },
    async importLegacyVariables(value) { imports.push(structuredClone(value)); },
  };
  const host = {
    readVariables: () => ({ 系统: { 持有零花钱: 9999 } }),
    readMvu: () => ({ stat_data: { 系统: { 持有零花钱: 8888 } } }),
    getMvuEvents: () => ({ VARIABLE_UPDATE_ENDED: 'external-event' }),
  };
  const bridge = createStateBridge(host, store);

  assert.equal(bridge.getVariables({ type: 'message', message_id: 3 }).系统.持有零花钱, 1200);
  assert.equal(bridge.Mvu.getMvuData({ type: 'chat' }).stat_data.系统.持有零花钱, 1200);

  const updated = bridge.updateVariablesWith((variables) => {
    variables.系统.持有零花钱 = 1300;
    return variables;
  });
  assert.equal(updated.系统.持有零花钱, 1300);
  assert.equal(imports[0].系统.持有零花钱, 1300);

  bridge.updateVariablesWith((variables) => { variables.系统.持有零花钱 = 1350; });
  assert.equal(imports[1].系统.持有零花钱, 1350);

  await bridge.Mvu.replaceMvuData({ stat_data: { 系统: { 持有零花钱: 1400 } } });
  assert.equal(imports[2].系统.持有零花钱, 1400);
});

test('chat switching reloads each chat state and preserves its roles and app data', async () => {
  const chatA = {
    characterId: 0,
    chatId: 'chat-a',
    chatMetadata: { [CHAT_STATE_KEY]: savedState({ money: 1200, roleName: '旧人物A', location: '旧地点A' }) },
    saveMetadataDebounced() {},
  };
  const chatB = {
    characterId: 0,
    chatId: 'chat-b',
    chatMetadata: { [CHAT_STATE_KEY]: savedState({ region: 'jp', money: 9800, roleName: '旧人物B', location: '旧地点B' }) },
    saveMetadataDebounced() {},
  };
  let active = chatA;
  globalThis.SillyTavern = { getContext: () => active };
  try {
    const host = new HostAdapter();
    const store = new StateStore(host, new MemorySettings());
    const first = await store.initialize();
    assert.equal(host.contextKey(), 'character:0:chat-a');
    assert.equal(first.resources.money, 1200);
    assert.equal(Object.values(first.roles)[0].name, '旧人物A');

    active = chatB;
    const second = await store.initialize();
    assert.equal(host.contextKey(), 'character:0:chat-b');
    assert.equal(second.region, 'jp');
    assert.equal(second.resources.money, 9800);
    assert.equal(second.location.current, '旧地点B');
    assert.equal(Object.values(second.roles)[0].name, '旧人物B');
    assert.equal(second.tasks[0].title, '旧人物B任务');
    assert.equal(second.achievements[0].title, '旧人物B成就');
    assert.equal(second.work[0].title, '旧人物B打工');
    assert.equal(second.hypnosis.activeEffects[0].roleName, '旧人物B');
    assert.equal(chatA.chatMetadata[CHAT_STATE_KEY].resources.money, 1200);
  } finally {
    delete globalThis.SillyTavern;
  }
});
