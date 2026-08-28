import { AppDataService } from './app-data-service.js';
import { HYPNOSIS_RULES_API } from './hypnosis-rules.js';

const BRIDGE_KEY = '__HYPNOOS3_CORE_BRIDGE__';
const SINGLETON_KEY = '__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__';
const HOST_ID = 'hypnoos3-extension-floating-phone-host';
const FRONTEND_REVISION = 'hypnoos3-1.0.0-pet-motion-resize';

function phoneFrame() {
  return document.querySelector(`#${HOST_ID}`)?.shadowRoot?.querySelector('iframe.phone') || null;
}

export function createStateBridge(host, dataService) {
  return {
    getVariables: () => dataService.readLegacyVariables(),
    updateVariablesWith: (updater) => dataService.updateLegacyVariables(updater),
    Mvu: {
      get events() { return host.getMvuEvents(); },
      getMvuData: () => dataService.readMvuData(),
      replaceMvuData: (value) => dataService.replaceMvuData(value),
    },
  };
}

export class FloatingHost {
  constructor(host, store) {
    this.host = host;
    this.store = store;
    this.dataService = new AppDataService(host, store);
    this.listeners = new Map();
    this.disposers = [];
  }

  async start() {
    const existing = globalThis[BRIDGE_KEY];
    if (existing?.destroy) existing.destroy();
    const bridge = this.#createBridge();
    globalThis[BRIDGE_KEY] = bridge;
    this.bridge = bridge;

    const onStore = () => {
      for (const [eventName, eventListeners] of this.listeners) {
        if (!/update|variable/i.test(eventName) || /initialized/i.test(eventName)) continue;
        for (const listener of eventListeners) {
          try { listener(this.store.state); } catch (error) { console.warn('[HypnoOS3] 前端刷新监听失败', error); }
        }
      }
    };
    this.store.addEventListener('change', onStore);
    this.disposers.push(() => this.store.removeEventListener('change', onStore));

    const emitBridgeEvent = (eventName, payload) => {
      for (const listener of this.listeners.get(eventName) || []) {
        try { listener(payload); } catch (error) { console.warn('[HypnoOS3] 前端事件监听失败', error); }
      }
    };
    const context = this.host.context;
    const receivedEvent = context?.eventTypes?.MESSAGE_RECEIVED;
    const chatChangedEvent = context?.eventTypes?.CHAT_CHANGED;
    if (receivedEvent && context?.eventSource) {
      const onDialogueRoundEnded = (...args) => emitBridgeEvent('HYPNOOS3_DIALOGUE_ROUND_ENDED', { args });
      context.eventSource.on(receivedEvent, onDialogueRoundEnded);
      this.disposers.push(() => context.eventSource.removeListener(receivedEvent, onDialogueRoundEnded));
    }
    if (chatChangedEvent && context?.eventSource) {
      const onChatChanged = (...args) => emitBridgeEvent('HYPNOOS3_CHAT_CHANGED', { args });
      context.eventSource.on(chatChangedEvent, onChatChanged);
      this.disposers.push(() => context.eventSource.removeListener(chatChangedEvent, onChatChanged));
    }

    const onMessage = async (event) => {
      const frame = phoneFrame();
      if (!frame || event.source !== frame.contentWindow || event.origin !== location.origin || !event.data || typeof event.data !== 'object') return;
      if (event.data.type !== 'HYPNOOS_APPEND_OPERATION') return;
      const command = String(event.data.block || event.data.payload?.block || event.data.payload?.command || '').trim().slice(0, 20_000);
      if (command) this.host.setInput(command, { append: false });
    };
    addEventListener('message', onMessage);
    this.disposers.push(() => removeEventListener('message', onMessage));

    const script = document.createElement('script');
    const scriptUrl = new URL('../public/floating-bootstrap.js', import.meta.url);
    scriptUrl.searchParams.set('revision', FRONTEND_REVISION);
    script.src = scriptUrl.href;
    script.dataset.frontendUrl = new URL('../ui/index.html', import.meta.url).href;
    script.dataset.assetBase = new URL('../public/assets/', import.meta.url).href;
    script.dataset.vendorBase = new URL('../public/vendor/', import.meta.url).href;
    script.dataset.bridgeKey = BRIDGE_KEY;
    script.dataset.singletonKey = SINGLETON_KEY;
    script.dataset.hostId = HOST_ID;
    script.dataset.registryEvent = 'HYPNOOS3_EXTENSION_FLOATING_REGISTRY_READY';
    script.dataset.storageKey = 'hypnoos3.extension.floatingPhone.ui.v1';
    script.dataset.revision = FRONTEND_REVISION;
    script.dataset.mode = 'host';
    script.async = false;
    document.head.append(script);
    this.script = script;
    this.disposers.push(() => script.remove());
    await new Promise((resolve, reject) => {
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', () => reject(new Error('4.3 悬浮宿主加载失败')), { once: true });
    });
    return this;
  }

