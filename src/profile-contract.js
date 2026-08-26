import { SCHEMA_IDS } from './constants.js';
import { isRecord, makeId, sanitizeName } from './utils.js';

export function normalizeProfile(input, region = 'cn') {
  const source = isRecord(input) ? input : {};
  return {
    schema: SCHEMA_IDS.profile,
    id: String(source.id || makeId('profile')),
    name: sanitizeName(source.name, '默认配置'),
    region: ['cn', 'jp', 'custom'].includes(source.region) ? source.region : region,
    roleIds: Array.isArray(source.roleIds) ? source.roleIds.map(String) : [],
    adapterId: source.adapterId ? String(source.adapterId) : null,
    enabledModules: Array.isArray(source.enabledModules) ? source.enabledModules.map(String) : [],
    variableMapping: isRecord(source.variableMapping) ? source.variableMapping : {},
    calendar: isRecord(source.calendar) ? source.calendar : {},
    locations: Array.isArray(source.locations) ? source.locations : [],
    timetable: Array.isArray(source.timetable) ? source.timetable : [],
    updatedAt: new Date().toISOString(),
  };
}
