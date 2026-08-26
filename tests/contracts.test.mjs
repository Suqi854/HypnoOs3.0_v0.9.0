import test from 'node:test';
import assert from 'node:assert/strict';
import * as contracts from '../src/contracts.js';
import { createDefaultRole, createDefaultState, fromLegacyVariables, makeOperation, normalizeRolePack, toLegacyVariables } from '../src/contracts.js';
import { findLegacyVariables, fromLegacyVariables as fromLegacyVariablesDirect, mergeLegacyVariables, toLegacyVariables as toLegacyVariablesDirect } from '../src/legacy-adapter.js';
import { makeOperation as makeOperationDirect } from '../src/operation-contract.js';
import { normalizeProfile as normalizeProfileDirect } from '../src/profile-contract.js';
import { getRegionPack } from '../src/regions.js';
import { createDefaultRole as createDefaultRoleDirect, normalizeRolePack as normalizeRolePackDirect } from '../src/role-contract.js';
import { createDefaultState as createDefaultStateDirect, normalizeState as normalizeStateDirect } from '../src/state-contract.js';

test('contracts barrel preserves the complete public API', () => {
  assert.deepEqual(Object.keys(contracts).sort(), [
    'createDefaultRole',
    'createDefaultState',
    'fromLegacyVariables',
    'makeOperation',
    'normalizeProfile',
    'normalizeRolePack',
    'normalizeState',
    'toLegacyVariables',
  ]);
  assert.strictEqual(contracts.createDefaultRole, createDefaultRoleDirect);
  assert.strictEqual(contracts.normalizeRolePack, normalizeRolePackDirect);
  assert.strictEqual(contracts.createDefaultState, createDefaultStateDirect);
  assert.strictEqual(contracts.normalizeState, normalizeStateDirect);
  assert.strictEqual(contracts.normalizeProfile, normalizeProfileDirect);
  assert.strictEqual(contracts.makeOperation, makeOperationDirect);
  assert.strictEqual(contracts.toLegacyVariables, toLegacyVariablesDirect);
  assert.strictEqual(contracts.fromLegacyVariables, fromLegacyVariablesDirect);
});

test('region defaults and legacy round trip preserve core state', () => {
  const region = getRegionPack('jp');
  const state = createDefaultState(region);
  const role = createDefaultRole('テスト');
  role.variables.core.favor = 42;
  state.roles[role.id] = role;
  state.resources.money = 1234;
  const next = fromLegacyVariables(toLegacyVariables(state), state, region);
  assert.equal(next.region, 'jp');
  assert.equal(next.resources.money, 1234);
  assert.equal(next.roles[role.id].variables.core.favor, 42);
});

test('legacy adapter unwraps runtime snapshots and preserves unrelated nested fields', () => {
  const wrapped = { mvu: { stat_data: { 系统: { MC能量: 7 } } } };
  assert.strictEqual(findLegacyVariables(wrapped), wrapped.mvu.stat_data);
  const merged = mergeLegacyVariables(
    { 第三方: { keep: true }, 系统: { 外部字段: '保留', MC能量: 1 }, 角色: { 甲: { 扩展字段: 9 } } },
    { 系统: { MC能量: 25 }, 角色: { 甲: { 好感度: 3 } } },
  );
  assert.deepEqual(merged, {
    第三方: { keep: true },
    系统: { 外部字段: '保留', MC能量: 25 },
    角色: { 甲: { 扩展字段: 9, 好感度: 3 } },
  });
});

test('contracts normalize custom namespace and operation metadata', () => {
  const role = normalizeRolePack({ name: '<A/B>', variables: { custom: { affinity: 'blue' } }, unknown: { keep: true } });
  assert.equal(role.name, 'A B');
  assert.equal(role.variables.custom.affinity, 'blue');
  assert.deepEqual(role.unknown, { keep: true });
  const operation = makeOperation({ sourceApp: 'work', command: '去打工', targetPaths: ['work'] });
  assert.equal(operation.schema, 'PendingOperation/v1');
  assert.equal(operation.reversible, true);
});
