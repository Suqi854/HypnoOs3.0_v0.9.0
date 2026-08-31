import { ControlPanel } from './control-panel.js';
import { FloatingHost } from './floating-host.js';
import { HostAdapter } from './host-adapter.js';
import { HypnoStorage } from './storage.js';
import { StateStore } from './state-store.js';
import { EXTENSION_ID, RUNTIME_KEY } from './constants.js';
import { HYPNOSIS_RULES_API } from './hypnosis-rules.js';

class Runtime {
  disposers = [];

  async start() {
    this.host = new HostAdapter();
    this.storage = new HypnoStorage();
    this.store = new StateStore(this.host, this.storage);
    await this.store.initialize();
    this.host.installPromptLifecycle();
    this.host.installOptionalRuntimeLifecycle(() => this.store.syncOptionalRuntimeState());
    this.host.installDatabaseRuntimeLifecycle(() => this.store.syncDatabaseRuntimeState());

    this.control = document.createElement('div');
    this.control.id = 'hypnoos3-control-host';
    this.control.hidden = true;
    document.body.append(this.control);
    this.panel = new ControlPanel(this.control, {
      host: this.host,
      store: this.store,
      storage: this.storage,
      close: () => this.hideControl(),
    });

    const openControl = () => {
      this.panel.render();
      this.control.hidden = false;
      this.control.querySelector('button')?.focus();
    };
    const closeBackdrop = (event) => { if (event.target === this.control) this.hideControl(); };
    const escape = (event) => { if (event.key === 'Escape' && !this.control.hidden) this.hideControl(); };
    addEventListener('hypnoos3-open-settings', openControl);
    this.control.addEventListener('click', closeBackdrop);
    document.addEventListener('keydown', escape);
    this.disposers.push(
      () => removeEventListener('hypnoos3-open-settings', openControl),
      () => this.control.removeEventListener('click', closeBackdrop),
      () => document.removeEventListener('keydown', escape),
    );

    this.floatingHost = await new FloatingHost(this.host, this.store).start();
    try {
      await this.floatingHost.dataService.activateArchiveWorldbookRules();
    } catch (error) {
      console.warn('[HypnoOS3] 进入聊天时加载即插即用催眠规则失败', error);
    }
    globalThis.__HYPNOOS3_HYPNOSIS_RULES__ = HYPNOSIS_RULES_API;
    this.disposers.push(() => {
      if (globalThis.__HYPNOOS3_HYPNOSIS_RULES__ === HYPNOSIS_RULES_API) delete globalThis.__HYPNOOS3_HYPNOSIS_RULES__;
    });

    const context = this.host.context;
    const chatChanged = context?.eventTypes?.CHAT_CHANGED;
    if (chatChanged && context?.eventSource) {
      const transition = async () => {
        try { await this.floatingHost.dataService.deactivateArchiveWorldbookRules(); }
        catch (error) { console.warn('[HypnoOS3] 退出聊天时删除即插即用催眠规则失败', error); }
        await this.store.initialize();
        try { await this.floatingHost.dataService.activateArchiveWorldbookRules(); }
        catch (error) { console.warn('[HypnoOS3] 进入聊天时加载即插即用催眠规则失败', error); }
      };
      const reload = () => {
        this.chatTransition = (this.chatTransition || Promise.resolve()).then(transition)
          .catch((error) => console.warn('[HypnoOS3] 聊天切换状态重载失败', error));
      };
      context.eventSource.on(chatChanged, reload);
      this.disposers.push(() => context.eventSource.removeListener(chatChanged, reload));
    }
    const chatDeleted = context?.eventTypes?.CHAT_DELETED;
    const groupChatDeleted = context?.eventTypes?.GROUP_CHAT_DELETED;
    if (chatDeleted && context?.eventSource) {
      const removeCharacterChatState = (chatId) => {
        void this.storage.deleteChatStateByChatId(chatId, { scopeKey: this.host.characterScopeKey() })
          .catch((error) => console.warn('[HypnoOS3] 删除聊天关联存档失败', error));
      };
      context.eventSource.on(chatDeleted, removeCharacterChatState);
      this.disposers.push(() => context.eventSource.removeListener(chatDeleted, removeCharacterChatState));
    }
    if (groupChatDeleted && context?.eventSource) {
      const removeGroupChatState = (chatId) => {
        void this.storage.deleteChatStateByChatId(chatId, { scopeKey: this.host.groupScopeKey() })
          .catch((error) => console.warn('[HypnoOS3] 删除群聊关联存档失败', error));
      };
      context.eventSource.on(groupChatDeleted, removeGroupChatState);
      this.disposers.push(() => context.eventSource.removeListener(groupChatDeleted, removeGroupChatState));
    }
    return this;
  }

  hideControl() {
    this.control.hidden = true;
    document.querySelector('#hypnoos3-extension-floating-phone-host')?.shadowRoot?.querySelector('.launcher')?.focus();
  }

  destroy() {
    while (this.disposers.length) { try { this.disposers.pop()?.(); } catch {} }
    this.floatingHost?.destroy();
    this.host?.destroy();
    this.storage?.close();
    this.control?.remove();
  }
}

export async function startExtension() {
  if (globalThis[RUNTIME_KEY]) return globalThis[RUNTIME_KEY];
  const runtime = await new Runtime().start();
  globalThis[RUNTIME_KEY] = runtime;
  console.info(`[${EXTENSION_ID}] 已启动 4.3 悬浮宿主`, runtime.host.capabilities());
  return runtime;
}

export function stopExtension() {
  globalThis[RUNTIME_KEY]?.destroy?.();
  delete globalThis[RUNTIME_KEY];
}
