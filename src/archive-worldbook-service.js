import { clone, isRecord, stableStringify } from './utils.js';

const OWNER = 'hypnoos3-archive';
const BINDING_KEY = 'archiveWorldbookBinding';
const ARCHIVE_COMMENT = '[HypnoOS档案]人物状态';
const CONTEXT_COMMENT = '[HypnoOS档案]剧情与催眠上下文';

function entriesOf(book) {
  if (Array.isArray(book?.entries)) return book.entries;
  if (isRecord(book?.entries)) return Object.values(book.entries);
  return [];
}

function entryMap(book) {
  const source = isRecord(book) ? clone(book) : {};
  const entries = source.entries;
  if (Array.isArray(entries)) return { source, entries, array: true };
  source.entries = isRecord(entries) ? entries : {};
  return { source, entries: source.entries, array: false };
}

function managed(entry, chatKey) {
  const meta = entry?.extensions?.hypnoosArchive;
  return meta?.owner === OWNER && String(meta.chatKey || '') === String(chatKey || '');
}

function nextUid(entries) {
  return entries.reduce((max, entry) => Math.max(max, Number(entry?.uid ?? entry?.id ?? -1) || -1), -1) + 1;
}

function makeEntry(uid, comment, content, chatKey, constant = false) {
  return {
    uid,
    key: ['HypnoOS', '催眠手机', '人物档案'],
    keysecondary: [],
    comment,
    content,
    constant,
    selective: !constant,
    order: constant ? 18 : 19,
    position: 0,
    disable: false,
    addMemo: true,
    excludeRecursion: false,
    preventRecursion: false,
    probability: 100,
    useProbability: true,
    depth: 4,
    role: 0,
    extensions: { hypnoosArchive: { owner: OWNER, schemaVersion: 1, chatKey } },
  };
}

function replaceManagedEntries(book, chatKey, records, contextText) {
  const mapped = entryMap(book);
  const current = entriesOf(mapped.source).filter((entry) => !managed(entry, chatKey));
  let uid = nextUid(current);
  const archiveContent = [
    '<HypnoOS人物档案存储>',
    '以下是当前对话的持续档案快照。只把剧情中已经明确发生的事实视为有效，不得把未知项自行补全。',
    stableStringify({ updatedAt: new Date().toISOString(), roles: records }),
    '</HypnoOS人物档案存储>',
  ].join('\n');
  const contextContent = [
    '<HypnoOS剧情融合规则>',
    '催眠手机下达的操作必须结合当前人物关系、地点、已发生剧情与既有催眠效果自然执行。不得突然跳出故事解释系统，不得把未执行的指令写成已生效事实。',
    String(contextText || '').slice(0, 6000),
    '</HypnoOS剧情融合规则>',
  ].join('\n');
  const next = [
    ...current,
    makeEntry(uid++, ARCHIVE_COMMENT, archiveContent, chatKey, false),
    makeEntry(uid++, CONTEXT_COMMENT, contextContent, chatKey, true),
  ];
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function removeManagedEntries(book, chatKey) {
  const mapped = entryMap(book);
  const next = entriesOf(mapped.source).filter((entry) => !managed(entry, chatKey));
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function parseJson(text) {
  const candidate = isRecord(text) ? (text.content ?? text.response ?? text.text ?? text.message ?? text) : text;
  if (isRecord(candidate)) return candidate;
  const source = String(candidate || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(source); } catch {}
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(source.slice(start, end + 1)); } catch {}
  }
  return null;
}

function boundedRoleRecords(value) {
  const rows = Array.isArray(value?.roles) ? value.roles : [];
  return rows.slice(0, 80).map((row) => ({
    name: String(row?.name || '').trim().slice(0, 80),
    gender: String(row?.gender || '').trim().slice(0, 20),
    currentState: String(row?.currentState || '').trim().slice(0, 1200),
    clothing: String(row?.clothing || '').trim().slice(0, 600),
    location: String(row?.location || '').trim().slice(0, 200),
    relationship: String(row?.relationship || '').trim().slice(0, 600),
    hypnosis: String(row?.hypnosis || '').trim().slice(0, 1200),
    importantFacts: (Array.isArray(row?.importantFacts) ? row.importantFacts : []).map(String).map((item) => item.trim()).filter(Boolean).slice(0, 12),
  })).filter((row) => row.name);
}

function latestAssistantMessage(host) {
  const messages = host.getMessages();
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (!messages[index]?.is_user && String(messages[index]?.message || '').trim()) return messages[index];
  }
  return null;
}

