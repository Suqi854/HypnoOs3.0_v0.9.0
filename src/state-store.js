import { createDefaultState, makeOperation, normalizeState } from './contracts.js';
import { buildHypnosisRulePrompt, DEFAULT_HYPNOSIS_RULESET_VERSION } from './hypnosis-rules.js';
import { findLegacyVariables, fromLegacyVariables, mergeLegacyVariables, migrateStateCompatibility, toLegacyVariables } from './legacy-adapter.js?revision=database-profile-v3';
import { getRegionPack } from './regions.js';
import { clone, stableStringify } from './utils.js';
import { projectDatabaseSnapshot } from './database-adapter.js?revision=database-profile-v3';

export function mergeDatabaseSnapshotIntoState(current, rawSnapshot, regionPack) {
  const projection = projectDatabaseSnapshot(rawSnapshot);
  if (!projection.snapshot.available) return current;
  const base = clone(current);
  const sheetRows = new Map(projection.metadata.sheets.map((sheet) => [sheet.name, sheet.rowCount]));
  const hasRows = (name) => Number(sheetRows.get(name) || 0) > 0;
  if (hasRows('重要人物表')) {
    base.roles = Object.fromEntries(Object.entries(base.roles || {}).filter(([, role]) => role?.variables?.extensions?.数据来源 !== '数据库'));
  }
  if (hasRows('任务与事件表')) {
    base.tasks = (base.tasks || []).filter((task) => task?.数据来源 !== '数据库');
  }
  const legacy = toLegacyVariables(base);
  if (hasRows('重要人物表')) {
    legacy.角色 = Object.fromEntries(Object.entries(legacy.角色 || {}).filter(([, role]) => role?.自定义?.数据来源 !== '数据库'));
  }
  if (hasRows('任务与事件表')) {
    legacy.任务 = Object.fromEntries(Object.entries(legacy.任务 || {}).filter(([, task]) => task?.数据来源 !== '数据库'));
  }
  if (hasRows('背包物品表')) legacy.系统.持有物品 = projection.legacy.系统.持有物品 || {};
  const merged = mergeLegacyVariables(legacy, projection.legacy);
  const next = fromLegacyVariables(merged, base, regionPack);
  const databaseAppData = clone(base.custom?.databaseAppData || {});
  if (hasRows('主角技能表')) databaseAppData.skills = clone(projection.legacy.系统.主角技能 || []);
  if (hasRows('总结表')) databaseAppData.summaries = clone(projection.legacy.系统._数据库总结 || []);
  if (hasRows('总体大纲')) databaseAppData.outline = clone(projection.legacy.系统._数据库总体大纲 || []);
  if (Object.keys(databaseAppData).length) next.custom.databaseAppData = databaseAppData;
  next.custom.databaseSource = projection.metadata;
  return next;
}

export class StateStore extends EventTarget {
  #host;
  #storage;
  #settings;
  #state;
  #contextKey = '';
  #optionalRuntimeBaselineMessageId = '';
  #optionalRuntimeAwaitingNewMessage = false;

  constructor(host, storage) {
    super();
    this.#host = host;
    this.#storage = storage;
  }