  #createBridge() {
    const store = this.store;
    const host = this.host;
    const dataService = this.dataService;
    const listeners = this.listeners;
    const stateBridge = createStateBridge(host, dataService);
    const bridge = {
      getVariables: stateBridge.getVariables,
      updateVariablesWith: stateBridge.updateVariablesWith,
      getChatMessages() { return host.getMessages(); },
      setChatMessages() { return false; },
      triggerSlash(command) {
        const text = String(command || '').trim();
        if (text) store.queueOperation({ sourceApp: 'phone', command: text }).catch((error) => console.error('[HypnoOS3] 指令暂存失败', error));
        return '';
      },
      eventOn(eventName, listener) {
        if (typeof listener !== 'function') return { stop() {} };
        const key = String(eventName || 'variable_update');
        if (!listeners.has(key)) listeners.set(key, new Set());
        listeners.get(key).add(listener);
        return { stop() {
          listeners.get(key)?.delete(listener);
          if (!listeners.get(key)?.size) listeners.delete(key);
        } };
      },
      getHypnoAppData(appId) { return dataService.readAppData(appId); },
      grantCheatResources(value) { return dataService.grantCheatResources(value); },
      getWorldbookNames() { return dataService.getWorldbookNames(); },
      getCharWorldbookNames() { return dataService.getCharacterWorldbookNames(); },
      getWorldbook(name) { return dataService.getWorldbook(name); },
      generateRaw(options) { return host.generateRaw(options || {}); },
      getHypnosisRules(version) { return HYPNOSIS_RULES_API.get(version); },
      listHypnosisRuleVersions() { return HYPNOSIS_RULES_API.listVersions(); },
      calculateHypnosisCost(commandId, parameters, version) { return HYPNOSIS_RULES_API.calculateCost(commandId, parameters, version); },
      calculateHypnosisBatchCost(items, options, version) { return HYPNOSIS_RULES_API.calculateBatchCost(items, options, version); },
      calculateMcEnergyRecharge(options) { return HYPNOSIS_RULES_API.calculateMcRecharge(options); },
      getHypnosisRulePrompt(version) { return HYPNOSIS_RULES_API.buildPrompt(version); },
      setInput(text, options) { return host.setInput(text, { append: options?.append !== false }); },
      directSend(text) { return host.directSend(text); },
      destroy: () => this.destroy(),
    };
    bridge.Mvu = stateBridge.Mvu;
    return bridge;
  }

  destroy() {
    while (this.disposers.length) { try { this.disposers.pop()?.(); } catch {} }
    this.listeners.clear();
    try { globalThis[SINGLETON_KEY]?.destroy?.(); } catch {}
    if (globalThis[SINGLETON_KEY]) delete globalThis[SINGLETON_KEY];
    if (globalThis[BRIDGE_KEY] === this.bridge) delete globalThis[BRIDGE_KEY];
  }
}
