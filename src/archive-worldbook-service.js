import { clone, isRecord, stableStringify } from './utils.js';
import { buildHypnosisRulePrompt, DEFAULT_HYPNOSIS_RULESET_VERSION } from './hypnosis-rules.js';

const OWNER = 'hypnoos3-archive';
const RULES_OWNER = 'hypnoos3-hypnosis-rules';
const BINDING_KEY = 'archiveWorldbookBinding';
const RULES_COMMENT = '[HypnoOS内置]催眠规则';
const ARCHIVE_COMMENT = '[HypnoOS档案]人物状态';
const CONTEXT_COMMENT = '[HypnoOS档案]剧情与催眠上下文';
const CONTEXT_RULE_BODY = '催眠手机下达的操作必须结合当前人物关系、地点、已发生剧情与既有催眠效果自然执行。不得突然跳出故事解释系统，不得把未执行的指令写成已生效事实。';

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

function archiveKind(entry) {
  const comment = String(entry?.comment || '');
  const content = String(entry?.content || '');
  const owned = entry?.extensions?.hypnoosArchive?.owner === OWNER;
  if (comment === ARCHIVE_COMMENT && (owned || content.includes('<HypnoOS人物档案存储>'))) return 'archive';
  if (comment === CONTEXT_COMMENT && (owned || content.includes('<HypnoOS剧情融合规则>'))) return 'context';
  return '';
}

function managedArchive(entry) {
  return Boolean(archiveKind(entry));
}