  get state() { return clone(this.#state); }
  get settings() { return clone(this.#settings); }

  async initialize() {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const contextKey = this.#currentContextKey();
      const settings = await this.#storage.getSettings();
      if (contextKey !== this.#currentContextKey()) continue;
      const region = getRegionPack(settings.region);
      const hostSaved = this.#host.loadChatState();
      const mirrored = typeof this.#storage.getChatState === 'function' ? await this.#storage.getChatState(contextKey) : null;
      if (contextKey !== this.#currentContextKey()) continue;
      const saved = preferNewestState(hostSaved, mirrored);
      let initial = saved || createDefaultState(region);
      if (!saved && typeof this.#host.readOptionalRuntimeState === 'function') {
        const snapshots = await this.#host.readOptionalRuntimeState();
        if (contextKey !== this.#currentContextKey()) continue;
        const legacy = snapshots.map((snapshot) => findLegacyVariables(snapshot?.value ?? snapshot)).find(Boolean);
        if (legacy) initial = fromLegacyVariables(legacy, initial, region);
      }
      if (typeof this.#host.readDatabaseSnapshot === 'function') {
        const database = await this.#host.readDatabaseSnapshot();
        if (contextKey !== this.#currentContextKey()) continue;
        if (database) initial = mergeDatabaseSnapshotIntoState(initial, database, region);
      }
      this.#settings = settings;
      this.#state = normalizeState(migrateStateCompatibility(initial), region);
      this.#contextKey = contextKey;
      if (await this.#persist(false, 'initialize', contextKey)) {
        this.#optionalRuntimeBaselineMessageId = String(this.#host.latestMessageId?.() ?? '');
        this.#optionalRuntimeAwaitingNewMessage = Boolean(saved);
        this.dispatchEvent(new CustomEvent('change', { detail: { state: this.state, reason: 'initialize' } }));
        return this.state;
      }
    }
    throw new Error('聊天切换尚未稳定，HypnoOS 状态未写入。');
  }

  async update(mutator, reason = 'update') {
    const contextKey = this.#contextKey || this.#currentContextKey();
    if (contextKey !== this.#currentContextKey()) return this.state;
    const draft = clone(this.#state);
    const candidate = await mutator(draft);
    if (contextKey !== this.#currentContextKey()) return this.state;
    const region = getRegionPack(candidate?.region || draft.region || this.#settings.region);
    const next = normalizeState(migrateStateCompatibility(candidate || draft), region);
    next.revision = this.#state.revision + 1;
    this.#state = next;
    if (!await this.#persist(true, reason, contextKey)) return this.state;
    return this.state;
  }

  async replace(next, reason = 'replace') {
    return this.update(() => next, reason);
  }

  async setRegion(regionId) {
    const pack = getRegionPack(regionId);
    this.#settings.region = pack.id;
    await this.#storage.saveSettings(this.#settings);
    return this.update((state) => ({ ...createDefaultState(pack), roles: state.roles, operationQueue: state.operationQueue, custom: state.custom }), 'region-change');
  }

  async saveSettings(next) {
    this.#settings = { ...this.#settings, ...clone(next), directApi: { ...this.#settings.directApi, ...(next.directApi || {}) } };
    await this.#storage.saveSettings(this.#settings);
    this.dispatchEvent(new CustomEvent('settings', { detail: this.settings }));
    return this.settings;
  }

  async addRole(role) {
    await this.#storage.set('characters', role.id, role);
    return this.update((state) => {
      state.roles[role.id] = role;
      return state;
    }, 'role-add');
  }

  async removeRole(roleId) {
    await this.#storage.delete('characters', roleId);
    return this.update((state) => {
      delete state.roles[roleId];
      return state;
    }, 'role-remove');
  }

  async importLegacyVariables(variables) {
    const pack = getRegionPack(this.#state.region);
    return this.replace(fromLegacyVariables(variables, this.#state, pack), 'legacy-bridge');
  }

  async syncOptionalRuntimeState(reason = 'runtime-adapter') {
    if (typeof this.#host.readOptionalRuntimeState !== 'function') return this.state;
    const runtimeReason = String(reason || 'runtime-adapter');
    if (this.#optionalRuntimeAwaitingNewMessage) {
      if (!/^runtime-message-(?:received|updated)$/u.test(runtimeReason)) {
        if (/^runtime-(?:initialized|variable-update)$/u.test(runtimeReason)) return this.state;
      } else {
        this.#optionalRuntimeAwaitingNewMessage = false;
      }
    }
    const latestMessageId = String(this.#host.latestMessageId?.() ?? '');
    if (/^runtime-(?:initialized|variable-update)$/u.test(runtimeReason) && latestMessageId && latestMessageId === this.#optionalRuntimeBaselineMessageId) return this.state;
    const snapshots = await this.#host.readOptionalRuntimeState();
    const legacy = snapshots.map((snapshot) => findLegacyVariables(snapshot?.value ?? snapshot)).find(Boolean);
    if (!legacy) return this.state;
    const merged = mergeLegacyVariables(toLegacyVariables(this.#state), legacy);
    const pack = getRegionPack(this.#state.region);
    const next = fromLegacyVariables(merged, this.#state, pack);
    if (stableStringify(toLegacyVariables(next)) === stableStringify(toLegacyVariables(this.#state))) return this.state;
    const replaced = await this.replace(next, runtimeReason);
    this.#optionalRuntimeBaselineMessageId = latestMessageId;
    return replaced;
  }

  async syncDatabaseRuntimeState(reason = 'database-adapter', providedSnapshot = null) {
    if (!providedSnapshot && typeof this.#host.readDatabaseSnapshot !== 'function') return this.state;
    const contextKey = this.#contextKey || this.#currentContextKey();
    const database = providedSnapshot || await this.#host.readDatabaseSnapshot();
    if (contextKey !== this.#currentContextKey()) return this.state;
    if (!database) return this.state;
    const pack = getRegionPack(this.#state.region);
    const next = mergeDatabaseSnapshotIntoState(this.#state, database, pack);
    next.revision = this.#state.revision;
    if (stableStringify(next) === stableStringify(this.#state)) return this.state;
    return this.replace(next, reason);
  }

  async queueOperation(input) {
    const operation = makeOperation(input);
    await this.update((state) => {
      state.operationQueue.push(operation);
      return state;
    }, 'operation-add');
    return operation;
  }

  async editOperation(id, patch) {
    return this.update((state) => {
      const index = state.operationQueue.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('暂存操作不存在');
      state.operationQueue[index] = makeOperation({ ...state.operationQueue[index], ...patch, id });
      return state;
    }, 'operation-edit');
  }

  async moveOperation(id, offset) {
    return this.update((state) => {
      const index = state.operationQueue.findIndex((item) => item.id === id);
      const target = Math.max(0, Math.min(state.operationQueue.length - 1, index + Number(offset)));
      if (index >= 0 && target !== index) state.operationQueue.splice(target, 0, state.operationQueue.splice(index, 1)[0]);
      return state;
    }, 'operation-move');
  }

  async removeOperation(id) {
    return this.update((state) => {
      const target = state.operationQueue.find((item) => item.id === id);
      if (target?.locked) throw new Error('该操作已锁定，不能删除');
      state.operationQueue = state.operationQueue.filter((item) => item.id !== id);
      return state;
    }, 'operation-remove');
  }

  async clearOperations({ force = false } = {}) {
    return this.update((state) => {
      state.operationQueue = force ? [] : state.operationQueue.filter((item) => item.locked);
      return state;
    }, 'operation-clear');
  }

  buildOperationBlock() {
    const queue = this.#state.operationQueue;
    if (!queue.length) return '';
    const lines = queue.map((item, index) => `${index + 1}. [${item.sourceApp}] ${item.command}${item.note ? `｜${item.note}` : ''}`);
    return `<本轮操作>\n${lines.join('\n')}\n</本轮操作>`;
  }

  buildPromptProjection() {
    const state = this.#state;
    const roles = Object.values(state.roles).map((role) => ({ id: role.id, name: role.name, variables: role.variables }));
    const rulesStoredInBoundWorldbook = state.custom?.archiveWorldbookBinding?.rulesetVersion === DEFAULT_HYPNOSIS_RULESET_VERSION;
    return [
      rulesStoredInBoundWorldbook ? '' : buildHypnosisRulePrompt(),
      '[HypnoOS3 当前状态；仅在剧情相关时使用]',
      JSON.stringify({ time: state.time, location: state.location.current, resources: state.resources, roles, tasks: state.tasks, activeEffects: state.hypnosis.activeEffects }),
    ].filter(Boolean).join('\n');
  }

  #currentContextKey() {
    return String(this.#host.contextKey?.() || 'preview');
  }

  async #persist(broadcast = true, reason = 'initialize', expectedContextKey = this.#contextKey) {
    if (expectedContextKey !== this.#currentContextKey()) return false;
    if (!await this.#host.saveChatState(this.#state, expectedContextKey)) return false;
    if (typeof this.#storage.saveChatState === 'function') await this.#storage.saveChatState(expectedContextKey, this.#state);
    if (expectedContextKey !== this.#currentContextKey()) return false;
    this.#host.setPromptText(this.buildPromptProjection());
    await this.#host.writeOptionalRuntimeState(toLegacyVariables(this.#state), this.#settings);
    if (expectedContextKey !== this.#currentContextKey()) return false;
    if (broadcast) this.dispatchEvent(new CustomEvent('change', { detail: { state: this.state, reason } }));
    return true;
  }
}

function preferNewestState(hostSaved, mirrored) {
  if (!hostSaved) return mirrored;
  if (!mirrored) return hostSaved;
  const hostRevision = Number(hostSaved.revision) || 0;
  const mirrorRevision = Number(mirrored.revision) || 0;
  return mirrorRevision > hostRevision ? mirrored : hostSaved;
}
