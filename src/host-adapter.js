import { CHAT_STATE_KEY, EXTENSION_ID, PROMPT_ID } from './constants.js';
import { mergeLegacyVariables } from './legacy-adapter.js?revision=database-profile-v3';
import { clone } from './utils.js';

function findContext() {
  try { return globalThis.SillyTavern?.getContext?.() || null; } catch { return null; }
}

function sameOriginWindows() {
  const result = [];
  const pending = [globalThis];
  while (pending.length) {
    const view = pending.shift();
    if (!view || result.includes(view)) continue;
    try {
      if (!view.document) continue;
      if (view.__ST_HYPNOOS_FLOATING_PHONE__) continue;
      result.push(view);
      for (const frame of view.document.querySelectorAll('iframe')) {
        try { if (frame.contentWindow && !result.includes(frame.contentWindow)) pending.push(frame.contentWindow); } catch {}
      }
    } catch {}
  }
  return result;
}

function runtimeFunction(name) {
  for (const view of sameOriginWindows()) {
    try {
      if (typeof view[name] === 'function') return { view, fn: view[name] };
      if (typeof view.TavernHelper?.[name] === 'function') return { view: view.TavernHelper, fn: view.TavernHelper[name] };
    } catch {}
  }
  return null;
}

function runtimeMvu() {
  for (const view of sameOriginWindows()) {
    try {
      if (view.Mvu?.getMvuData && !view.__ST_HYPNOOS_FLOATING_PHONE__) return view.Mvu;
    } catch {}
  }
  return null;
}

function usableObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function messageVariableSnapshot(message) {
  if (!message || typeof message !== 'object') return null;
  const swipe = Math.max(0, Number(message.swipe_id ?? message.swipeId) || 0);
  const sources = [message.variables, message.mvu, message.stat_data, message.swipe_info?.[swipe]?.variables];
  for (let value of sources) {
    if (Array.isArray(value)) value = value[swipe] ?? value.at(-1);
    if (usableObject(value) && !value.stat_data && !value.系统 && !value.角色) {
      const selected = value[swipe] ?? value[String(swipe)];
      if (usableObject(selected)) value = selected;
    }
    if (usableObject(value)) return value === message.stat_data ? { stat_data: value } : value;
  }
  return null;
}

function visibleUserMessage(message) {
  if (!message || typeof message !== 'object') return false;
  if (message.is_system || message.hidden || message.is_hidden || message.internal || message.is_internal || message.deleted || message.is_deleted) return false;
  if (message.is_user === true || message.isUser === true || message.from_user === true) return true;
  return String(message.role || message.type || '').toLowerCase() === 'user';
}

function messageText(message) {
  const value = message?.mes ?? message?.message ?? message?.content ?? message?.text ?? message?.raw ?? '';
  return typeof value === 'string' ? value : String(value || '');
}

function runtimeDatabase() {
  for (const view of sameOriginWindows()) {
    try {
      const api = view.AutoCardUpdaterAPI;
      if (api && typeof api.exportTableAsJson === 'function') return api;
    } catch {}
  }
  return null;
}

export function extractLatestUserOperationBlock(chat) {
  const list = Array.isArray(chat) ? chat : [];
  const latest = [...list].reverse().find(visibleUserMessage);
  const text = messageText(latest);
  const matches = [...text.matchAll(/<(本轮操作|本轮APP操作)>([\s\S]*?)<\/\1>/g)];
  if (matches.length !== 1 || !String(matches[0][2] || '').trim()) return '';
  return `<本轮操作>${matches[0][2]}</本轮操作>`;
}

export function buildLatestOperationGate(chat) {
  const block = extractLatestUserOperationBlock(chat);
  if (!block) return '';
  return [
    '[HypnoOS本轮操作执行闸门｜只认最新真实用户消息]',
    '下方容器是本次回复唯一有效的前端操作队列，不是历史、背景或建议。先逐项列全并安排可见的执行过程、成功或失败及直接反应；处理完之前不得续写旧剧情。',
    '正文必须实际执行而不是复述；变量更新必须逐项遵守AI写/AI不动和完整催眠规则。全部完成后停在最后一项直接后果，不恢复旧剧情、不另开事件、不替用户决定下一步。',
    block,
  ].join('\n');
}

