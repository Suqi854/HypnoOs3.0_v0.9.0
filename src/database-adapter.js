import { clone, isRecord, stableStringify } from './utils.js';

const SHEET_NAMES = Object.freeze({
  global: '全局数据表',
  protagonist: '主角信息',
  roles: '重要人物表',
  skills: '主角技能表',
  inventory: '背包物品表',
  tasks: '任务与事件表',
  summaries: '总结表',
  outline: '总体大纲',
});

function clean(value, limit = 4000) {
  return String(value ?? '').trim().slice(0, limit);
}

function normalizeRow(headers, row, index) {
  if (isRecord(row)) return { id: clean(row.id ?? row.uid ?? index, 120), values: clone(row) };
  const cells = Array.isArray(row) ? row : [row];
  const values = {};
  headers.forEach((header, cellIndex) => {
    const key = clean(header || (cellIndex === 0 ? '记录ID' : `字段${cellIndex + 1}`), 120);
    if (key) values[key] = clone(cells[cellIndex] ?? '');
  });
  return { id: clean(cells[0] ?? index, 120), values };
}

function normalizeSheet(key, value) {
  const content = Array.isArray(value?.content) ? value.content : [];
  const headerRow = Array.isArray(content[0]) ? content[0] : [];
  const headers = headerRow.map((header, index) => clean(header || (index === 0 ? '记录ID' : `字段${index + 1}`), 120));
  const rows = content.slice(headerRow.length ? 1 : 0).map((row, index) => normalizeRow(headers, row, index));
  return {
    key: clean(key, 120),
    uid: clean(value?.uid ?? key, 120),
    name: clean(value?.name ?? value?.sheetName ?? key, 120),
    headers,
    rows,
  };
}

