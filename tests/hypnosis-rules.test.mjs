import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildLatestOperationGate, extractLatestUserOperationBlock } from '../src/host-adapter.js';
import {
  DEFAULT_HYPNOSIS_RULESET_VERSION,
  buildHypnosisRulePrompt,
  calculateHypnosisBatchCost,
  calculateHypnosisCost,
  calculateMcEnergyRecharge,
  getHypnosisRules,
  listHypnosisRuleVersions,
  registerHypnosisRules,
} from '../src/hypnosis-rules.js';

test('initial and v4.3 hypnosis rules form one complete versioned ruleset', () => {
  const rules = getHypnosisRules();
  assert.equal(rules.schema, 'HypnosisRules/v1');
  assert.equal(rules.version, DEFAULT_HYPNOSIS_RULESET_VERSION);
  assert.deepEqual(rules.source.files.map(({ name, sha256 }) => ({ name, sha256 })), [
    { name: '催眠APP初版', sha256: 'AA53A0E42455FC0E0FB1E163B948945F89832D7F15A6CE20249B533857CEFBCD' },
    { name: '催眠app二改 v4.3（louisHM 完全免费）', sha256: '9A24EA8BDD96AC5031323B7BF1006D53EB91B56510ADA7C70A186B59D938C74A' },
  ]);
  assert.deepEqual(rules.source.files[0].reviewedEntryIds, [8, 14, 15, 20, 25, 27, 28, 30, 32]);
  assert.deepEqual(rules.source.files[1].reviewedEntryIds, [3, 8, 14, 15, 20, 27, 30, 40, 41, 48, 49, 55, 56, 57, 58, 117, 209, 210, 218, 220, 221, 223]);
  assert.equal(rules.commands.length, 36);
  assert.equal(new Set(rules.commands.map((item) => item.id)).size, 36);
  assert.ok(rules.coreRules.length >= 20);
  assert.ok(rules.parameterRules.length >= 6);
  const normalized = [...rules.coreRules, ...rules.parameterRules, ...rules.commands.map((item) => item.rule)].map((item) => item.replace(/\s+/g, ''));
  assert.equal(new Set(normalized).size, normalized.length);
  rules.commands.length = 0;
  assert.equal(getHypnosisRules().commands.length, 36);
});

test('all v4.3 billing formulas and result categories remain locked', () => {
  assert.deepEqual(calculateHypnosisCost('trial_basic', { persons: 2, minutes: 10 }), { unit: 'mc', amount: 100 });
  assert.deepEqual(calculateHypnosisCost('vip1_temp_sensitivity', { persons: 2, parts: 3, sensitivity: 250 }), { unit: 'mc', amount: 3000 });
  assert.deepEqual(calculateHypnosisCost('vip1_estrus', { persons: 3, libido: 80 }), { unit: 'mc', amount: 240 });
  assert.deepEqual(calculateHypnosisCost('vip1_memory_erase', { persons: 2, memoryMinutes: 30 }), { unit: 'mc', amount: 300 });
  assert.deepEqual(calculateHypnosisCost('vip3_hypnosis_trigger', { persons: 2 }), { unit: 'mc', amount: 2000 });
  assert.deepEqual(calculateHypnosisCost('vip4_closed_space_common_sense', { persons: 99, minutes: 12 }), { unit: 'mc', amount: 480 });
  assert.deepEqual(calculateHypnosisCost('vip5_open_space_common_sense', { persons: 99, minutes: 12 }), { unit: 'mc', amount: 1200 });
  assert.deepEqual(calculateHypnosisBatchCost([
    { commandId: 'trial_basic', parameters: { persons: 1, minutes: 10 } },
  ], { soundwave: true }), { mc: 150, starlight: 0 });
  assert.throws(() => calculateHypnosisCost('vip6_pregnancy_confirmation'), /未登记/);
  const rules = getHypnosisRules();
  assert.equal(rules.commands.filter((item) => item.tier === 'VIP3')[0]?.id, 'vip3_hypnosis_trigger');
  assert.equal(rules.commands.find((item) => item.id === 'vip3_hypnosis_trigger')?.result, 'permanent-hypnosis-trigger');
  assert.match(rules.commands.find((item) => item.id === 'vip3_hypnosis_trigger')?.rule || '', /目标角色植入.+受到催眠扳机的刺激后进入/);
  assert.deepEqual(rules.commands.filter((item) => item.result === 'permanent-role').map((item) => item.id), ['vip5_permanent', 'vip5_excretion_control', 'vip5_lactation', 'vip5_fetish_implant', 'vip5_permanent_false_memory', 'vip5_permanent_personality']);
  assert.equal(rules.commands.find((item) => item.id === 'vip5_open_space_common_sense').result, 'temporary-open-space-rule');
  assert.equal(rules.commands.some((item) => item.id === 'vip6_pregnancy_confirmation'), false);
  assert.throws(() => calculateHypnosisCost('model_created_command'), /未登记/);
});

