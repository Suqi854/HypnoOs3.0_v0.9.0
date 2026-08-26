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
      core: {
        favor: 0,
        suspicion: 0,
        hypnosis: { active: [], permanent: [] },
        profile: {},
      },
      custom: {},
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
      core: isRecord(sourceVariables.core) ? sourceVariables.core : role.variables.core,
      custom: isRecord(sourceVariables.custom) ? sourceVariables.custom : {},
    },
    worldbookFragments: Array.isArray(input.worldbookFragments) ? input.worldbookFragments : [],
    provenance: isRecord(input.provenance) ? input.provenance : role.provenance,
  };
}
