export const EXTENSION_ID = 'hypnoos3';
export const RUNTIME_KEY = '__HYPNOOS3_RUNTIME__';
export const SETTINGS_KEY = 'hypnoos3';
export const CHAT_STATE_KEY = 'hypnoos3State';
export const PROMPT_ID = 'hypnoos3-runtime-state';
export const UI_BASELINE = Object.freeze({
  source: 'HApp5 fixed 4.3 webview artifact',
  upstreamCommit: 'db71f7715f86aa2be0210c1602843c66c2792139',
  artifactSha256: '303ff97170e8117e8b111070907ac67c720e5f508998db4f0560cc9b58126fd4',
  approvedRuntimeVersion: '0.9.0',
  approvedRuntimeUiSha256: '3d5c7094670e6b2f94f20bc8cab3e7eb57af74d4432b480cb2cebee49c6eb018',
});

export const SCHEMA_IDS = Object.freeze({
  profile: 'HypnoProfile/v1',
  rolePack: 'RolePack/v1',
  adapter: 'WorldAdapter/v1',
  state: 'HypnoState/v1',
  operation: 'PendingOperation/v1',
  companion: 'CompanionBookMeta/v1',
  app: 'PhoneAppModule/v1',
});

export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
export const MAX_AVATAR_DIMENSION = 4096;
export const ALLOWED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const DIRECT_API_SECRET_KEY = 'hypnoos3:direct-api-key';
