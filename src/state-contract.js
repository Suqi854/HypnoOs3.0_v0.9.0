import { SCHEMA_IDS } from './constants.js';
import { clamp, clone, isRecord } from './utils.js';

export function createDefaultState(regionPack) {
  const now = new Date();
  return {
    schema: SCHEMA_IDS.state,
    revision: 1,
    region: regionPack.id,
    time: {
      year: now.getFullYear(),
      date: regionPack.defaultDate,
      weekday: regionPack.weekdays[0],
      clock: '08:00',
      scheduleLabel: regionPack.defaultScheduleLabel,
      specialDate: '',
    },
    location: { current: regionPack.locations[0]?.name || '未设定地点', custom: [] },
    timetable: clone(regionPack.timetable),
    resources: {
      mcEnergy: 25,
      mcEnergyMax: 25,
      mcPoints: 0,
      money: regionPack.currency.initial,
      suspicion: 0,
    },
    roles: {},
    inventory: [],
    tasks: [],
    achievements: [],
    work: [],
    dispatches: [],
    hypnosis: { commands: [], activeEffects: [] },
    operationQueue: [],
    custom: {},
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeState(value, regionPack) {
  const base = createDefaultState(regionPack);
  const source = isRecord(value) ? value : {};
  const resources = isRecord(source.resources) ? source.resources : {};
  const state = {
    ...base,
    ...clone(source),
    schema: SCHEMA_IDS.state,
    revision: Math.max(1, Number(source.revision) || 1),
    time: { ...base.time, ...(isRecord(source.time) ? source.time : {}) },
    location: { ...base.location, ...(isRecord(source.location) ? source.location : {}) },
    resources: {
      ...base.resources,
      ...resources,
      mcEnergy: clamp(resources.mcEnergy ?? base.resources.mcEnergy, 0, 1_000_000),
      mcEnergyMax: clamp(resources.mcEnergyMax ?? base.resources.mcEnergyMax, 1, 1_000_000),
      mcPoints: clamp(resources.mcPoints ?? base.resources.mcPoints, 0, 1_000_000_000),
      money: clamp(resources.money ?? base.resources.money, 0, 1_000_000_000_000),
      suspicion: clamp(resources.suspicion ?? base.resources.suspicion, 0, 100),
    },
    roles: isRecord(source.roles) ? source.roles : {},
    timetable: Array.isArray(source.timetable) ? source.timetable : base.timetable,
    inventory: Array.isArray(source.inventory) ? source.inventory : [],
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    achievements: Array.isArray(source.achievements) ? source.achievements : [],
    work: Array.isArray(source.work) ? source.work : [],
    dispatches: Array.isArray(source.dispatches) ? source.dispatches : [],
    operationQueue: Array.isArray(source.operationQueue) ? source.operationQueue : [],
    custom: isRecord(source.custom) ? source.custom : {},
    updatedAt: new Date().toISOString(),
  };
  state.resources.mcEnergy = Math.min(state.resources.mcEnergy, state.resources.mcEnergyMax);
  return state;
}
