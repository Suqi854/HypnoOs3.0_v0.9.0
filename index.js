import { startExtension, stopExtension } from './src/extension.js?revision=database-profile-v4';

const READY_KEY = '__HYPNOOS3_AUTO_START__';

function startOnce() {
  if (globalThis[READY_KEY]) return globalThis[READY_KEY];
  globalThis[READY_KEY] = Promise.resolve(startExtension()).catch((error) => {
    globalThis[READY_KEY] = null;
    console.error('[HypnoOS3] 启动失败', error);
  });
  return globalThis[READY_KEY];
}

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    queueMicrotask(callback);
  }
}

onReady(startOnce);

export function enable() {
  startOnce();
}

export function disable() {
  stopExtension();
  globalThis[READY_KEY] = null;
}

export function clean() {
  disable();
}
