import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDatabaseSnapshot, projectDatabaseSnapshot } from '../src/database-adapter.js';
import { mergeDatabaseSnapshotIntoState } from '../src/state-store.js';
import { createDefaultRole, createDefaultState } from '../src/contracts.js';
import { getRegionPack } from '../src/regions.js';
import { toLegacyVariables } from '../src/legacy-adapter.js';

const raw = {
  mate: { version: 'spv8.9.1' },
  sheet_global: { uid: 1, name: '全局数据表', content: [['', '主角当前所在地点', '当前时间'], [1, '图书馆', '10:30']] },
  sheet_user: { uid: 2, name: '主角信息', content: [['', '人物名称', '性别/年龄', '外貌特征', '职业/身份', '过往经历', '性格特点'], [1, '玩家', '男/18', '黑发', '学生', '转学生', '冷静']] },
  sheet_roles: { uid: 3, name: '重要人物表', content: [['', '姓名', '性别/年龄', '外貌特征', '性格特点', '持有的重要物品', '好感度', '是否离场', '过往经历'], [7, '林遥', '女/18', '短发', '认真', '书签', 23, '否', '图书委员']] },
  sheet_skills: { uid: 7, name: '主角技能表', content: [['', '技能名称', '技能效果'], [8, '速读', '阅读更快']] },
  sheet_inventory: { uid: 4, name: '背包物品表', content: [['', '物品名称', '数量', '描述/效果', '类别'], [9, '门卡', 1, '打开资料室', '钥匙']] },
  sheet_tasks: { uid: 5, name: '任务与事件表', content: [['', '任务名称', '任务类型', '发布者', '详细描述', '当前进度'], [11, '归还图书', '日常', '林遥', '把书放回书架', '进行中']] },
  sheet_summary: { uid: 6, name: '总结表', content: [['', '时间跨度', '纪要'], [13, '上午', '来到图书馆']] },
  sheet_outline: { uid: 8, name: '总体大纲', content: [['', '阶段', '目标'], [14, '第一幕', '查明真相']] },
};

test('database export normalizes sheets and projects standard phone data', () => {
  const snapshot = normalizeDatabaseSnapshot(raw);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.sheets.length, 8);
  assert.equal(snapshot.sheets[0].rows[0].values.主角当前所在地点, '图书馆');
  const projection = projectDatabaseSnapshot(snapshot);
  assert.equal(projection.legacy.系统.当前地点, '图书馆');
  assert.equal(projection.legacy.系统.当前时间, '10:30');
  assert.equal(projection.legacy.系统._user身份.人物名称, '玩家');
  assert.equal(projection.legacy.角色.林遥.好感度, 23);
  assert.equal(projection.legacy.角色.林遥.信息.性别, '女');
  assert.equal(projection.legacy.角色.林遥.信息._年龄, '18');
  assert.equal(projection.legacy.角色.林遥.信息.外貌特征, '短发');
  assert.equal(projection.legacy.角色.林遥.状态.好感度, 23);
  assert.equal(projection.legacy.角色.林遥.事件.至关重要记忆, '图书委员');
  assert.equal(projection.legacy.角色.林遥.物品.持有.书签.数量, 1);
  assert.equal(projection.legacy.系统.持有物品.门卡.数量, 1);
  assert.equal(projection.legacy.系统.主角技能[0].技能名称, '速读');
  assert.equal(projection.legacy.系统._数据库总结[0].纪要, '来到图书馆');
  assert.equal(projection.legacy.系统._数据库总体大纲[0].目标, '查明真相');
  assert.equal(projection.legacy.任务.归还图书.数据来源, '数据库');
  assert.equal(projection.legacy.任务.归还图书.任务, '归还图书');
  assert.equal(projection.legacy.任务.归还图书.完成条件, '把书放回书架');
  assert.equal(projection.legacy.任务.归还图书.已完成, false);
  assert.equal(projection.metadata.sheetCount, 8);
});

test('database projection fills existing phone apps without deleting unrelated state', () => {
  const pack = getRegionPack('cn');
  const state = createDefaultState(pack);
  state.custom.keep = '保留';
  const next = mergeDatabaseSnapshotIntoState(state, raw, pack);
  assert.equal(next.location.current, '图书馆');
  assert.equal(next.time.clock, '10:30');
  assert.equal(next.custom.userIdentity.人物名称, '玩家');
  assert.equal(Object.values(next.roles).find((role) => role.name === '林遥').variables.compatibility.favor, 23);
  assert.equal(next.custom.legacyVariables.角色.林遥.信息.性别, '女');
  assert.equal(next.custom.databaseAppData.skills[0].技能名称, '速读');
  assert.equal(next.custom.databaseAppData.summaries[0].纪要, '来到图书馆');
  assert.equal(next.custom.databaseAppData.outline[0].目标, '查明真相');
  assert.equal(toLegacyVariables(next).系统.主角技能[0].技能名称, '速读');
  assert.equal(next.inventory.find((item) => item.id === '门卡').数量, 1);
  assert.equal(next.tasks.find((item) => item.id === '归还图书').数据来源, '数据库');
  assert.equal(next.custom.keep, '保留');
  assert.equal(next.custom.databaseSource.adapter, 'AutoCardUpdaterAPI');
});

test('temporarily empty database sheets do not erase previously imported phone data', () => {
  const pack = getRegionPack('cn');
  const state = createDefaultState(pack);
  const role = createDefaultRole('数据库人物');
  role.variables.extensions = { 数据来源: '数据库' };
  state.roles[role.id] = role;
  state.tasks = [{ id: '数据库任务', title: '数据库任务', 数据来源: '数据库' }];
  state.inventory = [{ id: '数据库物品', name: '数据库物品', 数量: 2 }];
  const empty = {
    mate: {},
    sheet_1: { name: '重要人物表', content: [['记录ID', '姓名']] },
    sheet_2: { name: '任务与事件表', content: [['记录ID', '任务名称']] },
    sheet_3: { name: '背包物品表', content: [['记录ID', '物品名称']] },
  };

  const next = mergeDatabaseSnapshotIntoState(state, empty, pack);
  assert.ok(Object.values(next.roles).some((item) => item.name === '数据库人物'));
  assert.ok(next.tasks.some((item) => item.id === '数据库任务'));
  assert.ok(next.inventory.some((item) => item.id === '数据库物品'));
  assert.equal(next.custom.databaseSource.rowCount, 0);
});
