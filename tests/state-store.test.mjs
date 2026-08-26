import assert from 'node:assert/strict';
import test from 'node:test';

import { CHAT_STATE_KEY } from '../src/constants.js';
import { createDefaultRole, createDefaultState } from '../src/contracts.js';
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
