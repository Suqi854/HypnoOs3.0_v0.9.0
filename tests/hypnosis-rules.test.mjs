import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { buildLatestOperationGate, extractLatestUserOperationBlock } from '../src/host-adapter.js';
import {
  DEFAULT_HYPNOSIS_RULESET_VERSION,
  buildHypnosisRulePrompt,
  calculateHypnosisBatchCost,
  calculateHypnosisCost,
  getHypnosisRules,
  listHypnosisRuleVersions,
  registerHypnosisRules,
} from '../src/hypnosis-rules.js';

test('v4.3 hypnosis ruleset is complete, versioned and immutable to callers', () => {
  const rules = getHypnosisRules();
  assert.equal(rules.schema, 'HypnosisRules/v1');
  assert.equal(rules.version, DEFAULT_HYPNOSIS_RULESET_VERSION);
  assert.equal(rules.source.sha256, '9A24EA8BDD96AC5031323B7BF1006D53EB91B56510ADA7C70A186B59D938C74A');
  assert.equal(rules.commands.length, 36);
  assert.equal(new Set(rules.commands.map((item) => item.id)).size, 36);
  assert.ok(rules.coreRules.length >= 20);
  assert.ok(rules.parameterRules.length >= 6);
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
  assert.deepEqual(rules.commands.filter((item) => item.result === 'permanent-role').map((item) => item.id), ['vip5_permanent', 'vip5_excretion_control', 'vip5_lactation', 'vip5_fetish_implant', 'vip5_permanent_false_memory', 'vip5_permanent_personality']);
  assert.equal(rules.commands.find((item) => item.id === 'vip5_open_space_common_sense').result, 'temporary-open-space-rule');
  assert.equal(rules.commands.some((item) => item.id === 'vip6_pregnancy_confirmation'), false);
  assert.throws(() => calculateHypnosisCost('model_created_command'), /未登记/);
});

test('full hypnosis prompt includes every enforcement section and command', () => {
  const prompt = buildHypnosisRulePrompt();
  for (const marker of ['<核心规则>', '<参数与强度>', '<催眠指令白名单>', '<结果分类>', '<输出硬检查>', '最新真实用户消息', '成功必须原子结算', 'JSON Patch只允许', '取消当前催眠不能删除永久效果']) assert.ok(prompt.includes(marker), `missing prompt rule: ${marker}`);
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