export class HostAdapter {
  #disposers = [];
  #promptText = '';

  get context() { return findContext(); }

  hasActiveChat() {
    const context = this.context;
    if (!context) return false;
    const chatId = String(context.chatId ?? '').trim();
    const characterId = context.characterId;
    const groupId = context.groupId;
    const hasCharacter = (characterId !== undefined && characterId !== null && String(characterId).trim() !== '' && String(characterId) !== '-1')
      || (groupId !== undefined && groupId !== null && String(groupId).trim() !== '' && String(groupId) !== '-1');
    const hasLoadedMessages = !Array.isArray(context.chat) || context.chat.length > 0;
    return Boolean(chatId && hasCharacter && hasLoadedMessages);
  }

  capabilities() {
    const context = this.context;
    return {
      host: Boolean(context),
      worldbook: Boolean(context?.loadWorldInfo && context?.saveWorldInfo && context?.getWorldInfoNames),
      generation: Boolean(context?.generateRaw),
      promptInjection: Boolean(context?.setExtensionPrompt && context?.eventSource && context?.eventTypes),
      tavernHelper: typeof globalThis.getVariables === 'function' && typeof globalThis.updateVariablesWith === 'function',
      mvu: Boolean(globalThis.Mvu?.getMvuData && globalThis.Mvu?.replaceMvuData),
      database: Boolean(runtimeDatabase()),
    };
  }

  contextKey() {
    const context = this.context;
    if (!context) return 'preview';
    return `${context.groupId ? 'group' : 'character'}:${context.groupId ?? context.characterId ?? 'none'}:${context.chatId ?? 'no-chat'}`;
  }

  characterScopeKey() {
    const id = this.context?.characterId;
    return id !== undefined && id !== null && String(id).trim() !== '' && String(id) !== '-1' ? `character:${id}` : '';
  }

  groupScopeKey() {
    const id = this.context?.groupId;
    return id !== undefined && id !== null && String(id).trim() !== '' && String(id) !== '-1' ? `group:${id}` : '';
  }

  characterKey() {
    const context = this.context;
    return context?.groupId ? `group:${context.groupId}` : `character:${context?.characterId ?? 'none'}`;
  }

  loadChatState() {
    return clone(this.context?.chatMetadata?.[CHAT_STATE_KEY] ?? null);
  }

  async saveChatState(state, expectedContextKey = '') {
    const context = this.context;
    if (!context) return false;
    if (expectedContextKey && this.contextKey() !== expectedContextKey) return false;
    context.chatMetadata[CHAT_STATE_KEY] = clone(state);
    if (typeof context.saveMetadata === 'function') await Promise.resolve(context.saveMetadata());
    else context.saveMetadataDebounced?.();
    return true;
  }

  getMessages() {
    const chat = this.context?.chat;
    if (!Array.isArray(chat)) return [{ message_id: 0, message: '<StatusPlaceHolderImpl />', is_user: false }];
    return chat.map((message, index) => ({
      message_id: index,
      message: String(message?.mes ?? message?.message ?? ''),
      is_user: Boolean(message?.is_user),
      name: String(message?.name ?? ''),
    }));
  }

  latestMessageId() {
    return Math.max(0, this.getMessages().length - 1);
  }

  setInput(text, { append = true } = {}) {
    const input = document.querySelector('#send_textarea, textarea[name="send_textarea"], #chat-input textarea');
    if (!input) return false;
    const incoming = String(text || '').trim();
    input.value = append && input.value.trim() ? `${input.value.trim()}\n\n${incoming}` : incoming;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.focus();
    return true;
  }

  async directSend(text) {
    if (!this.setInput(text, { append: false })) return false;
    const send = document.querySelector('#send_but');
    if (!send || send.disabled || send.getAttribute('aria-disabled') === 'true') return false;
    send.click();
    return true;
  }

  async generateRaw({ prompt, systemPrompt = '', jsonSchema = null, responseLength = 4096 }) {
    const generateRaw = this.context?.generateRaw;
    if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 未提供 generateRaw');
    return generateRaw({ prompt, systemPrompt, jsonSchema, responseLength, quietToLoud: false, trimNames: true });
  }

