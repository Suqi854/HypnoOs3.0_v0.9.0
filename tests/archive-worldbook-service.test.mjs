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
    this.chatWorldbook = '';
    this.messages = [{ message_id: 4, message: '林遥放下书，仍记得刚才生效的安静扳机。', is_user: false }];
  }
  contextKey() { return 'character:1:chat-a'; }
  get context() { return { chatId: 'chat-a', characterId: 0, name2: '测试卡', characters: [{ name: '测试卡' }] }; }
  getWorldbookNames() { return [...this.books.keys()]; }
  getCharacterWorldbookNames() { return { primary: '角色世界书', additional: [] }; }
  loadWorldbook(name) { return clone(this.books.get(name)); }
  async saveWorldbook(name, book) { this.books.set(name, clone(book)); }
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

test('dedicated archive worldbook persists reply state without MVU and migrates only owned entries', async () => {
  const host = new FakeHost();
  const store = new FakeStore();
  const service = new ArchiveWorldbookService(host, store);

  const binding = await service.configure({ mode: 'dedicated' });
  assert.equal(host.chatWorldbook, binding.worldbookName);
  assert.equal(ownedEntries(host.books.get(binding.worldbookName)).length, 2);

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
  assert.equal(ownedEntries(host.books.get('迁移目标')).length, 2);
  assert.equal(Object.values(host.books.get('迁移目标').entries).some((entry) => entry.comment === '玩家原条目' && entry.content === '必须保留'), true);
});
