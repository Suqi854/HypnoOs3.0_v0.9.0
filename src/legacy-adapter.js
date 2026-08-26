import { createDefaultRole } from './role-contract.js';
import { normalizeState } from './state-contract.js';
import { clone, isRecord, makeId, sanitizeName } from './utils.js';

export function findLegacyVariables(value) {
  const pending = [value];
  const seen = new Set();
  while (pending.length) {
    const current = pending.shift();
    if (!isRecord(current) || seen.has(current)) continue;
    seen.add(current);
    if (isRecord(current.系统) || isRecord(current.角色) || isRecord(current.任务) || isRecord(current.规则)) return current;
    for (const key of ['stat_data', 'variables', 'mvu']) {
      if (isRecord(current[key])) pending.push(current[key]);
    }
  }
  return null;
}

export function mergeLegacyVariables(current, incoming) {
  if (!isRecord(incoming)) return isRecord(current) ? clone(current) : {};
  const result = isRecord(current) ? clone(current) : {};
  for (const [key, value] of Object.entries(incoming)) {
    result[key] = isRecord(value) ? mergeLegacyVariables(result[key], value) : clone(value);
  }
  return result;
}

export function toLegacyVariables(state) {
  const recordBy = (items, prefix) => Object.fromEntries((Array.isArray(items) ? items : []).map((item, index) => {
    const value = isRecord(item) ? clone(item) : { value: item };
    const key = String(value.id || value.name || value.title || value.名称 || value.任务名 || `${prefix}-${index + 1}`);
    return [key, value];
  }));
  const roles = {};
  for (const role of Object.values(state.roles || {})) {
    if (!role?.name) continue;
    roles[role.name] = {
      好感度: role.variables?.core?.favor ?? 0,
      可疑度: role.variables?.core?.suspicion ?? 0,
      催眠状态: role.variables?.core?.hypnosis ?? { active: [], permanent: [] },
      人物档案: role.variables?.core?.profile ?? {},
      自定义: role.variables?.custom ?? {},
      _hypnoos角色ID: role.id,
      _头像资源ID: role.avatarAssetId,
    };
  }
  const projected = {
    系统: {
      MC能量: state.resources.mcEnergy,
      MC能量上限: state.resources.mcEnergyMax,
      星光点: state.resources.mcPoints,
      持有零花钱: state.resources.money,
      主角可疑度: state.resources.suspicion,
      当前年份: state.time.year,
      当前日期: state.time.date,
      _当前周几: state.time.weekday,
      当前时间: state.time.clock,
      _当前日程: state.time.scheduleLabel,
      _当前特殊日期: state.time.specialDate,
      当前地点: state.location.current,
      当前事件: String(state.custom?.currentEvent || ''),
      当前出场角色: Array.isArray(state.custom?.presentRoles) ? clone(state.custom.presentRoles) : [],
      _课程表: state.timetable,
      催眠APP订阅等级: String(state.custom?.subscriptionLevel || 'VIP0'),
      _警视厅线: Number(state.custom?.policeLine || 0),
      _医院线: Number(state.custom?.hospitalLine || 0),
      派遣岗位: {
        '1号门': clone(state.dispatches?.[0] || { 角色名: '', 派遣工作: '', 派遣开始时间: '', 派遣结束时间: '' }),
        '2号门': clone(state.dispatches?.[1] || { 角色名: '', 派遣工作: '', 派遣开始时间: '', 派遣结束时间: '' }),
        '3号门': clone(state.dispatches?.[2] || { 角色名: '', 派遣工作: '', 派遣开始时间: '', 派遣结束时间: '' }),
      },
      持有物品: recordBy(state.inventory, 'item'),
      _社畜值: Number(state.custom?.workValue || 0),
      _buff: String(state.custom?.buff || ''),
      _buff结束时间: String(state.custom?.buffEndTime || ''),
      _user身份: isRecord(state.custom?.userIdentity) ? clone(state.custom.userIdentity) : {},
    },
    规则: state.custom?.rules || {},
    角色: roles,
    任务: recordBy(state.tasks, 'task'),
  };
  return mergeLegacyVariables(state.custom?.legacyVariables, projected);
}