function shortSignature(value) {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeDatabaseSnapshot(value) {
  if (!isRecord(value)) return { available: false, schema: 'HypnoDatabaseSnapshot/v1', sheets: [], signature: '' };
  const sheets = Object.entries(value)
    .filter(([key, sheet]) => key !== 'mate' && isRecord(sheet) && Array.isArray(sheet.content))
    .map(([key, sheet]) => normalizeSheet(key, sheet));
  return {
    available: true,
    schema: 'HypnoDatabaseSnapshot/v1',
    meta: isRecord(value.mate) ? clone(value.mate) : {},
    sheets,
    signature: shortSignature(sheets),
  };
}

function sheetByName(snapshot, name) {
  return snapshot.sheets.find((sheet) => sheet.name === name || sheet.key === name) || null;
}

function firstRow(snapshot, name) {
  return sheetByName(snapshot, name)?.rows?.[0]?.values || null;
}

function rowName(row, ...keys) {
  for (const key of keys) {
    const value = clean(row?.[key], 160);
    if (value) return value;
  }
  return '';
}

function splitGenderAge(value) {
  const source = clean(value, 160);
  if (!source) return { gender: '', age: '' };
  const genderMatch = source.match(/(?:^|[\s/／,，;；|｜-])(男(?:性)?|女(?:性)?|male|female|boy|girl)(?=$|[\s/／,，;；|｜-])/iu)
    || source.match(/^(男(?:性)?|女(?:性)?|male|female|boy|girl)/iu);
  const token = clean(genderMatch?.[1], 20).toLowerCase();
  const gender = /^(?:男|男性|male|boy)$/iu.test(token) ? '男' : /^(?:女|女性|female|girl)$/iu.test(token) ? '女' : '';
  const age = clean(source
    .replace(genderMatch?.[0] || '', ' ')
    .replace(/^[\s/／,，;；|｜-]+|[\s/／,，;；|｜-]+$/gu, ''), 80);
  return { gender, age };
}

function databaseRolePages(name, row, favor) {
  const genderAge = splitGenderAge(rowName(row, '性别/年龄'));
  const appearance = rowName(row, '外貌特征');
  const occupation = rowName(row, '职业/身份', '职业', '身份');
  const personality = rowName(row, '性格特点');
  const history = rowName(row, '过往经历');
  const away = rowName(row, '是否离场');
  const importantItems = rowName(row, '持有的重要物品');
  const info = { 姓名: name };
  if (genderAge.gender) info.性别 = genderAge.gender;
  if (genderAge.age) info._年龄 = genderAge.age;
  if (appearance) info.外貌特征 = appearance;
  if (occupation) info.社团或职业 = occupation;
  const pages = { 信息: info };
  if (appearance) pages.衣着 = { 面部: appearance };
  const status = {};
  if (Number.isFinite(favor)) status.好感度 = favor;
  if (away) status.是否离场 = away;
  if (Object.keys(status).length) pages.状态 = status;
  if (history) pages.事件 = { 至关重要记忆: history };
  if (personality) pages.效果 = { 心理: personality };
  if (importantItems) {
    const holding = {};
    for (const item of importantItems.split(/[、,，;；|｜]+/u).map((entry) => clean(entry, 160)).filter(Boolean)) {
      holding[item] = { 描述: '数据库记录', 数量: 1, 固定: true };
    }
    if (Object.keys(holding).length) pages.物品 = { 持有: holding };
  }
  return pages;
}

function rowsByName(snapshot, name) {
  return (sheetByName(snapshot, name)?.rows || []).map((record) => ({
    ...clone(record.values),
    数据库记录ID: record.id,
    数据来源: '数据库',
  }));
}

export function projectDatabaseSnapshot(value) {
  const snapshot = value?.schema === 'HypnoDatabaseSnapshot/v1' ? clone(value) : normalizeDatabaseSnapshot(value);
  const legacy = { 系统: {}, 角色: {}, 任务: {} };
  if (!snapshot.available) return { snapshot, legacy, metadata: { available: false, schemaVersion: 1 } };

  const globalRow = firstRow(snapshot, SHEET_NAMES.global);
  if (globalRow) {
    const location = rowName(globalRow, '主角当前所在地点', '当前地点');
    const time = rowName(globalRow, '当前时间');
    if (location) legacy.系统.当前地点 = location;
    if (time) legacy.系统.当前时间 = time;
  }

  const protagonist = firstRow(snapshot, SHEET_NAMES.protagonist);
  if (protagonist) {
    legacy.系统._user身份 = {
      人物名称: rowName(protagonist, '人物名称', '姓名'),
      '性别/年龄': rowName(protagonist, '性别/年龄'),
      外貌特征: rowName(protagonist, '外貌特征'),
      '职业/身份': rowName(protagonist, '职业/身份'),
      过往经历: rowName(protagonist, '过往经历'),
      性格特点: rowName(protagonist, '性格特点'),
    };
    const location = rowName(protagonist, '主角当前所在地点');
    if (location) legacy.系统.当前地点 = location;
  }

  for (const record of sheetByName(snapshot, SHEET_NAMES.roles)?.rows || []) {
    const row = record.values;
    const name = rowName(row, '姓名', '人物名称');
    if (!name) continue;
    const favor = Number(row?.好感度);
    const pages = databaseRolePages(name, row, favor);
    legacy.角色[name] = {
      ...(Number.isFinite(favor) ? { 好感度: favor } : {}),
      ...pages,
      人物档案: {
        '性别/年龄': rowName(row, '性别/年龄'),
        外貌特征: rowName(row, '外貌特征'),
        性格特点: rowName(row, '性格特点'),
        持有的重要物品: rowName(row, '持有的重要物品'),
        是否离场: rowName(row, '是否离场'),
        过往经历: rowName(row, '过往经历'),
      },
      自定义: { 数据库记录ID: record.id, 数据来源: '数据库' },
    };
  }

  const inventory = {};
  for (const record of sheetByName(snapshot, SHEET_NAMES.inventory)?.rows || []) {
    const row = record.values;
    const name = rowName(row, '物品名称', '名称');
    if (!name) continue;
    inventory[name] = {
      数量: row?.数量 ?? '',
      描述: rowName(row, '描述/效果', '描述', '效果'),
      类别: rowName(row, '类别'),
      数据库记录ID: record.id,
    };
  }
  if (Object.keys(inventory).length) legacy.系统.持有物品 = inventory;

  const skills = rowsByName(snapshot, SHEET_NAMES.skills);
  if (skills.length) legacy.系统.主角技能 = skills;

  for (const record of sheetByName(snapshot, SHEET_NAMES.tasks)?.rows || []) {
    const row = record.values;
    const name = rowName(row, '任务名称', '名称');
    if (!name) continue;
    const condition = rowName(row, '详细描述', '完成条件', '描述');
    const progress = rowName(row, '当前进度', '状态');
    const reward = Number(row?.奖励星光点 ?? row?.奖励);
    legacy.任务[name] = {
      ...clone(row),
      任务: name,
      ...(condition ? { 完成条件: condition } : {}),
      ...(progress ? { 已完成: /^(?:已完成|完成|completed|done)$/iu.test(progress) } : {}),
      ...(Number.isFinite(reward) ? { 奖励星光点: reward } : {}),
      数据库记录ID: record.id,
      数据来源: '数据库',
    };
  }

  const summaries = rowsByName(snapshot, SHEET_NAMES.summaries);
  if (summaries.length) legacy.系统._数据库总结 = summaries;
  const outline = rowsByName(snapshot, SHEET_NAMES.outline);
  if (outline.length) legacy.系统._数据库总体大纲 = outline;

  return {
    snapshot,
    legacy,
    metadata: {
      available: true,
      schemaVersion: 1,
      adapter: 'AutoCardUpdaterAPI',
      signature: snapshot.signature,
      sheetCount: snapshot.sheets.length,
      rowCount: snapshot.sheets.reduce((total, sheet) => total + sheet.rows.length, 0),
      sheets: snapshot.sheets.map((sheet) => ({ key: sheet.key, uid: sheet.uid, name: sheet.name, rowCount: sheet.rows.length })),
    },
  };
}

export const DATABASE_STANDARD_SHEETS = SHEET_NAMES;