function bindingFromState(state) {
  const value = state?.custom?.[BINDING_KEY];
  return isRecord(value) && value.worldbookName ? clone(value) : null;
}

export class ArchiveWorldbookService {
  constructor(host, store) {
    this.host = host;
    this.store = store;
    this.syncing = null;
  }

  getBinding() {
    return bindingFromState(this.store.state);
  }

  async options() {
    const names = await Promise.resolve(this.host.getWorldbookNames()) || [];
    const character = await this.host.getCharacterWorldbookNames();
    const binding = this.getBinding();
    let records = [];
    if (binding?.worldbookName) {
      try {
        const book = await this.host.loadWorldbook(binding.worldbookName);
        const archive = entriesOf(book).find((entry) => managed(entry, binding.chatKey) && entry.comment === ARCHIVE_COMMENT);
        records = boundedRoleRecords(parseJson(String(archive?.content || '').match(/\{[\s\S]*\}/)?.[0] || ''));
      } catch {}
    }
    return { names: [...new Set(names.map(String).filter(Boolean))], character, binding, records };
  }

  async configure({ mode, worldbookName = '' } = {}) {
    const chatKey = this.host.contextKey();
    const previous = this.getBinding();
    const names = (await Promise.resolve(this.host.getWorldbookNames()) || []).map(String);
    let targetName = String(worldbookName || '').trim();
    if (mode === 'character') {
      const books = await this.host.getCharacterWorldbookNames();
      targetName = String(books?.primary || '').trim();
      if (!targetName || targetName.startsWith('__hypnoos_embedded__:')) throw new Error('当前角色卡没有可写入的绑定世界书。');
    } else if (mode === 'dedicated' && !targetName) {
      const context = this.host.context;
      const character = String(context?.characters?.[context?.characterId]?.name || context?.name2 || '当前角色').trim();
      const base = `HypnoOS档案 - ${character} - ${String(context?.chatId || '当前对话').replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 32)}`;
      targetName = base;
      for (let index = 2; names.includes(targetName); index += 1) targetName = `${base} ${index}`;
    }
    if (!targetName) throw new Error('没有选择目标世界书。');
    let targetBook = names.includes(targetName) ? await this.host.loadWorldbook(targetName) : { entries: {}, extensions: {} };
    let records = [];
    let contextText = '';
    if (previous?.worldbookName) {
      try {
        const oldBook = await this.host.loadWorldbook(previous.worldbookName);
        const owned = entriesOf(oldBook).filter((entry) => managed(entry, previous.chatKey || chatKey));
        const archive = owned.find((entry) => entry.comment === ARCHIVE_COMMENT);
        const contextEntry = owned.find((entry) => entry.comment === CONTEXT_COMMENT);
        const parsed = parseJson(String(archive?.content || '').match(/\{[\s\S]*\}/)?.[0] || '');
        records = boundedRoleRecords(parsed);
        contextText = String(contextEntry?.content || '');
      } catch {}
    }
    targetBook = replaceManagedEntries(targetBook, chatKey, records, contextText);
    await this.host.saveWorldbook(targetName, targetBook);
    const verify = await this.host.loadWorldbook(targetName);
    if (entriesOf(verify).filter((entry) => managed(entry, chatKey)).length !== 2) throw new Error('目标世界书写后校验失败，未更改绑定。');
    const previousChatWorldbook = this.host.getChatWorldbookName?.() || '';
    if (mode === 'character') {
      if (previous?.mode !== 'character' && previousChatWorldbook === previous?.worldbookName) await this.host.bindChatWorldbook?.('');
    } else {
      await this.host.bindChatWorldbook?.(targetName);
    }
    await this.store.update((state) => {
      state.custom[BINDING_KEY] = { schemaVersion: 1, chatKey, mode: mode === 'character' ? 'character' : 'dedicated', worldbookName: targetName, prompted: true, previousChatWorldbook: previous?.previousChatWorldbook || previousChatWorldbook, lastSyncedMessageId: previous?.lastSyncedMessageId || '' };
      return state;
    }, 'archive-worldbook-bind');
    if (previous?.worldbookName && previous.worldbookName !== targetName) {
      const oldBook = await this.host.loadWorldbook(previous.worldbookName);
      await this.host.saveWorldbook(previous.worldbookName, removeManagedEntries(oldBook, previous.chatKey || chatKey));
    }
    return this.getBinding();
  }

  async syncLatestReply({ knownRoles = [] } = {}) {
    if (this.syncing) return this.syncing;
    this.syncing = this.#syncLatestReply({ knownRoles }).finally(() => { this.syncing = null; });
    return this.syncing;
  }

