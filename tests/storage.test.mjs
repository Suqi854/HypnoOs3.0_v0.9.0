import assert from 'node:assert/strict';
import test from 'node:test';

import { HypnoStorage } from '../src/storage.js';

test('chat mirrors stay isolated during switches and delete only with their chat record', async () => {
  const storage = new HypnoStorage();
  const chatA = 'character:0:chat-a';
  const chatB = 'character:0:chat-b';
  await storage.saveChatState(chatA, { revision: 2, marker: 'A' });
  await storage.saveChatState(chatB, { revision: 3, marker: 'B' });

  assert.equal((await storage.getChatState(chatA)).marker, 'A');
  assert.equal((await storage.getChatState(chatB)).marker, 'B');

  assert.deepEqual(await storage.deleteChatStateByChatId('chat-a.jsonl', { scopeKey: 'character:0' }), [chatA]);
  assert.equal(await storage.getChatState(chatA), null);
  assert.equal((await storage.getChatState(chatB)).marker, 'B');
  storage.close();
});

test('ambiguous same-name chats are preserved unless the owner scope is known', async () => {
  const storage = new HypnoStorage();
  await storage.saveChatState('character:0:same-name', { marker: 'A' });
  await storage.saveChatState('character:1:same-name', { marker: 'B' });

  assert.deepEqual(await storage.deleteChatStateByChatId('same-name'), []);
  assert.equal((await storage.getChatState('character:0:same-name')).marker, 'A');
  assert.equal((await storage.getChatState('character:1:same-name')).marker, 'B');
  assert.deepEqual(await storage.deleteChatStateByChatId('same-name', { scopeKey: 'character:1' }), ['character:1:same-name']);
  assert.equal((await storage.getChatState('character:0:same-name')).marker, 'A');
  assert.equal(await storage.getChatState('character:1:same-name'), null);
  storage.close();
});

test('an explicit owner scope never falls back to another character save', async () => {
  const storage = new HypnoStorage();
  await storage.saveChatState('character:1:only-name', { marker: 'B' });

  assert.deepEqual(await storage.deleteChatStateByChatId('only-name', { scopeKey: 'character:0' }), []);
  assert.equal((await storage.getChatState('character:1:only-name')).marker, 'B');
  storage.close();
});
