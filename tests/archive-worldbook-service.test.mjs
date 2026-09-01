import test from 'node:test';
import assert from 'node:assert/strict';
import { ArchiveWorldbookService } from '../src/archive-worldbook-service.js';

function clone(value) { return structuredClone(value); }

class FakeStore {
  constructor() { this.value = { roles: {}, hypnosis: { activeEffects: [] }, custom: {} }; }
  get state() { return clone(this.value); }
  async update(mutator) { this.value = await mutator(clone(this.value)); return this.state; }
}

class FakeHost {
  constructor() {
    this.books = new Map([
      ['角色世界书', { entries: { 0: { uid: 0, comment: '林遥人设', content: '林遥是图书委员。', extensions: {} } } }],
      ['迁移目标', { entries: { 9: { uid: 9, comment: '玩家原条目', content: '必须保留', extensions: {} } } }],
    ]);
    this.saveCalls = new Map();
    this.chatWorldbook = '';
    this.messages = [{ message_id: 4, message: '林遥放下书，仍记得刚才生效的安静扳机。', is_user: false }];
  }
  contextKey() { return 'character:1:chat-a'; }
  get context() { return { chatId: 'chat-a', characterId: 0, name2: '测试卡', characters: [{ name: '测试卡' }] }; }
  getWorldbookNames() { return [...this.books.keys()]; }
  getCharacterWorldbookNames() { return { primary: '角色世界书', additional: [] }; }
  loadWorldbook(name) { return clone(this.books.get(name)); }
  async saveWorldbook(name, book) {
    this.saveCalls.set(name, (this.saveCalls.get(name) || 0) + 1);
    this.books.set(name, clone(book));
  }
  getChatWorldbookName() { return this.chatWorldbook; }
  async bindChatWorldbook(name) { this.chatWorldbook = name; }
  getMessages() { return clone(this.messages); }
  async generateRaw() {
    return JSON.stringify({ roles: [{ name: '林遥', gender: '女', currentState: '放下书并保持安静', location: '图书室', hypnosis: '安静扳机已生效', importantFacts: ['记得本轮扳机结果'] }] });
  }
}

function ownedEntries(book) {
  return Object.values(book.entries || {}).filter((entry) => entry?.extensions?.hypnoosArchive?.owner === 'hypnoos3-archive');
}

function hypnosisRuleEntries(book) {
  return Object.values(book.entries || {}).filter((entry) => entry?.extensions?.hypnoosRules?.owner === 'hypnoos3-hypnosis-rules');
}

function allHypnosisRuleCopies(book) {
  return Object.values(book.entries || {}).filter((entry) => entry?.extensions?.hypnoosRules?.owner === 'hypnoos3-hypnosis-rules'
    || entry?.comment === '[HypnoOS内置]催眠规则'
    || String(entry?.content || '').includes('<HypnoOS催眠规则'));
}