export function fromLegacyVariables(legacy, current, regionPack) {
  if (!isRecord(legacy)) return normalizeState(current, regionPack);
  const next = clone(current);
  const system = isRecord(legacy.系统) ? legacy.系统 : {};
  const privateStore = isRecord(system._hypnoos) ? system._hypnoos : {};
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  next.resources.mcEnergy = number(system.MC能量 ?? system._MC能量, next.resources.mcEnergy);
  next.resources.mcEnergyMax = number(system.MC能量上限 ?? system._MC能量上限, next.resources.mcEnergyMax);
  next.resources.mcPoints = number(system.星光点 ?? system.当前MC点, next.resources.mcPoints);
  next.resources.money = number(system.持有零花钱, next.resources.money);
  next.resources.suspicion = number(system.主角可疑度, next.resources.suspicion);
  next.time = {
    ...next.time,
    year: number(system.当前年份, next.time.year),
    date: String(system.当前日期 ?? next.time.date),
    weekday: String(system._当前周几 ?? next.time.weekday),
    clock: String(system.当前时间 ?? next.time.clock),
    scheduleLabel: String(system._当前日程 ?? next.time.scheduleLabel),
    specialDate: String(system._当前特殊日期 ?? next.time.specialDate),
  };
  next.location.current = String(system.当前地点 ?? legacy.地点?.当前地点 ?? next.location.current);
  if (Array.isArray(system._课程表)) next.timetable = clone(system._课程表);
  next.custom = {
    ...next.custom,
    currentEvent: String(system.当前事件 ?? next.custom.currentEvent ?? ''),
    presentRoles: Array.isArray(system.当前出场角色) ? clone(system.当前出场角色) : next.custom.presentRoles || [],
    subscriptionLevel: String(system.催眠APP订阅等级 ?? next.custom.subscriptionLevel ?? 'VIP0'),
    policeLine: number(system._警视厅线, next.custom.policeLine || 0),
    hospitalLine: number(system._医院线, next.custom.hospitalLine || 0),
    workValue: number(system._社畜值, next.custom.workValue || 0),
    buff: String(system._buff ?? next.custom.buff ?? ''),
    buffEndTime: String(system._buff结束时间 ?? next.custom.buffEndTime ?? ''),
    userIdentity: isRecord(system._user身份) ? clone(system._user身份) : next.custom.userIdentity || {},
  };
  if (isRecord(system.派遣岗位)) next.dispatches = Object.values(system.派遣岗位).map(clone);
  for (const [name, value] of Object.entries(isRecord(legacy.角色) ? legacy.角色 : {})) {
    if (!isRecord(value)) continue;
    const id = String(value._hypnoos角色ID || Object.values(next.roles).find((role) => role.name === name)?.id || makeId('role'));
    const existing = next.roles[id] || createDefaultRole(name);
    next.roles[id] = {
      ...existing,
      id,
      name: sanitizeName(name),
      avatarAssetId: value._头像资源ID || existing.avatarAssetId || null,
      variables: {
        core: {
          ...existing.variables?.core,
          favor: number(value.好感度, existing.variables?.core?.favor || 0),
          suspicion: number(value.可疑度, existing.variables?.core?.suspicion || 0),
          hypnosis: isRecord(value.催眠状态) ? clone(value.催眠状态) : existing.variables?.core?.hypnosis,
          profile: isRecord(value.人物档案) ? clone(value.人物档案) : existing.variables?.core?.profile,
        },
        custom: isRecord(value.自定义) ? clone(value.自定义) : existing.variables?.custom || {},
      },
    };
  }
  for (const key of ['inventory', 'work', 'dispatches', 'operationQueue']) {
    if (Array.isArray(privateStore[key])) next[key] = clone(privateStore[key]);
  }
  const values = (value) => Array.isArray(value) ? clone(value) : isRecord(value) ? Object.entries(value).map(([id, item]) => isRecord(item) ? { id, ...clone(item) } : { id, value: item }) : [];
  if (Array.isArray(system.持有物品) || isRecord(system.持有物品)) next.inventory = values(system.持有物品);
  if (Array.isArray(legacy.库存) || isRecord(legacy.库存)) next.inventory = values(legacy.库存);
  if (Array.isArray(legacy.任务) || isRecord(legacy.任务)) next.tasks = values(legacy.任务);
  if (Array.isArray(legacy.成就) || isRecord(legacy.成就)) next.achievements = values(legacy.成就);
  next.custom.rules = isRecord(legacy.规则) ? clone(legacy.规则) : next.custom.rules;
  next.custom.legacyVariables = clone(legacy);
  return normalizeState(next, regionPack);
}
