import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldSyncArchiveReply } from '../src/floating-host.js';
import { HostAdapter } from '../src/host-adapter.js';

test('active chat requires a loaded message list instead of stale identifiers alone', () => {
  const context = { characterId: 0, chatId: 'stale-chat', chat: [] };
  globalThis.SillyTavern = { getContext: () => context };
  try {
    const host = new HostAdapter();
    assert.equal(host.hasActiveChat(), false);
    context.chat.push({ mes: 'first message' });
    assert.equal(host.hasActiveChat(), true);
  } finally {
    delete globalThis.SillyTavern;
  }
});

test('reads current character worldbook binding and latest message variables without writing', async () => {
  const context = {
    characterId: '0',
    characters: [{ avatar: 'qa.png', data: { extensions: { world: '主世界书' } } }],
    chatMetadata: { world_info: '聊天世界书' },
    extensionSettings: { world_info: { charLore: [{ name: 'qa', extraBooks: ['辅助世界书'] }] } },
    chat: [{ variables: { stat_data: { 系统: { MC能量: 42 }, 角色: { 甲: {} } } } }],
    loadWorldInfo: async (name) => ({ name, entries: {} }),
  };
  globalThis.SillyTavern = { getContext: () => context };
  const host = new HostAdapter();
  assert.deepEqual(await host.getCharacterWorldbookNames(), {
    primary: '主世界书',
    additional: ['辅助世界书', '聊天世界书'],
  });
  assert.equal((await host.loadWorldbook('主世界书')).name, '主世界书');
  assert.equal(host.readMvu({ type: 'message', message_id: 'latest' }).stat_data.系统.MC能量, 42);
  delete globalThis.SillyTavern;
});

test('loading a chat greeting does not trigger archive model synchronization', () => {
  assert.equal(shouldSyncArchiveReply('first_message'), false);
  assert.equal(shouldSyncArchiveReply('normal'), true);
  assert.equal(shouldSyncArchiveReply('swipe'), true);
});

test('prompt projection refreshes immediately when worldbook ownership changes', () => {
  const prompts = [];
  globalThis.SillyTavern = { getContext: () => ({
    chat: [],
    setExtensionPrompt: (...args) => prompts.push(args),
  }) };
  try {
    const host = new HostAdapter();
    host.setPromptText('更新后的运行提示');
    assert.equal(prompts.length, 1);
    assert.equal(prompts[0][1], '更新后的运行提示');
  } finally {
    delete globalThis.SillyTavern;
  }
});

test('converts an embedded character book read-only when no linked book exists', async () => {
  const embedded = { name: '卡内世界书', entries: [{ name: '地点', content: '车站' }] };
  globalThis.SillyTavern = { getContext: () => ({
    characterId: 0,
    characters: [{ name: '角色', avatar: 'role.png', data: { extensions: {}, character_book: embedded } }],
    chatMetadata: {},
    extensionSettings: {},
    convertCharacterBook: (value) => ({ converted: true, source: value }),
  }) };
  const host = new HostAdapter();
  const books = await host.getCharacterWorldbookNames();
  assert.match(books.primary, /^__hypnoos_embedded__:/);
  const book = await host.loadWorldbook(books.primary);
  assert.equal(book.converted, true);
  assert.deepEqual(book.source, embedded);
  delete globalThis.SillyTavern;
});

test('selects the active swipe variable snapshot from SillyTavern message storage', () => {
  globalThis.SillyTavern = { getContext: () => ({
    chat: [{
      swipe_id: 1,
      variables: [
        { stat_data: { 系统: { MC能量: 10 } } },
        { stat_data: { 系统: { MC能量: 77 } } },
      ],
    }],
  }) };
  const host = new HostAdapter();
  assert.equal(host.readVariables({ type: 'message', message_id: 'latest' }).stat_data.系统.MC能量, 77);
  delete globalThis.SillyTavern;
});

test('host input bridge writes the pending turn and direct send uses the native send button', async () => {
  const previousDocument = globalThis.document;
  const previousEvent = globalThis.Event;
  const events = [];
  let clicks = 0;
  const input = {
    value: '旧内容',
    dispatchEvent: (event) => events.push(event.type),
    focus() {},
  };
  const send = {
    disabled: false,
    getAttribute: () => null,
    click: () => { clicks += 1; },
  };
  globalThis.Event = class Event { constructor(type) { this.type = type; } };
  globalThis.document = {
    querySelector: (selector) => selector === '#send_but' ? send : input,
    querySelectorAll: () => [],
  };
  try {
    const host = new HostAdapter();
    assert.equal(host.setInput('玩家输入\n<本轮操作>测试</本轮操作>', { append: false }), true);
    assert.equal(input.value, '玩家输入\n<本轮操作>测试</本轮操作>');
    assert.deepEqual(events, ['input', 'change']);
    assert.equal(await host.directSend('直接发送内容'), true);
    assert.equal(input.value, '直接发送内容');
    assert.equal(clicks, 1);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousEvent === undefined) delete globalThis.Event;
    else globalThis.Event = previousEvent;
  }
});