test('dedicated archive worldbook persists reply state without MVU and migrates only owned entries', async () => {
  const host = new FakeHost();
  const store = new FakeStore();
  const service = new ArchiveWorldbookService(host, store);

  const binding = await service.configure({ mode: 'dedicated' });
  assert.equal(host.chatWorldbook, binding.worldbookName);
  assert.equal(ownedEntries(host.books.get(binding.worldbookName)).length, 2);
  assert.equal(binding.rulesetVersion, '4.3.0-hypnoos.6');
  const builtInRules = hypnosisRuleEntries(host.books.get(binding.worldbookName));
  assert.equal(builtInRules.length, 1);
  assert.equal(builtInRules[0].comment, '[HypnoOS内置]催眠规则');
  assert.equal(builtInRules[0].constant, true);
  assert.equal(builtInRules[0].position, 0);
  assert.equal(builtInRules[0].order, 17);
  assert.equal(builtInRules[0].ignoreBudget, true);
  assert.equal(builtInRules[0].excludeRecursion, true);
  assert.equal(builtInRules[0].preventRecursion, true);
  assert.equal(builtInRules[0].useProbability, false);
  assert.deepEqual(builtInRules[0].key, ['HypnoOS', '催眠手机', '催眠规则']);
  assert.match(builtInRules[0].content, /<HypnoOS催眠规则.+source-count="2">/);
  assert.match(builtInRules[0].content, /只对人类生效/);

  await service.configure({ mode: 'selected', worldbookName: binding.worldbookName });
  assert.equal(hypnosisRuleEntries(host.books.get(binding.worldbookName)).length, 1);

  const deactivated = await service.deactivateRules();
  assert.equal(deactivated.ok, true);
  assert.equal(hypnosisRuleEntries(host.books.get(binding.worldbookName)).length, 0);
  assert.equal(ownedEntries(host.books.get(binding.worldbookName)).length, 2);
  const activated = await service.activateRules();
  assert.equal(activated.ok, true);
  assert.equal(hypnosisRuleEntries(host.books.get(binding.worldbookName)).length, 1);
  const saveCountAfterActivation = host.saveCalls.get(binding.worldbookName);
  await service.activateRules();
  assert.equal(host.saveCalls.get(binding.worldbookName), saveCountAfterActivation, '重复进入同一聊天不应重写已经正确加载的条目');

  host.books.set('历史绑定世界书', {
    entries: {
      1: { uid: 1, comment: '用户条目', content: '必须保留', extensions: {} },
      2: { uid: 2, comment: '[HypnoOS内置]催眠规则', content: '历史残留', extensions: { hypnoosRules: { owner: 'hypnoos3-hypnosis-rules' } } },
    },
  });
  await service.activateRules();
  assert.equal(hypnosisRuleEntries(host.books.get('历史绑定世界书')).length, 0);
  assert.equal(Object.values(host.books.get('历史绑定世界书').entries).some((entry) => entry.comment === '用户条目'), true);
  assert.equal(hypnosisRuleEntries(host.books.get(binding.worldbookName)).length, 1);

  const synced = await service.syncLatestReply({ knownRoles: ['林遥'] });
  assert.equal(synced.ok, true);
  const options = await service.options();
  assert.equal(options.records[0].name, '林遥');
  assert.match(options.records[0].currentState, /放下书/);
  assert.match(options.records[0].hypnosis, /扳机/);

  const oldName = binding.worldbookName;
  await service.configure({ mode: 'selected', worldbookName: '迁移目标' });
  assert.equal(host.chatWorldbook, '迁移目标');
  assert.equal(ownedEntries(host.books.get(oldName)).length, 0);
  assert.equal(hypnosisRuleEntries(host.books.get(oldName)).length, 0);
  assert.equal(ownedEntries(host.books.get('迁移目标')).length, 2);
  assert.equal(hypnosisRuleEntries(host.books.get('迁移目标')).length, 1);
  assert.equal(Object.values(host.books.get('迁移目标').entries).some((entry) => entry.comment === '玩家原条目' && entry.content === '必须保留'), true);
});

test('existing archive entries are reused and duplicates from older chat keys are collapsed', async () => {
  const host = new FakeHost();
  host.books.set('迁移目标', {
    entries: {
      9: { uid: 9, comment: '玩家原条目', content: '必须保留', extensions: {} },
      20: { uid: 20, comment: '[HypnoOS档案]人物状态', content: '<HypnoOS人物档案存储>\n{"roles":[{"name":"旧人物","currentState":"旧状态"}]}\n</HypnoOS人物档案存储>\n<HypnoOS人物档案存储>\n{"roles":[{"name":"旧人物","currentState":"旧状态"}]}\n</HypnoOS人物档案存储>', extensions: { hypnoosArchive: { owner: 'hypnoos3-archive', chatKey: 'old-chat' } } },
      21: { uid: 21, comment: '[HypnoOS档案]剧情与催眠上下文', content: '<HypnoOS剧情融合规则>\n旧上下文\n</HypnoOS剧情融合规则>\n<HypnoOS剧情融合规则>\n旧上下文\n</HypnoOS剧情融合规则>', extensions: { hypnoosArchive: { owner: 'hypnoos3-archive', chatKey: 'old-chat' } } },
      22: { uid: 22, comment: '[HypnoOS档案]人物状态', content: '<HypnoOS人物档案存储>\n{"roles":[{"name":"重复人物"}]}\n</HypnoOS人物档案存储>', extensions: { hypnoosArchive: { owner: 'hypnoos3-archive', chatKey: 'other-chat' } } },
      23: { uid: 23, comment: '[HypnoOS档案]剧情与催眠上下文', content: '<HypnoOS剧情融合规则>\n重复上下文\n</HypnoOS剧情融合规则>', extensions: { hypnoosArchive: { owner: 'hypnoos3-archive', chatKey: 'other-chat' } } },
    },
  });
  const store = new FakeStore();
  const service = new ArchiveWorldbookService(host, store);

  await service.configure({ mode: 'selected', worldbookName: '迁移目标' });
  const saved = host.books.get('迁移目标');
  const owned = ownedEntries(saved);
  assert.equal(owned.length, 2);
  assert.deepEqual(owned.map((entry) => entry.uid).sort((a, b) => a - b), [20, 21]);
  assert.equal(owned.every((entry) => entry.extensions.hypnoosArchive.chatKey === 'character:1:chat-a'), true);
  assert.equal((owned.find((entry) => entry.uid === 20).content.match(/<HypnoOS人物档案存储>/g) || []).length, 1);
  assert.equal((owned.find((entry) => entry.uid === 21).content.match(/<HypnoOS剧情融合规则>/g) || []).length, 1);
  assert.match(owned.find((entry) => entry.uid === 21).content, /旧上下文/);
  const options = await service.options();
  assert.equal(options.records[0].name, '旧人物');
  assert.equal(options.records[0].currentState, '旧状态');
});

