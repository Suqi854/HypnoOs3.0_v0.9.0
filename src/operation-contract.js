import { SCHEMA_IDS } from './constants.js';
import { isRecord, makeId } from './utils.js';

export function makeOperation(input) {
  const source = isRecord(input) ? input : { command: String(input || '') };
  return {
    schema: SCHEMA_IDS.operation,
    id: String(source.id || makeId('op')),
    sourceApp: String(source.sourceApp || 'manual'),
    command: String(source.command || '').trim(),
    args: isRecord(source.args) ? source.args : {},
    targetPaths: Array.isArray(source.targetPaths) ? source.targetPaths.map(String) : [],
    note: String(source.note || ''),
    locked: Boolean(source.locked),
    reversible: source.reversible !== false,
    createdAt: source.createdAt || new Date().toISOString(),
  };
}