test('optional TH and MVU mirrors preserve unrelated nested runtime fields', async () => {
  const previousDocument = globalThis.document;
  let th = { 第三方: { keep: true }, 系统: { 外部字段: '保留', MC能量: 1 } };
  let mvu = { metadata: { keep: true }, stat_data: { 系统: { 外部字段: '保留', MC能量: 2 } } };
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.updateVariablesWith = (updater) => { th = updater(th); return th; };
  globalThis.Mvu = {
    getMvuData: () => mvu,
    replaceMvuData: (value) => { mvu = value; return true; },
  };
  try {
    await new HostAdapter().writeOptionalRuntimeState(
      { 系统: { MC能量: 25 }, 角色: {}, 任务: {}, 规则: {} },
      { enableTavernHelperBridge: true, enableMvuBridge: true },
    );
    assert.deepEqual(th.第三方, { keep: true });
    assert.equal(th.系统.外部字段, '保留');
    assert.equal(th.系统.MC能量, 25);
    assert.deepEqual(mvu.metadata, { keep: true });
    assert.equal(mvu.stat_data.系统.外部字段, '保留');
    assert.equal(mvu.stat_data.系统.MC能量, 25);
  } finally {
    delete globalThis.updateVariablesWith;
    delete globalThis.Mvu;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('optional runtime lifecycle forwards MVU updates and disposes subscriptions', async () => {
  const previousDocument = globalThis.document;
  const listeners = new Map();
  let stopped = 0;
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.eventOn = (name, listener) => {
    listeners.set(name, listener);
    return { stop() { stopped += 1; listeners.delete(name); } };
  };
  globalThis.Mvu = {
    events: { VARIABLE_UPDATE_ENDED: 'mvu-update-ended' },
    getMvuData: () => ({}),
    replaceMvuData: () => true,
  };
  try {
    let calls = 0;
    const host = new HostAdapter();
    host.installOptionalRuntimeLifecycle(() => { calls += 1; });
    await Promise.resolve();
    assert.equal(calls, 1);
    listeners.get('mvu-update-ended')();
    await Promise.resolve();
    assert.equal(calls, 2);
    host.destroy();
    assert.equal(stopped, 2);
  } finally {
    delete globalThis.eventOn;
    delete globalThis.Mvu;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('optional runtime lifecycle binds MVU when it initializes after HypnoOS', async () => {
  const previousDocument = globalThis.document;
  const listeners = new Map();
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.eventOn = (name, listener) => {
    listeners.set(name, listener);
    return { stop() { listeners.delete(name); } };
  };
  delete globalThis.Mvu;
  const host = new HostAdapter();
  try {
    let calls = 0;
    host.installOptionalRuntimeLifecycle(() => { calls += 1; });
    assert.equal(listeners.has('global_Mvu_initialized'), true);

    globalThis.Mvu = {
      events: {
        VARIABLE_INITIALIZED: 'mvu-initialized',
        VARIABLE_UPDATE_ENDED: 'mvu-update-ended',
      },
      getMvuData: () => ({}),
      replaceMvuData: () => true,
    };
    listeners.get('global_Mvu_initialized')();
    await Promise.resolve();
    assert.equal(listeners.has('mvu-initialized'), true);
    assert.equal(listeners.has('mvu-update-ended'), true);
    assert.equal(calls, 1);
  } finally {
    host.destroy();
    delete globalThis.eventOn;
    delete globalThis.Mvu;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('optional runtime lifecycle refreshes variables after every AI reply', async () => {
  const previousDocument = globalThis.document;
  const hostListeners = new Map();
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.SillyTavern = { getContext: () => ({
    eventTypes: { MESSAGE_RECEIVED: 'message-received' },
    eventSource: {
      on: (name, listener) => hostListeners.set(name, listener),
      removeListener: (name) => hostListeners.delete(name),
    },
  }) };
  const host = new HostAdapter();
  try {
    let calls = 0;
    host.installOptionalRuntimeLifecycle(() => { calls += 1; });
    hostListeners.get('message-received')();
    await Promise.resolve();
    hostListeners.get('message-received')();
    await Promise.resolve();
    assert.equal(calls, 2);
  } finally {
    host.destroy();
    delete globalThis.SillyTavern;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('optional runtime lifecycle retries when MVU precedes Tavern Helper events', async () => {
  const previousDocument = globalThis.document;
  const listeners = new Map();
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.Mvu = {
    events: { VARIABLE_UPDATE_ENDED: 'mvu-update-ended' },
    getMvuData: () => ({}),
    replaceMvuData: () => true,
  };
  delete globalThis.eventOn;
  const host = new HostAdapter();
  try {
    let calls = 0;
    host.installOptionalRuntimeLifecycle(() => { calls += 1; });
    await Promise.resolve();
    assert.equal(calls, 1);
    globalThis.eventOn = (name, listener) => {
      listeners.set(name, listener);
      return { stop() { listeners.delete(name); } };
    };
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(listeners.has('mvu-update-ended'), true);
  } finally {
    host.destroy();
    delete globalThis.eventOn;
    delete globalThis.Mvu;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('optional runtime snapshots prefer current message MVU over chat mirrors', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { querySelectorAll: () => [] };
  globalThis.SillyTavern = { getContext: () => ({ chat: [{}] }) };
  globalThis.getVariables = (option) => ({ stat_data: { 系统: { MC能量: option.type === 'chat' ? 1 : 2 } } });
  globalThis.Mvu = {
    getMvuData: (option) => ({ stat_data: { 系统: { MC能量: option.type === 'chat' ? 3 : 99 } } }),
    replaceMvuData: () => true,
  };
  try {
    const snapshots = await new HostAdapter().readOptionalRuntimeState();
    assert.equal(snapshots[0].source, 'mvu:message');
    assert.equal(snapshots[0].value.stat_data.系统.MC能量, 99);
  } finally {
    delete globalThis.SillyTavern;
    delete globalThis.getVariables;
    delete globalThis.Mvu;
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
