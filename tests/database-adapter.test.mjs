import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDatabaseSnapshot, projectDatabaseSnapshot } from '../src/database-adapter.js';
import { mergeDatabaseSnapshotIntoState } from '../src/state-store.js';
import { createDefaultState } from '../src/contracts.js';
import { getRegionPack } from '../src/regions.js';

const raw = {
  mate: { version: 'spv8.9.1' },
  sheet_global: { uid: 1, name: '全局数据表', content: [['', '主角当前所在地点', '当前时间'], [1, '图书馆', '10:30']] },
  sheet_user: { uid: 2, name: '主角信息', content: [['', '人物名称', '性别/年龄', '外貌特征', '职业/身份', '过往经历', '性格特点'], [1, '玩家', '男/18', '黑发', '学生', '转学生', '冷静']] },
  sheet_roles: { uid: 3, name: '重要人物表', content: [['', '姓名', '性别/年龄', '外貌特征', '性格特点', '持有的重要物品', '好感度', '是否离场', '过往经历'], [7, '林遥', '女/18', '短发', '认真', '书签', 23, '否', '图书委员']] },
  sheet_inventory: { uid: 4, name: '背包物品表', content: [['', '物品名称', '数量', '描述/效果', '类别'], [9, '门卡', 1, '打开资料室', '钥匙']] },
  sheet_tasks: { uid: 5, name: '任务与事件表', content: [['', '任务名称', '任务类型', '发布者', '详细描述', '当前进度'], [11, '归还图书', '日常', '林遥', '把书放回书架', '进行中']] },
  sheet_summary: { uid: 6, name: '总结表', content: [['', '时间跨度', '纪要'], [13, '上午', '来到图书馆']] },
};

test('database export normalizes sheets and projects standard phone data', () => {
  const snapshot = normalizeDatabaseSnapshot(raw);
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.sheets.length, 6);
  assert.equal(snapshot.sheets[0].rows[0].values.主角当前所在地点, '图书馆');
  const projection = projectDatabaseSnapshot(snapshot);
  assert.equal(projection.legacy.系统.当前地点, '图书馆');
  assert.equal(projection.legacy.系统.当前时间, '10:30');
  assert.equal(projection.legacy.系统._user身份.人物名称, '玩家');
  assert.equal(projection.legacy.角色.林遥.好感度, 23);
  assert.equal(projection.legacy.系统.持有物品.门卡.数量, 1);
  assert.equal(projection.legacy.任务.归还图书.数据来源, '数据库');
  assert.equal(projection.metadata.sheetCount, 6);
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
  assert.equal(next.inventory.find((item) => item.id === '门卡').数量, 1);
  assert.equal(next.tasks.find((item) => item.id === '归还图书').数据来源, '数据库');
  assert.equal(next.custom.keep, '保留');
  assert.equal(next.custom.databaseSource.adapter, 'AutoCardUpdaterAPI');
});