test('built-in hypnosis rules preserve array-shaped worldbook format', async () => {
  const host = new FakeHost();
  host.books.set('数组世界书', { entries: [{ uid: 4, comment: '玩家数组条目', content: '保持数组', extensions: {} }], extensions: { custom: true } });
  const store = new FakeStore();
  const service = new ArchiveWorldbookService(host, store);

  await service.configure({ mode: 'selected', worldbookName: '数组世界书' });
  const saved = host.books.get('数组世界书');
  assert.equal(Array.isArray(saved.entries), true);
  assert.equal(saved.extensions.custom, true);
  assert.equal(saved.entries.some((entry) => entry.comment === '玩家数组条目' && entry.content === '保持数组'), true);
  assert.equal(hypnosisRuleEntries(saved).length, 1);
  await service.deactivateRules();
  const deactivated = host.books.get('数组世界书');
  assert.equal(Array.isArray(deactivated.entries), true);
  assert.equal(hypnosisRuleEntries(deactivated).length, 0);
  assert.equal(deactivated.entries.some((entry) => entry.comment === '玩家数组条目'), true);
});

test('first load and concurrent chat activation collapse matching managed entries before writing', async () => {
  const host = new FakeHost();
  host.books.set('迁移目标', {
    entries: {
      9: { uid: 9, comment: '玩家原条目', content: '必须保留', extensions: {} },
      30: { uid: 30, comment: '[HypnoOS内置]催眠规则', content: '缺少旧版所有者元数据', extensions: {} },
      31: { uid: 31, comment: '旧规则副本', content: '<HypnoOS催眠规则 version="旧版">重复规则</HypnoOS催眠规则>', extensions: {} },
      32: { uid: 32, comment: '[HypnoOS档案]人物状态', content: '<HypnoOS人物档案存储>\n{"roles":[{"name":"保留人物"}]}\n</HypnoOS人物档案存储>', extensions: {} },
      33: { uid: 33, comment: '[HypnoOS档案]人物状态', content: '<HypnoOS人物档案存储>\n{"roles":[{"name":"重复人物"}]}\n</HypnoOS人物档案存储>', extensions: {} },
      34: { uid: 34, comment: '[HypnoOS档案]剧情与催眠上下文', content: '<HypnoOS剧情融合规则>\n保留上下文\n</HypnoOS剧情融合规则>', extensions: {} },
      35: { uid: 35, comment: '[HypnoOS档案]剧情与催眠上下文', content: '<HypnoOS剧情融合规则>\n重复上下文\n</HypnoOS剧情融合规则>', extensions: {} },
    },
  });
  const store = new FakeStore();
  store.value.custom.archiveWorldbookBinding = {
    schemaVersion: 1,
    chatKey: 'character:1:chat-a',
    mode: 'dedicated',
    worldbookName: '迁移目标',
  };
  const service = new ArchiveWorldbookService(host, store);

  await Promise.all([service.activateRules(), service.activateRules(), service.activateRules()]);

  const saved = host.books.get('迁移目标');
  assert.equal(hypnosisRuleEntries(saved).length, 1);
  assert.equal(allHypnosisRuleCopies(saved).length, 1);
  assert.equal(hypnosisRuleEntries(saved)[0].uid, 30, '应复用第一条相同内置规则的 UID');
  assert.equal(ownedEntries(saved).filter((entry) => entry.comment === '[HypnoOS档案]人物状态').length, 1);
  assert.equal(ownedEntries(saved).filter((entry) => entry.comment === '[HypnoOS档案]剧情与催眠上下文').length, 1);
  assert.equal(Object.values(saved.entries).some((entry) => entry.comment === '玩家原条目'), true);
  assert.equal(host.saveCalls.get('迁移目标'), 1, '并发加载只能产生一次去重写入');

  await service.activateRules();
  assert.equal(host.saveCalls.get('迁移目标'), 1, '后续切换回聊天不能重复写入相同条目');
});

test('new worldbook flow refuses to overwrite an existing book', async () => {
  const host = new FakeHost();
  const store = new FakeStore();
  const service = new ArchiveWorldbookService(host, store);
  await assert.rejects(
    service.configure({ mode: 'dedicated', worldbookName: '角色世界书', createOnly: true }),
    /已存在/,
  );
  assert.equal(ownedEntries(host.books.get('角色世界书')).length, 0);
  assert.equal(hypnosisRuleEntries(host.books.get('角色世界书')).length, 0);
});
