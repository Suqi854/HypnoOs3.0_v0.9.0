import { createDefaultState, fromLegacyVariables, makeOperation, normalizeState, toLegacyVariables } from './contracts.js';
import { buildHypnosisRulePrompt, DEFAULT_HYPNOSIS_RULESET_VERSION } from './hypnosis-rules.js';
import { findLegacyVariables, mergeLegacyVariables, migrateStateCompatibility } from './legacy-adapter.js';
import { getRegionPack } from './regions.js';
import { clone, stableStringify } from './utils.js';

export class StateStore extends EventTarget {
  #host;
  #storage;
  #settings;
  #state;

  constructor(host, storage) {
    super();
    this.#host = host;
    this.#storage = storage;
  }

  get state() { return clone(this.#state); }
  get settings() { return clone(this.#settings); }

  async initialize() {
    this.#settings = await this.#storage.getSettings();
    const region = getRegionPack(this.#settings.region);
    const saved = this.#host.loadChatState();
    let initial = saved || createDefaultState(region);
    if (!saved && typeof this.#host.readOptionalRuntimeState === 'function') {
      const snapshots = await this.#host.readOptionalRuntimeState();
      const legacy = snapshots.map((snapshot) => findLegacyVariables(snapshot?.value ?? snapshot)).find(Boolean);
      if (legacy) initial = fromLegacyVariables(legacy, initial, region);
    }
    this.#state = normalizeState(migrateStateCompatibility(initial), region);
    await this.#persist(false);
    return this.state;
  }

  async update(mutator, reason = 'update') {
    const draft = clone(this.#state);
    const candidate = await mutator(draft);
    const region = getRegionPack(candidate?.region || draft.region || this.#settings.region);
    const next = normalizeState(migrateStateCompatibility(candidate || draft), region);
    next.revision = this.#state.revision + 1;
    this.#state = next;
    await this.#persist(true, reason);
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
    const snapshots = await this.#host.readOptionalRuntimeState();
    const legacy = snapshots.map((snapshot) => findLegacyVariables(snapshot?.value ?? snapshot)).find(Boolean);
    if (!legacy) return this.state;
    const merged = mergeLegacyVariables(toLegacyVariables(this.#state), legacy);
    const pack = getRegionPack(this.#state.region);
    const next = fromLegacyVariables(merged, this.#state, pack);
    if (stableStringify(toLegacyVariables(next)) === stableStringify(toLegacyVariables(this.#state))) return this.state;
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

  async #persist(broadcast = true, reason = 'initialize') {
    await this.#host.saveChatState(this.#state);
    this.#host.setPromptText(this.buildPromptProjection());
    await this.#host.writeOptionalRuntimeState(toLegacyVariables(this.#state), this.#settings);
    if (broadcast) this.dispatchEvent(new CustomEvent('change', { detail: { state: this.state, reason } }));
  }
}