  getWorldbookNames() {
    return this.context?.getWorldInfoNames?.() || [];
  }

  async getCharacterWorldbookNames() {
    const helper = runtimeFunction('getCharWorldbookNames');
    if (helper) {
      try {
        const books = await Promise.resolve(helper.fn.call(helper.view, 'current'));
        if (Array.isArray(books) && books.length) {
          return { primary: String(books[0] || ''), additional: books.slice(1).map(String).filter(Boolean) };
        }
        if (usableObject(books)) {
          const primary = String(books.primary || books.primary_world || books.world || books.name || '').trim();
          const additional = Array.isArray(books.additional) ? books.additional.map(String).filter(Boolean) : [];
          if (primary || additional.length) return { primary, additional: [...new Set(additional)] };
        }
      } catch {}
    }
    const context = this.context;
    const character = context?.characters?.[context.characterId];
    const primary = String(character?.data?.extensions?.world || '').trim();
    const avatar = String(character?.avatar || '').replace(/\.[^.]+$/, '');
    const charLore = context?.extensionSettings?.world_info?.charLore;
    const additional = Array.isArray(charLore)
      ? (charLore.find((entry) => String(entry?.name || '') === avatar)?.extraBooks || [])
      : [];
    const chat = String(context?.chatMetadata?.world_info || '').trim();
    const embedded = !primary && character?.data?.character_book
      ? `__hypnoos_embedded__:${String(character.data.character_book.name || character.name || '角色卡世界书')}`
      : '';
    return {
      primary: primary || embedded,
      additional: [...new Set([...additional.map(String), ...(chat ? [chat] : [])].filter(Boolean))],
    };
  }

  loadWorldbook(name) {
    if (String(name || '').startsWith('__hypnoos_embedded__:')) {
      const context = this.context;
      const character = context?.characters?.[context.characterId];
      const embedded = character?.data?.character_book;
      if (!embedded) throw new Error('当前角色没有内嵌世界书');
      return context?.convertCharacterBook?.(clone(embedded)) || clone(embedded);
    }
    const fn = this.context?.loadWorldInfo;
    if (!fn) throw new Error('世界书读取接口不可用');
    return fn(name);
  }

  async saveWorldbook(name, data) {
    const context = this.context;
    if (!context?.saveWorldInfo) throw new Error('世界书写入接口不可用');
    await context.saveWorldInfo(name, clone(data), true);
    await context.updateWorldInfoList?.();
  }

  getChatWorldbookName() {
    return String(this.context?.chatMetadata?.world_info || '').trim();
  }

  async bindChatWorldbook(name) {
    const context = this.context;
    if (!context?.chatMetadata) throw new Error('当前聊天元数据不可用');
    context.chatMetadata.world_info = String(name || '').trim();
    await Promise.resolve(context.saveMetadataDebounced?.());
    return true;
  }

  setPromptText(text) {
    this.#promptText = String(text || '');
    this.refreshPrompt();
  }