  async #syncLatestReply({ knownRoles }) {
    const binding = this.getBinding();
    if (!binding) return { ok: false, reason: 'not-bound' };
    const message = latestAssistantMessage(this.host);
    if (!message) return { ok: false, reason: 'no-assistant-reply' };
    const messageId = String(message.message_id ?? '');
    if (messageId && messageId === String(binding.lastSyncedMessageId || '')) return { ok: true, skipped: true };
    const book = await this.host.loadWorldbook(binding.worldbookName);
    const existingArchive = entriesOf(book).find((entry) => managed(entry, binding.chatKey) && entry.comment === ARCHIVE_COMMENT);
    const existingRecords = boundedRoleRecords(parseJson(String(existingArchive?.content || '').match(/\{[\s\S]*\}/)?.[0] || ''));
    const sourceBooks = [book];
    try {
      const characterBooks = await this.host.getCharacterWorldbookNames();
      for (const name of [characterBooks?.primary, ...(characterBooks?.additional || [])].map(String).filter((name) => name && name !== binding.worldbookName && !name.startsWith('__hypnoos_embedded__:')).slice(0, 3)) {
        try { sourceBooks.push(await this.host.loadWorldbook(name)); } catch {}
      }
    } catch {}
    const sourceExcerpt = sourceBooks.flatMap((source) => entriesOf(source)).filter((entry) => !managed(entry, binding.chatKey)).slice(0, 40)
      .map((entry) => `${String(entry.comment || '').slice(0, 120)}\n${String(entry.content || '').slice(0, 800)}`).join('\n\n').slice(0, 16000);
    const stateRoles = Object.values(this.store.state.roles || {}).map((role) => ({ name: role.name, variables: role.variables }));
    const prompt = [
      '根据最新AI回复更新当前对话的人物档案。回复正文是本轮变化的主要依据；世界书只用于识别人物和稳定设定，不能把设定误写成本轮已发生事实。',
      '没有MVU变量也必须根据回复更新。若有结构化变量，只用于校正明确字段。不要猜测正文没有说明的状态。',
      `已知角色：${[...new Set([...knownRoles.map(String), ...stateRoles.map((role) => role.name)].filter(Boolean))].join('、') || '请从世界书和回复识别'}`,
      `结构化角色补充：${stableStringify(stateRoles).slice(0, 10000)}`,
      `已有持续档案：${stableStringify(existingRecords).slice(0, 12000)}`,
      `世界书摘要：\n${sourceExcerpt}`,
      `最新AI回复：\n${String(message.message || '').slice(0, 18000)}`,
      '只返回本轮出现变化的人物JSON：{"roles":[{"name":"姓名","gender":"性别，不确定则空字符串","currentState":"当前身心及动作状态","clothing":"当前衣着","location":"当前位置","relationship":"与玩家及重要人物关系变化","hypnosis":"已明确生效的催眠状态、扳机和效果","importantFacts":["本轮新增且未来需要记住的事实"]}]}',
    ].join('\n\n');
    const raw = await this.host.generateRaw({ prompt, responseLength: 5000 });
    const updates = boundedRoleRecords(parseJson(raw));
    const merged = new Map(existingRecords.map((record) => [record.name, record]));
    for (const update of updates) {
      const previous = merged.get(update.name) || {};
      merged.set(update.name, {
        ...previous,
        ...Object.fromEntries(Object.entries(update).filter(([, value]) => Array.isArray(value) ? value.length : String(value || '').trim())),
        importantFacts: [...new Set([...(previous.importantFacts || []), ...(update.importantFacts || [])])].slice(-12),
      });
    }
    const records = [...merged.values()].slice(0, 80);
    const contextText = `最近同步楼层：${messageId}\n最近AI回复摘要：${String(message.message || '').replace(/\s+/g, ' ').slice(0, 1800)}\n当前催眠运行状态：${stableStringify(this.store.state.hypnosis || {}).slice(0, 2400)}`;
    await this.host.saveWorldbook(binding.worldbookName, replaceManagedEntries(book, binding.chatKey, records, contextText));
    await this.store.update((state) => {
      if (state.custom[BINDING_KEY]?.worldbookName === binding.worldbookName) {
        state.custom[BINDING_KEY].lastSyncedMessageId = messageId;
        state.custom[BINDING_KEY].lastSyncedAt = new Date().toISOString();
        state.custom[BINDING_KEY].lastRoleCount = records.length;
      }
      return state;
    }, 'archive-worldbook-sync');
    return { ok: true, worldbookName: binding.worldbookName, roleCount: records.length };
  }
}

export const ARCHIVE_WORLDBOOK_OWNER = OWNER;