function managedRules(entry) {
  const comment = String(entry?.comment || '');
  const content = String(entry?.content || '');
  return entry?.extensions?.hypnoosRules?.owner === RULES_OWNER
    || comment === RULES_COMMENT
    || content.includes('<HypnoOS催眠规则');
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

function refreshManagedEntry(entry, comment, content, chatKey, constant) {
  const fresh = makeEntry(Number(entry?.uid ?? entry?.id ?? 0) || 0, comment, content, chatKey, constant);
  return {
    ...clone(entry || {}),
    ...fresh,
    extensions: {
      ...clone(entry?.extensions || {}),
      ...fresh.extensions,
    },
  };
}

function makeRulesEntry(uid) {
  const entry = makeEntry(uid, RULES_COMMENT, buildHypnosisRulePrompt(), '', true);
  entry.key = ['HypnoOS', '催眠手机', '催眠规则'];
  entry.order = 17;
  entry.ignoreBudget = true;
  entry.excludeRecursion = true;
  entry.preventRecursion = true;
  entry.useProbability = false;
  delete entry.extensions.hypnoosArchive;
  entry.extensions.hypnoosRules = {
    owner: RULES_OWNER,
    schemaVersion: 1,
    rulesetVersion: DEFAULT_HYPNOSIS_RULESET_VERSION,
  };
  return entry;
}

function replaceRulesEntry(book) {
  const mapped = entryMap(book);
  const all = entriesOf(mapped.source);
  const existing = all.find(managedRules);
  const current = all.filter((entry) => !managedRules(entry));
  const next = [...current, makeRulesEntry(existing?.uid ?? existing?.id ?? nextUid(all))];
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function managedSnapshot(book, chatKey = '') {
  const entries = entriesOf(book);
  const prefer = (kind) => entries.find((entry) => archiveKind(entry) === kind && managed(entry, chatKey))
    || entries.find((entry) => archiveKind(entry) === kind)
    || null;
  const archive = prefer('archive');
  const context = prefer('context');
  return {
    archive,
    context,
    records: extractArchiveRecords(archive?.content),
    contextText: extractContextText(context?.content),
  };
}

function extractContextText(content) {
  const source = String(content || '');
  const parts = source.split('<HypnoOS剧情融合规则>');
  const selected = String(parts.at(-1) || source).split('</HypnoOS剧情融合规则>')[0].trim();
  return (selected.startsWith(CONTEXT_RULE_BODY) ? selected.slice(CONTEXT_RULE_BODY.length).trim() : selected).slice(0, 6000);
}

function extractArchiveRecords(content) {
  const source = String(content || '');
  const parts = source.split('<HypnoOS人物档案存储>');
  const selected = String(parts.at(-1) || source).split('</HypnoOS人物档案存储>')[0];
  return boundedRoleRecords(parseJson(selected));
}

function ensureManagedEntries(book, chatKey, records, contextText) {
  const mapped = entryMap(book);
  const snapshot = managedSnapshot(mapped.source, chatKey);
  const all = entriesOf(mapped.source);
  const existingRules = all.find(managedRules);
  const current = all.filter((entry) => !managedArchive(entry) && !managedRules(entry));
  let uid = nextUid(all);
  const archive = snapshot.archive
    ? refreshManagedEntry(snapshot.archive, ARCHIVE_COMMENT, String(snapshot.archive.content || '').split('<HypnoOS人物档案存储>').length > 2 ? buildArchiveContent(snapshot.records) : snapshot.archive.content, chatKey, false)
    : makeEntry(uid++, ARCHIVE_COMMENT, buildArchiveContent(records), chatKey, false);
  const context = snapshot.context
    ? refreshManagedEntry(snapshot.context, CONTEXT_COMMENT, buildContextContent(snapshot.contextText), chatKey, true)
    : makeEntry(uid++, CONTEXT_COMMENT, buildContextContent(contextText), chatKey, true);
  const next = [...current, makeRulesEntry(existingRules?.uid ?? existingRules?.id ?? uid++), archive, context];
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function removeRulesEntry(book) {
  const mapped = entryMap(book);
  const next = entriesOf(mapped.source).filter((entry) => !managedRules(entry));
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function buildArchiveContent(records) {
  return [
    '<HypnoOS人物档案存储>',
    '以下是当前对话的持续档案快照。只把剧情中已经明确发生的事实视为有效，不得把未知项自行补全。',
    stableStringify({ updatedAt: new Date().toISOString(), roles: records }),
    '</HypnoOS人物档案存储>',
  ].join('\n');
}

function buildContextContent(contextText) {
  return [
    '<HypnoOS剧情融合规则>',
    CONTEXT_RULE_BODY,
    extractContextText(contextText),
    '</HypnoOS剧情融合规则>',
  ].filter(Boolean).join('\n');
}

function replaceManagedEntries(book, chatKey, records, contextText) {
  const mapped = entryMap(book);
  const snapshot = managedSnapshot(mapped.source, chatKey);
  const all = entriesOf(mapped.source);
  const existingRules = all.find(managedRules);
  const current = all.filter((entry) => !managedArchive(entry) && !managedRules(entry));
  let uid = nextUid(all);
  const archiveContent = buildArchiveContent(records);
  const contextContent = buildContextContent(contextText);
  const next = [
    ...current,
    makeRulesEntry(existingRules?.uid ?? existingRules?.id ?? uid++),
    snapshot.archive ? refreshManagedEntry(snapshot.archive, ARCHIVE_COMMENT, archiveContent, chatKey, false) : makeEntry(uid++, ARCHIVE_COMMENT, archiveContent, chatKey, false),
    snapshot.context ? refreshManagedEntry(snapshot.context, CONTEXT_COMMENT, contextContent, chatKey, true) : makeEntry(uid++, CONTEXT_COMMENT, contextContent, chatKey, true),
  ];
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function normalizeActiveEntries(book, chatKey) {
  const mapped = entryMap(book);
  const all = entriesOf(mapped.source);
  const snapshot = managedSnapshot(mapped.source, chatKey);
  const existingRules = all.find(managedRules);
  const current = all.filter((entry) => !managedArchive(entry) && !managedRules(entry));
  let uid = nextUid(all);
  const next = [
    ...current,
    makeRulesEntry(existingRules?.uid ?? existingRules?.id ?? uid++),
  ];
  if (snapshot.archive) next.push(refreshManagedEntry(snapshot.archive, ARCHIVE_COMMENT, snapshot.archive.content, chatKey, false));
  if (snapshot.context) next.push(refreshManagedEntry(snapshot.context, CONTEXT_COMMENT, buildContextContent(snapshot.contextText), chatKey, true));
  if (mapped.array) mapped.source.entries = next;
  else mapped.source.entries = Object.fromEntries(next.map((entry, index) => [String(entry.uid ?? index), entry]));
  return mapped.source;
}

function removeManagedEntries(book, chatKey) {
  const mapped = entryMap(book);
  const next = entriesOf(mapped.source).filter((entry) => !managedArchive(entry));
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
    this.activeRulesBinding = null;
    this.worldbookWrites = new Map();
  }

  async saveCheckedWorldbook(name, updater, initialBook = null) {
    const worldbookName = String(name || '').trim();
    const previous = this.worldbookWrites.get(worldbookName) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
      let current;
      try {
        current = await this.host.loadWorldbook(worldbookName);
      } catch (error) {
        if (initialBook === null) throw error;
        current = clone(initialBook);
      }
      const next = await updater(clone(current));
      if (stableStringify(next) === stableStringify(current)) return current;
      await this.host.saveWorldbook(worldbookName, next);
      return next;
    });
    this.worldbookWrites.set(worldbookName, operation);
    try {
      return await operation;
    } finally {
      if (this.worldbookWrites.get(worldbookName) === operation) this.worldbookWrites.delete(worldbookName);
    }
  }

  getBinding() {
    return bindingFromState(this.store.state);
  }

  async removeRulesFromOtherWorldbooks(activeWorldbookName) {
    const activeName = String(activeWorldbookName || '').trim();
    const names = await Promise.resolve(this.host.getWorldbookNames()) || [];
    for (const name of [...new Set(names.map(String).filter((item) => item && item !== activeName))]) {
      try {
        const book = await this.host.loadWorldbook(name);
        if (!entriesOf(book).some(managedRules)) continue;
        await this.saveCheckedWorldbook(name, removeRulesEntry);
      } catch {}
    }
  }

  async options() {
    const names = await Promise.resolve(this.host.getWorldbookNames()) || [];
    const character = await this.host.getCharacterWorldbookNames();
    const binding = this.getBinding();
    let records = [];
    if (binding?.worldbookName) {
      try {
        const book = await this.host.loadWorldbook(binding.worldbookName);
        records = managedSnapshot(book, binding.chatKey).records;
      } catch {}
    }
    return { names: [...new Set(names.map(String).filter(Boolean))], character, binding, records };
  }

  async configure({ mode, worldbookName = '', createOnly = false } = {}) {
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
    if (createOnly && names.includes(targetName)) throw new Error(`世界书“${targetName}”已存在，请输入新名称。`);
    let targetBook = names.includes(targetName) ? await this.host.loadWorldbook(targetName) : { entries: {}, extensions: {} };
    const targetSnapshot = managedSnapshot(targetBook, chatKey);
    let records = targetSnapshot.records;
    let contextText = targetSnapshot.contextText;
    if (previous?.worldbookName) {
      try {
        const oldBook = await this.host.loadWorldbook(previous.worldbookName);
        const oldSnapshot = managedSnapshot(oldBook, previous.chatKey || chatKey);
        if (!targetSnapshot.archive) records = oldSnapshot.records;
        if (!targetSnapshot.context) contextText = oldSnapshot.contextText;
      } catch {}
    }
    targetBook = await this.saveCheckedWorldbook(
      targetName,
      (current) => ensureManagedEntries(current, chatKey, records, contextText),
      targetBook,
    );
    await this.removeRulesFromOtherWorldbooks(targetName);
    const verify = await this.host.loadWorldbook(targetName);
    const verifyArchives = entriesOf(verify).filter(managedArchive);
    if (verifyArchives.filter((entry) => archiveKind(entry) === 'archive').length !== 1 || verifyArchives.filter((entry) => archiveKind(entry) === 'context').length !== 1) throw new Error('目标世界书写后校验失败，未更改绑定。');
    const ruleEntries = entriesOf(verify).filter(managedRules);
    if (ruleEntries.length !== 1 || ruleEntries[0].comment !== RULES_COMMENT || ruleEntries[0].content !== buildHypnosisRulePrompt()) throw new Error('目标世界书催眠规则写后校验失败，未更改绑定。');
    const previousChatWorldbook = this.host.getChatWorldbookName?.() || '';
    if (mode === 'character') {
      if (previous?.mode !== 'character' && previousChatWorldbook === previous?.worldbookName) await this.host.bindChatWorldbook?.('');
    } else {
      await this.host.bindChatWorldbook?.(targetName);
    }
    await this.store.update((state) => {
      state.custom[BINDING_KEY] = { schemaVersion: 1, chatKey, mode: mode === 'character' ? 'character' : 'dedicated', worldbookName: targetName, prompted: true, rulesetVersion: DEFAULT_HYPNOSIS_RULESET_VERSION, previousChatWorldbook: previous?.previousChatWorldbook || previousChatWorldbook, lastSyncedMessageId: previous?.lastSyncedMessageId || '' };
      return state;
    }, 'archive-worldbook-bind');
    this.activeRulesBinding = { worldbookName: targetName };
    if (previous?.worldbookName && previous.worldbookName !== targetName) {
      await this.saveCheckedWorldbook(
        previous.worldbookName,
        (oldBook) => removeRulesEntry(removeManagedEntries(oldBook, previous.chatKey || chatKey)),
      );
    }
    return this.getBinding();
  }

  async activateRules() {
    const binding = this.getBinding();
    if (!binding?.worldbookName) {
      this.activeRulesBinding = null;
      return { ok: false, reason: 'not-bound' };
    }
    await this.removeRulesFromOtherWorldbooks(binding.worldbookName);
    await this.saveCheckedWorldbook(binding.worldbookName, (book) => normalizeActiveEntries(book, binding.chatKey));
    const verify = await this.host.loadWorldbook(binding.worldbookName);
    const rules = entriesOf(verify).filter(managedRules);
    if (rules.length !== 1 || rules[0].content !== buildHypnosisRulePrompt()) throw new Error('进入聊天时加载内置催眠规则失败。');
    this.activeRulesBinding = { worldbookName: binding.worldbookName };
    return { ok: true, worldbookName: binding.worldbookName };
  }

  async deactivateRules() {
    const binding = this.activeRulesBinding || this.getBinding();
    this.activeRulesBinding = null;
    if (!binding?.worldbookName) return { ok: false, reason: 'not-bound' };
    await this.saveCheckedWorldbook(binding.worldbookName, removeRulesEntry);
    const verify = await this.host.loadWorldbook(binding.worldbookName);
    if (entriesOf(verify).some(managedRules)) throw new Error('退出聊天时删除内置催眠规则失败。');
    return { ok: true, worldbookName: binding.worldbookName };
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
    const existingRecords = managedSnapshot(book, binding.chatKey).records;
    const sourceBooks = [book];
    try {
      const characterBooks = await this.host.getCharacterWorldbookNames();
      for (const name of [characterBooks?.primary, ...(characterBooks?.additional || [])].map(String).filter((name) => name && name !== binding.worldbookName && !name.startsWith('__hypnoos_embedded__:')).slice(0, 3)) {
        try { sourceBooks.push(await this.host.loadWorldbook(name)); } catch {}
      }
    } catch {}
    const sourceExcerpt = sourceBooks.flatMap((source) => entriesOf(source)).filter((entry) => !managedArchive(entry) && !managedRules(entry)).slice(0, 40)
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
    await this.saveCheckedWorldbook(
      binding.worldbookName,
      (current) => replaceManagedEntries(current, binding.chatKey, records, contextText),
    );
    await this.store.update((state) => {
      if (state.custom[BINDING_KEY]?.worldbookName === binding.worldbookName) {
        state.custom[BINDING_KEY].lastSyncedMessageId = messageId;
        state.custom[BINDING_KEY].lastSyncedAt = new Date().toISOString();
        state.custom[BINDING_KEY].lastRoleCount = records.length;
        state.custom[BINDING_KEY].rulesetVersion = DEFAULT_HYPNOSIS_RULESET_VERSION;
      }
      return state;
    }, 'archive-worldbook-sync');
    return { ok: true, worldbookName: binding.worldbookName, roleCount: records.length };
  }
}

export const ARCHIVE_WORLDBOOK_OWNER = OWNER;