  refreshPrompt() {
    const context = this.context;
    if (!context?.setExtensionPrompt) return;
    const prompt = [this.#promptText, buildLatestOperationGate(context.chat)].filter(Boolean).join('\n\n');
    context.setExtensionPrompt(PROMPT_ID, prompt, 1, 4, false, 0);
  }

  installPromptLifecycle() {
    const context = this.context;
    if (!context?.eventSource || !context?.eventTypes || !context?.setExtensionPrompt) return;
    const refresh = () => this.refreshPrompt();
    const clear = () => context.setExtensionPrompt(PROMPT_ID, '', -1, 0, false, 0);
    const before = context.eventTypes.GENERATION_AFTER_COMMANDS;
    const changed = context.eventTypes.CHAT_CHANGED;
    if (before) {
      context.eventSource.on(before, refresh);
      this.#disposers.push(() => context.eventSource.removeListener(before, refresh));
    }
    if (changed) {
      context.eventSource.on(changed, clear);
      this.#disposers.push(() => context.eventSource.removeListener(changed, clear));
    }
    this.#disposers.push(clear);
  }

  async readOptionalRuntimeState() {
    const snapshots = [];
    const latest = this.latestMessageId();
    const mvu = runtimeMvu();
    const helper = runtimeFunction('getVariables');
    for (const option of [{ type: 'message', message_id: latest }, { type: 'message', message_id: 'latest' }, { type: 'chat' }]) {
      if (mvu) {
        try {
          const value = await Promise.resolve(mvu.getMvuData(option));
          if (usableObject(value)) snapshots.push({ source: `mvu:${option.type}`, value });
        } catch {}
      }
      if (helper) {
        try {
          const value = await Promise.resolve(helper.fn.call(helper.view, option));
          if (usableObject(value)) snapshots.push({ source: `tavern-helper:${option.type}`, value });
        } catch {}
      }
    }
    const message = this.context?.chat?.[latest];
    const messageSnapshot = messageVariableSnapshot(message);
    if (messageSnapshot) snapshots.push({ source: 'message', value: messageSnapshot });
    return snapshots;
  }

  readVariables(option = { type: 'message', message_id: 'latest' }) {
    const found = runtimeFunction('getVariables');
    if (found) return found.fn.call(found.view, option);
    if (option?.type === 'message') {
      const chat = this.context?.chat;
      const id = option.message_id === 'latest' ? (chat?.length || 1) - 1 : Number(option.message_id);
      const message = Array.isArray(chat) ? chat[id] : null;
      return messageVariableSnapshot(message);
    }
    return null;
  }

  updateVariablesWith(updater, option = { type: 'message', message_id: 'latest' }) {
    const found = runtimeFunction('updateVariablesWith');
    if (!found) return false;
    return found.fn.call(found.view, updater, option);
  }

  readMvu(option = { type: 'message', message_id: 'latest' }) {
    const mvu = runtimeMvu();
    return mvu?.getMvuData?.(option) ?? this.readVariables(option);
  }

  async replaceMvuData(value, option = { type: 'message', message_id: 'latest' }) {
    const mvu = runtimeMvu();
    if (!mvu?.replaceMvuData) return false;
    return mvu.replaceMvuData(value, option);
  }

  getMvuEvents() {
    return runtimeMvu()?.events || {};
  }

  installOptionalRuntimeLifecycle(listener) {
    if (typeof listener !== 'function') return;
    const notify = (reason = 'runtime-variable-update') => Promise.resolve().then(() => listener(reason)).catch((error) => console.warn(`[${EXTENSION_ID}] 兼容状态导入失败`, error));
    const subscribed = new Set();
    let retryTimer = null;
    let retryCount = 0;
    let runtimeSynced = false;
    const subscribeRuntimeEvent = (helper, eventName, callback) => {
      if (!eventName || subscribed.has(eventName) || !helper) return false;
      try {
        const subscription = helper.fn.call(helper.view, eventName, callback);
        subscribed.add(eventName);
        this.#disposers.push(() => subscription?.stop?.());
        return true;
      } catch { return false; }
    };
    const bindRuntimeEvents = () => {
      retryCount += 1;
      const helper = runtimeFunction('eventOn');
      subscribeRuntimeEvent(helper, 'global_Mvu_initialized', bindRuntimeEvents);
      const mvuEvents = this.getMvuEvents();
      for (const key of ['VARIABLE_INITIALIZED', 'VARIABLE_UPDATE_ENDED']) {
        const reason = key === 'VARIABLE_INITIALIZED' ? 'runtime-initialized' : 'runtime-variable-update';
        subscribeRuntimeEvent(helper, mvuEvents[key], () => notify(reason));
      }
      if (runtimeMvu() && !runtimeSynced) {
        runtimeSynced = true;
        notify('runtime-initialized');
      }
      const runtimeEventNames = ['VARIABLE_INITIALIZED', 'VARIABLE_UPDATE_ENDED']
        .map((key) => mvuEvents[key])
        .filter(Boolean);
      const complete = runtimeEventNames.length > 0
        && runtimeEventNames.every((eventName) => subscribed.has(eventName));
      if ((complete || retryCount >= 120) && retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
      return complete;
    };
    if (!bindRuntimeEvents()) {
      retryTimer = setInterval(bindRuntimeEvents, 250);
      retryTimer.unref?.();
      this.#disposers.push(() => {
        if (retryTimer) clearInterval(retryTimer);
        retryTimer = null;
      });
    }
    const context = this.context;
    for (const key of ['MESSAGE_RECEIVED', 'MESSAGE_UPDATED']) {
      const eventName = context?.eventTypes?.[key];
      if (!eventName || subscribed.has(eventName) || !context?.eventSource) continue;
      const reason = key === 'MESSAGE_RECEIVED' ? 'runtime-message-received' : 'runtime-message-updated';
      const callback = () => notify(reason);
      context.eventSource.on(eventName, callback);
      subscribed.add(eventName);
      this.#disposers.push(() => context.eventSource.removeListener(eventName, callback));
    }
  }