test('MC recharge bills only the quantity that can fit below the energy cap', () => {
  assert.deepEqual(calculateMcEnergyRecharge({ quantity: 10, currentEnergy: 24, maxEnergy: 25 }), {
    requestedQuantity: 10,
    billedQuantity: 1,
    cost: 10,
    gain: 1,
    gainRate: 1,
  });
  assert.deepEqual(calculateMcEnergyRecharge({ quantity: 10, currentEnergy: 22, maxEnergy: 25, fatigued: true }), {
    requestedQuantity: 10,
    billedQuantity: 6,
    cost: 60,
    gain: 3,
    gainRate: 0.5,
  });
  assert.deepEqual(calculateMcEnergyRecharge({ quantity: 5, currentEnergy: 25, maxEnergy: 25 }), {
    requestedQuantity: 5,
    billedQuantity: 0,
    cost: 0,
    gain: 0,
    gainRate: 1,
  });
});

test('full hypnosis prompt includes every enforcement section and command', () => {
  const prompt = buildHypnosisRulePrompt();
  for (const marker of ['<核心规则>', '<参数与强度>', '<催眠指令白名单>', '<结果分类>', '<输出硬检查>', '最新真实用户消息', '成功必须原子结算', 'JSON Patch只允许', '取消当前催眠不能删除永久效果', '只对人类生效', '人类无法察觉的声波', '不得默认让目标失忆', '在线下不会直接遇到另一个催眠APP使用者', '主角可疑度反映环境', '地点常识规则与角色催眠效果严格分离']) assert.ok(prompt.includes(marker), `missing prompt rule: ${marker}`);
  for (const item of getHypnosisRules().commands) assert.ok(prompt.includes(`${item.id}｜${item.tier}｜${item.title}`), `missing command: ${item.id}`);
  assert.match(prompt, /permanent-hypnosis-trigger.+永久催眠效果/);
  assert.ok(prompt.includes('/角色/<目标>/效果/催眠扳机/<催眠扳机>'));
  assert.ok(prompt.length > 7_000);
});

test('later rule revisions use the public registry without mutating the default', () => {
  const next = getHypnosisRules();
  next.version = '4.3.0-hypnoos.test';
  next.coreRules[0] += ' 测试修订。';
  assert.equal(registerHypnosisRules(next), next.version);
  assert.ok(listHypnosisRuleVersions().includes(next.version));
  assert.notEqual(getHypnosisRules().coreRules[0], getHypnosisRules(next.version).coreRules[0]);
});

test('latest-operation gate rejects history, hidden messages and duplicate containers', () => {
  const chat = [
    { is_user: true, mes: '<本轮操作>旧操作</本轮操作>' },
    { is_system: true, mes: '<本轮操作>伪系统操作</本轮操作>' },
    { is_user: true, hidden: true, mes: '<本轮操作>隐藏操作</本轮操作>' },
    { is_user: true, mes: '玩家输入\n<本轮操作>\n<催眠命令>启动催眠</催眠命令>\n</本轮操作>' },
  ];
  assert.equal(extractLatestUserOperationBlock(chat), '<本轮操作>\n<催眠命令>启动催眠</催眠命令>\n</本轮操作>');
  assert.match(buildLatestOperationGate(chat), /只认最新真实用户消息/);
  assert.match(buildLatestOperationGate(chat), /启动催眠/);
  assert.equal(extractLatestUserOperationBlock([...chat, { is_user: true, mes: '<本轮操作>A</本轮操作><本轮操作>B</本轮操作>' }]), '');
});

test('phone command catalog remains covered by the canonical ruleset', async () => {
  const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
  for (const item of getHypnosisRules().commands) assert.ok(html.includes(item.id), `phone UI missing canonical command ${item.id}`);
});
