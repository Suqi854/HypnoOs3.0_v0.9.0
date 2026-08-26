import { SCHEMA_IDS } from './constants.js';
import { clone, isRecord, makeId, sanitizeName } from './utils.js';

export function createDefaultRole(name = '目标角色') {
  const id = makeId('role');
  return {
    schema: SCHEMA_IDS.rolePack,
    id,
    name: sanitizeName(name),
    summary: '',
    persona: '',
    avatarAssetId: null,
    variables: {
      runtime: { hypnosis: { active: [], permanent: [] } },
      extensions: {},
      compatibility: {},
    },
    worldbookFragments: [],
    provenance: { source: 'manual', importedAt: new Date().toISOString() },
  };
}

export function normalizeRolePack(input) {
  if (!isRecord(input)) throw new Error('角色包必须是 JSON 对象');
  const name = sanitizeName(input.name || input.data?.name || input.character?.name, '未命名角色');
  const role = createDefaultRole(name);
  const sourceVariables = isRecord(input.variables) ? input.variables : {};
  const legacyCore = isRecord(sourceVariables.core) ? sourceVariables.core : {};
  const legacyCompatibility = Object.fromEntries(Object.entries(legacyCore).filter(([key]) => key !== 'hypnosis'));
  const runtime = isRecord(sourceVariables.runtime) ? clone(sourceVariables.runtime) : {};
  if (!isRecord(runtime.hypnosis)) runtime.hypnosis = isRecord(legacyCore.hypnosis) ? clone(legacyCore.hypnosis) : role.variables.runtime.hypnosis;
  return {
    ...role,
    ...clone(input),
    schema: SCHEMA_IDS.rolePack,
    id: String(input.id || role.id),
    name,
    summary: String(input.summary || input.data?.description || input.description || ''),
    persona: String(input.persona || input.data?.personality || input.personality || ''),
    avatarAssetId: input.avatarAssetId ? String(input.avatarAssetId) : null,
    variables: {
      runtime,
      extensions: clone(isRecord(sourceVariables.extensions) ? sourceVariables.extensions : isRecord(sourceVariables.custom) ? sourceVariables.custom : {}),
      compatibility: {
        ...clone(legacyCompatibility),
        ...(isRecord(sourceVariables.compatibility) ? clone(sourceVariables.compatibility) : {}),
      },
    },
    worldbookFragments: Array.isArray(input.worldbookFragments) ? input.worldbookFragments : [],
    provenance: isRecord(input.provenance) ? input.provenance : role.provenance,
  };
}