  hasDatabaseRuntime() {
    return Boolean(runtimeDatabase());
  }

  async readDatabaseSnapshot() {
    const api = runtimeDatabase();
    if (!api) return null;
    const value = await Promise.resolve(api.exportTableAsJson());
    return usableObject(value) ? clone(value) : null;
  }

  installDatabaseRuntimeLifecycle(listener) {
    if (typeof listener !== 'function') return;
    let activeApi = null;
    let retryTimer = null;
    let retryCount = 0;
    const notify = () => Promise.resolve().then(listener).catch((error) => console.warn(`[${EXTENSION_ID}] 数据库状态导入失败`, error));
    const unbind = () => {
      if (!activeApi) return;
      try { activeApi.unregisterTableUpdateCallback?.(notify); } catch {}
      activeApi = null;
    };
    const bind = (shouldNotify = true) => {
      retryCount += 1;
      const api = runtimeDatabase();
      if (!api) return false;
      if (api !== activeApi) {
        unbind();
        activeApi = api;
        try { activeApi.registerTableUpdateCallback?.(notify); } catch {}
        if (shouldNotify) notify();
      }
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
      return true;
    };
    if (!bind()) {
      retryTimer = setInterval(() => {
        if (!bind() && retryCount >= 120 && retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
      }, 250);
      retryTimer.unref?.();
    }
    const context = this.context;
    const chatChanged = context?.eventTypes?.CHAT_CHANGED;
    if (chatChanged && context?.eventSource) {
      const rebind = () => {
        unbind();
        retryCount = 0;
        if (!bind(false) && !retryTimer) {
          retryTimer = setInterval(() => {
            if (!bind() && retryCount >= 120 && retryTimer) {
              clearInterval(retryTimer);
              retryTimer = null;
            }
          }, 250);
          retryTimer.unref?.();
        }
      };
      context.eventSource.on(chatChanged, rebind);
      this.#disposers.push(() => context.eventSource.removeListener(chatChanged, rebind));
    }
    this.#disposers.push(() => {
      if (retryTimer) clearInterval(retryTimer);
      retryTimer = null;
      unbind();
    });
  }

  async writeOptionalRuntimeState(legacyVariables, settings) {
    const helper = runtimeFunction('updateVariablesWith');
    if (settings.enableTavernHelperBridge && helper) {
      try {
        await Promise.resolve(helper.fn.call(helper.view, (vars) => mergeLegacyVariables(vars, legacyVariables), { type: 'chat' }));
      } catch (error) { console.warn(`[${EXTENSION_ID}] TH 同步失败`, error); }
    }
    const mvu = runtimeMvu();
    if (settings.enableMvuBridge && mvu?.replaceMvuData && mvu?.getMvuData) {
      try {
        const current = await Promise.resolve(mvu.getMvuData({ type: 'chat' })) || {};
        const next = { ...clone(current), stat_data: mergeLegacyVariables(current.stat_data, legacyVariables) };
        await mvu.replaceMvuData(next, { type: 'chat' });
      } catch (error) { console.warn(`[${EXTENSION_ID}] MVU 同步失败`, error); }
    }
  }

  destroy() {
    while (this.#disposers.length) {
      try { this.#disposers.pop()?.(); } catch {}
    }
  }
}
