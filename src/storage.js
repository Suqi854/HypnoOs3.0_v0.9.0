import { DIRECT_API_SECRET_KEY, SETTINGS_KEY } from './constants.js';
import { clone } from './utils.js';

const DB_NAME = 'hypnoos3';
const DB_VERSION = 1;
const STORES = ['global', 'characters', 'assets', 'adapters'];
const CHAT_STATE_PREFIX = 'chat-state:';

function normalizedChatId(value) {
  return String(value || '').trim().replace(/(?:\.jsonl)+$/iu, '');
}

function chatStateContextKey(storageKey) {
  const key = String(storageKey || '');
  return key.startsWith(CHAT_STATE_PREFIX) ? key.slice(CHAT_STATE_PREFIX.length) : '';
}

function contextChatId(contextKey) {
  const match = String(contextKey || '').match(/^(?:character|group):[^:]+:(.*)$/u);
  return match ? match[1] : '';
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of STORES) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class HypnoStorage {
  #dbPromise = openDatabase().catch(() => null);
  #memory = new Map();
  #sessionSecret = '';

  async get(store, key, fallback = null) {
    const db = await this.#dbPromise;
    if (!db) return clone(this.#memory.get(`${store}:${key}`) ?? fallback);
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(clone(request.result ?? fallback));
      request.onerror = () => reject(request.error);
    });
  }

  async set(store, key, value) {
    const db = await this.#dbPromise;
    if (!db) {
      this.#memory.set(`${store}:${key}`, clone(value));
      return value;
    }
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readwrite').objectStore(store).put(clone(value), key);
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(store, key) {
    const db = await this.#dbPromise;
    if (!db) return this.#memory.delete(`${store}:${key}`);
    return new Promise((resolve, reject) => {
      const request = db.transaction(store, 'readwrite').objectStore(store).delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async list(store) {
    const db = await this.#dbPromise;
    if (!db) {
      const prefix = `${store}:`;
      return [...this.#memory.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key: key.slice(prefix.length), value: clone(value) }));
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const objectStore = transaction.objectStore(store);
      const keysRequest = objectStore.getAllKeys();
      const valuesRequest = objectStore.getAll();
      transaction.oncomplete = () => resolve(keysRequest.result.map((key, index) => ({ key, value: clone(valuesRequest.result[index]) })));
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getSettings() {
    return this.get('global', SETTINGS_KEY, {
      region: 'cn',
      activeProfileId: null,
      directApi: { endpoint: '', model: '', persistSecret: false, temperature: 0.7, maxTokens: 4096 },
      companionPrefix: 'HypnoOS',
      enableTavernHelperBridge: true,
      enableMvuBridge: true,
    });
  }

  async saveSettings(settings) {
    const safe = clone(settings);
    if (safe.directApi) delete safe.directApi.apiKey;
    return this.set('global', SETTINGS_KEY, safe);
  }

  async getChatState(contextKey) {
    const key = String(contextKey || '').trim();
    if (!key) return null;
    return this.get('adapters', `${CHAT_STATE_PREFIX}${key}`, null);
  }

  async saveChatState(contextKey, state) {
    const key = String(contextKey || '').trim();
    if (!key) return false;
    await this.set('adapters', `${CHAT_STATE_PREFIX}${key}`, state);
    return true;
  }

  async deleteChatState(contextKey) {
    const key = String(contextKey || '').trim();
    if (!key) return false;
    return this.delete('adapters', `${CHAT_STATE_PREFIX}${key}`);
  }

  async deleteChatStateByChatId(chatId, { scopeKey = '' } = {}) {
    const targetId = normalizedChatId(chatId);
    if (!targetId) return [];
    const records = await this.list('adapters');
    const matches = records
      .map(({ key }) => chatStateContextKey(key))
      .filter((contextKey) => contextKey && normalizedChatId(contextChatId(contextKey)) === targetId);
    const owner = String(scopeKey || '').trim();
    const scoped = owner ? matches.filter((contextKey) => contextKey.startsWith(`${owner}:`)) : [];
    const targets = owner ? scoped : (matches.length === 1 ? matches : []);
    for (const contextKey of targets) await this.deleteChatState(contextKey);
    return targets;
  }

  setDirectApiSecret(value, persist = false) {
    this.#sessionSecret = String(value || '');
    try {
      if (persist && this.#sessionSecret) localStorage.setItem(DIRECT_API_SECRET_KEY, this.#sessionSecret);
      else localStorage.removeItem(DIRECT_API_SECRET_KEY);
    } catch {}
  }

  getDirectApiSecret(allowPersisted = false) {
    if (this.#sessionSecret) return this.#sessionSecret;
    if (!allowPersisted) return '';
    try { return localStorage.getItem(DIRECT_API_SECRET_KEY) || ''; } catch { return ''; }
  }

  close() {
    this.#dbPromise.then((db) => db?.close()).catch(() => {});
  }
}
