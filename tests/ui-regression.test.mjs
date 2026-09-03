import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { PHONE_APPS } from '../src/apps.js';
import { getRegionPack } from '../src/regions.js';

const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const floatingHost = await readFile(new URL('../public/floating-bootstrap.js', import.meta.url), 'utf8');
const floatingCore = await readFile(new URL('../src/floating-host.js', import.meta.url), 'utf8');
const extensionCore = await readFile(new URL('../src/extension.js', import.meta.url), 'utf8');

function functionBody(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = html.indexOf('\n  function ', start + 1);
  return html.slice(start, next < 0 ? html.length : next);
}

function functionBodyFrom(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const next = source.indexOf('\n    function ', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function evaluateUiFunction(name) {
  const context = {};
  vm.runInNewContext(`${functionBody(name)}; globalThis.result = ${name};`, context);
  return context.result;
}

test('critical phone apps remain registered under the existing 4.3 surface', () => {
  const ids = new Set(PHONE_APPS.map((app) => app.id));
  for (const id of ['hypnosis', 'profile-female', 'profile-male', 'calendar', 'timetable', 'achievements', 'map', 'work', 'monitor', 'encounter']) {
    assert.ok(ids.has(id), `missing critical app declaration: ${id}`);
  }
});

test('worldbook-backed apps keep their specialized 4.3 routes', () => {
  for (const route of [
    'window.__ST_OPEN_LITE_CALENDAR_APP__ = () => openLiteCalendarPage(null)',
    'window.__ST_OPEN_TIMETABLE_APP__ = () => openTimetablePage(null)',
    'window.__ST_OPEN_MAP_APP__ = () => openTodoPage(null, "map", "st-map-app", "地图", "", false)',
    'window.__ST_OPEN_SPECIAL_LOCATION_APP__ = () => openSpecialLocationPage(null)',
    'window.__ST_OPEN_MONITOR_APP__ = () => openMonitorPage(null)',
    'window.__ST_OPEN_WORK_APP__ = () => openWorkPage(null)',
    'window.__ST_OPEN_ENCOUNTER_APP__ = (tab) => openEncounterPage(null, tab)',
    'window.__ST_OPEN_REWARD_APP__ = () => openRewardPage(null)',
    'window.__ST_OPEN_HYPNOSIS_LITE_APP__ = () => openHypnosisLitePage()',
    'window.__ST_OPEN_DATABASE_APP__ = () => openDatabasePage()',
  ]) assert.ok(html.includes(route), `specialized route changed: ${route}`);
});

test('settings worldbook overwrite replaces old managed line entries only on explicit request', () => {
  const settingsOverwrite = functionBody('settingsOverwriteLineWorldbooks');
  const insert = functionBody('encounterInsertPackageWorldbooks');
  const helper = functionBody('encounterInsertEntriesWithTavernHelper');
  const native = functionBody('encounterInsertEntriesWithSillyTavernModule');
  assert.ok(settingsOverwrite.includes('{ overwrite: true }'));
  assert.ok(insert.includes('options = {}'));
  assert.ok(helper.includes('options.overwrite === true'));
  assert.ok(native.includes('options.overwrite === true'));
  assert.ok(html.includes('用当前版本替换同名旧条目'));
});

test('legacy people are cleared before encounter rendering while imports remain available', () => {
  const encounter = functionBody('openEncounterPage');
  assert.ok(encounter.indexOf('await encounterResetLibraryFor070Once()') < encounter.indexOf('renderEncounterPage(page)'));
  assert.ok(html.includes('data-encounter-action="import-library"'));
  assert.ok(html.includes('data-encounter-action="import-role-json"'));
});

test('normal hospitals remain locations but the removed hospital line has no entry route', () => {
  assert.ok(getRegionPack('cn').locations.some((item) => item.name === '医院'));
  assert.ok(getRegionPack('jp').locations.some((item) => item.name === '病院'));
  assert.ok(html.includes('{ id: "general-hospital", label: "综合医院"'));
  assert.ok(!html.includes('row: 2, enter: "hospital"'));
  assert.ok(!html.includes('hospital: settingsLineStageValue(ST_HOSPITAL_LINE_KEY)'));
});

test('bad-record entrances stay removed without deleting legacy migration readers', () => {
  assert.ok(html.includes('const PERSON_PROFILE_CONFIDENTIAL_TABS = ["sensitivity", "effects", "remodel"]'));
  assert.ok(!html.includes('data-profile-action="bad-records"'));
  assert.ok(!html.includes('data-profile-locked-bad-records'));
  assert.ok(html.includes('function migrateLegacyProfileBadRecordState(page)'));
});

test('fixed special locations cannot replace the selected-worldbook catalog', () => {
  const catalog = functionBody('specialLocationCatalog');
  assert.ok(catalog.includes('adaptiveSpecialLocationItems()'));
  assert.ok(!catalog.includes('SPECIAL_LOCATION_STATIC_ITEMS'));
  assert.ok(!catalog.includes('specialLocationDynamicItems'));
  assert.ok(html.includes('specialLocations: { title: "特殊地点"'));
});

test('help moves below worldbook adaptation data and keeps the requested notice', () => {
  const settings = functionBody('renderSettingsPage');
  assert.ok(settings.includes('data-settings-tab="general"'));
  assert.ok(settings.includes('data-settings-tab="models"'));
  assert.ok(settings.includes('data-settings-tab="logs"'));
  assert.ok(settings.includes('settingsTab === "logs" ? renderDiagnosticLogs() : settingsTab === "models" ? renderModelConnectorSettings(page)'));
  assert.ok(settings.indexOf('<h3>世界书适配数据</h3>') < settings.indexOf('renderSettingsHelpSection(page)'));
  assert.ok(html.includes('data-settings-action="toggle-help"'));
  assert.ok(html.includes('aria-controls="st-settings-help-content"'));
  assert.ok(html.includes('function removeHomeHelpTile()'));
  assert.ok(html.includes('body: "本插件基于二创改编，原作者：Ramiel；二改作者：louisHM；本插件作者SuQi"'));
  assert.ok(!html.includes('title: "社区提醒"'));
  assert.ok(!html.includes('ST_HOME_AUTHOR_STATUS'));
  assert.ok(!html.includes('st-home-author-status'));
  assert.ok(!html.includes('timeText: \\"Ramiel\\"'));
});

test('information app selects six pets and toggles floating or wand storage mode', async () => {
  const petPanel = html.indexOf('<h3>桌宠人物</h3>');
  const modePanel = html.indexOf('<h3>桌宠模式</h3>');
  const floorPanel = html.indexOf('<h3>变量楼层</h3>');
  assert.ok(petPanel >= 0 && petPanel < modePanel && modePanel < floorPanel, '桌宠模式按钮没有位于桌宠人物与变量楼层之间');
  assert.ok(html.includes('grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,44px)'));
  assert.ok(html.includes('data-information-pet=') && html.includes('aria-pressed='));
  assert.ok(html.includes('__ST_HYPNOOS_SELECT_INFORMATION_PET__'));
  assert.ok(html.includes('__ST_HYPNOOS_TOGGLE_INFORMATION_PET_MODE__'));
  assert.ok(!html.includes('data-information-action="pet">切换人物'));

  const expected = [
    ['miku', '初音未来'], ['rem', '蕾姆'], ['mai', '樱岛麻衣'],
    ['umaru', '土间埋'], ['alisa', '爱丽莎'], ['hyakka', '千杀百花'],
  ];
  for (const [id, name] of expected) {
    assert.ok(floatingHost.includes(`${id}: "${name}"`), `桌宠列表缺少${name}`);
    await stat(new URL(`../public/assets/pet/v5/${id}/${id}-idle-v5.png`, import.meta.url));
  }
  for (const id of ['miku', 'rem', 'mai', 'umaru']) {
    const idle = await readFile(new URL(`../public/assets/pet/v5/${id}/${id}-idle-v5.png`, import.meta.url));
    const actions = [];
    for (const group of ['unique-a', 'unique-b', 'drag']) {
      const action = await readFile(new URL(`../public/assets/pet/v5/${id}/${id}-${group}-v5.png`, import.meta.url));
      assert.equal(action.equals(idle), false, `${id} 的 ${group} 仍然复制待机素材`);
      actions.push(action);
    }
    assert.equal(actions[0].equals(actions[1]), false, `${id} 的单击与长按素材仍然相同`);
    assert.equal(actions[1].equals(actions[2]), false, `${id} 的长按与拖拽素材仍然相同`);
  }
  assert.ok(floatingHost.includes('var petDisplayMode = "floating"'));
  assert.ok(floatingHost.includes('hypnoos-pet-wand-container'));
  assert.ok(floatingHost.includes('menu.lastElementChild !== wandPetEntry'));
  assert.ok(floatingHost.includes('launcher.hidden = stored'));
  assert.ok(floatingHost.includes('label.textContent = "催眠手机"'));
  assert.ok(floatingHost.includes('fa-mobile-screen-button extensionsMenuExtensionButton'));
  assert.ok(floatingHost.includes('if (stored && shellOpen) toggleShell(false)'));
  assert.ok(floatingHost.includes('toggleShell(!shellOpen)'));
  assert.ok(floatingHost.includes('petDisplayMode === "stored" && shellOpen'), '收纳模式缺少点击手机外部自动关闭');
  assert.ok(floatingHost.includes('path.indexOf(panel) >= 0'), '手机内部点击没有从自动收纳中排除');
  assert.ok(floatingHost.includes('node.getAttribute("data-phone-resize") !== null'), '左右缩放角没有从自动收纳中排除');
  assert.ok(floatingHost.includes('node.getAttribute("data-phone-drag") !== null'), '边框拖动条没有从自动收纳中排除');
  assert.ok(floatingHost.includes('path.indexOf(wandPetEntry) >= 0'), '魔法棒入口没有从自动收纳中排除');
  assert.ok(floatingHost.includes('if (nextName !== "idle" && !petReadyAssets.has(petStateAsset(nextName))) nextName = "idle"'));
  assert.ok(!floatingHost.includes('nextName !== "held_scared" && !petReadyAssets.has'));
  assert.ok(!floatingHost.includes('label.textContent = "桌宠 · " + name'));
  assert.ok(floatingHost.includes("<span class='pet-sprite'></span>"), '桌宠缺少单层清晰渲染');
  assert.ok(!floatingHost.includes('pet-sprite-underlay'), '完整桌宠素材仍被模糊补层重复渲染');
  assert.ok(floatingHost.includes("data-pet-state='unique_a'") && floatingHost.includes("data-pet-state='unique_b'") && floatingHost.includes("data-pet-state='held_scared'") && floatingHost.includes("data-pet-state='landing'"), '桌宠单击、长按、拖拽或落地缺少独立动画');
  for (const id of ['miku', 'rem', 'mai', 'umaru']) {
    for (const action of ['click', 'long', 'drag']) {
      assert.ok(floatingHost.includes(`@keyframes pet-${id}-${action}`), `${id} 缺少独立的 ${action} 动画`);
    }
    assert.ok(floatingHost.includes(`[data-pet-character='${id}'][data-pet-state='unique_a']`), `${id} 单击动作没有独立绑定`);
    assert.ok(floatingHost.includes(`[data-pet-character='${id}'][data-pet-state='unique_b']`), `${id} 长按动作没有独立绑定`);
    assert.ok(floatingHost.includes(`[data-pet-character='${id}'][data-pet-state='held_scared']`), `${id} 拖拽动作没有独立绑定`);
  }
  for (const id of ['alisa', 'hyakka']) {
    assert.ok(!floatingHost.includes(`[data-pet-character='${id}'][data-pet-state=`), `${id} 的 4.3 动作不应被新增覆盖`);
  }
  assert.ok(floatingHost.includes('petMotionFrame = requestFrame(advancePetFrame)'), '桌宠帧动画没有使用浏览器动画帧调度');
  assert.ok(floatingHost.includes('host.requestAnimationFrame.bind(host)'), '动画帧调度仍被限制在局部作用域或丢失宿主绑定');
  assert.ok(!floatingHost.includes('if (event.pointerType !== "mouse") {\n        var longPressPointerId'), '桌宠长按仍仅支持触屏');
});

test('database app reads the external table runtime without changing the existing home UI', () => {
  assert.ok(PHONE_APPS.some((item) => item.id === 'database' && item.label === '数据库'));
  const page = functionBody('renderDatabasePage');
  assert.ok(page.includes('getDatabaseSnapshot'));
  assert.ok(page.includes('数据库已连接'));
  assert.ok(page.includes('data-database-sheet'));
  assert.ok(html.includes('function patchDatabaseTile()'));
  assert.ok(html.includes('setHomeTileLabel(tile, "数据库")'));
});

test('database owns profile visibility only when its character sheet has records', () => {
  const hasDatabaseProfiles = evaluateUiFunction('hasDatabaseProfileSource');
  const source = (rowCount) => ({ 系统: { _hypnoos数据库: { available: true, sheets: [{ name: '重要人物表', rowCount }] } }, 角色: {} });
  assert.equal(hasDatabaseProfiles(source(0)), false);
  assert.equal(hasDatabaseProfiles(source(2)), true);
  assert.equal(hasDatabaseProfiles({ 系统: { _hypnoos数据库: { available: true } }, 角色: { 旧版人物: { 自定义: { 数据来源: '数据库' } } } }), true);
});

test('custom connector accepts structured text returned in reasoning fields', () => {
  const extractText = evaluateUiFunction('independentConnectorTextContent');
  const payload = '{"apps":{"map":[]}}';
  assert.equal(extractText({ choices: [{ message: { content: null, reasoning_content: payload } }] }), payload);
  assert.equal(extractText({ choices: [{ message: { content: 'normal', reasoning_content: payload } }] }), 'normal');
});

test('model requests stop waiting and report a bounded timeout', async () => {
  const timeoutSource = functionBody('runModelRequestWithTimeout');
  assert.ok(timeoutSource.includes('Promise.race'));
  assert.ok(timeoutSource.includes('controller.abort()'));
  assert.ok(timeoutSource.includes('连接超时'));
  assert.ok(functionBody('invokeIndependentTextModel').includes('runModelRequestWithTimeout'));
  assert.ok(functionBody('extractProfileRolesWithModel').includes('runModelRequestWithTimeout'));
  const context = {
    AbortController,
    clearTimeout,
    setTimeout,
    window: { clearTimeout, setTimeout },
    __ST_HYPNOOS_MODEL_REQUEST_TIMEOUT_MS__: 1000,
  };
  vm.runInNewContext(`${functionBody('modelRequestTimeoutMs')}\n${timeoutSource.replace(/^function /, 'async function ')}; globalThis.run = runModelRequestWithTimeout;`, context);
  await assert.rejects(
    context.run(() => new Promise(() => {}), { label: '测试模型' }),
    /测试模型连接超时（1秒）/,
  );
});

test('phone resize is frame-coalesced without forced layout reads per pointer move', () => {
  const moveStart = floatingHost.indexOf('function moveResize(event)');
  const moveEnd = floatingHost.indexOf('function endResize(event)', moveStart);
  const move = floatingHost.slice(moveStart, moveEnd);
  const flushStart = floatingHost.indexOf('function flushResizeFrame()');
  const flushEnd = floatingHost.indexOf('function endResize(event)', flushStart);
  const flush = floatingHost.slice(flushStart, flushEnd);
  assert.ok(move.includes('resizeAnimationFrame = requestFrame(flushResizeFrame)'));
  assert.ok(!move.includes('getBoundingClientRect'));
  assert.ok(floatingHost.includes('transform:translateZ(0) scale(var(--phone-scale))'), '缩放没有作用于整个手机容器');
  assert.ok(!floatingHost.includes('.phone-wrap{position:absolute;z-index:4;left:0;top:0;width:430px;height:812px;border:1px solid rgba(221,184,255,.3);border-radius:inherit;background:transparent;box-shadow:0 20px 60px rgba(0,0,0,.42);overflow:hidden;isolation:isolate;transform:scale'), '仍在只缩放手机内层');
  assert.ok(flush.includes('(horizontal * 430 + vertical * 812) / (430 * 430 + 812 * 812)'), '缩放仍会在横轴与纵轴之间跳变');
  assert.ok(flush.includes('width: Math.max(1, 430 * scale)'));
  assert.ok(flush.includes('clampPosition(x, resizeState.top, size)'));
});

test('mobile keyboard keeps the phone stable while a text field is active', () => {
  const activeInput = functionBodyFrom(floatingHost, 'phoneHasActiveTextInput');
  const bindEditing = functionBodyFrom(floatingHost, 'bindPhoneTextEditingState');
  const updatePanel = functionBody('updateOperationSidePanel');
  const bindPanel = functionBody('bindOperationSidePanel');
  assert.ok(activeInput.includes('frame.contentDocument.activeElement'));
  assert.ok(activeInput.includes('phoneTextEditing'));
  assert.ok(activeInput.includes('tagName === "TEXTAREA"'));
  assert.ok(bindEditing.includes('doc.addEventListener("focusin"'));
  assert.ok(bindEditing.includes('doc.addEventListener("focusout"'));
  assert.ok(bindEditing.includes('}, 600)'));
  assert.ok(floatingHost.includes('if (phoneHasActiveTextInput()) return'));
  assert.ok(updatePanel.includes('document.activeElement?.closest?.("[data-operation-note]")'));
  assert.ok(updatePanel.includes('if (activeNote && panel.contains(activeNote)) return'));
  assert.ok(bindPanel.includes('writeOperationPanelNote(noteInput.value, { emit: false })'));
  assert.ok(!bindPanel.includes('writeOperationPanelNote(noteInput.value, { emit: true })'));
});

test('turn input exposes hypnosis text and grows downward from a 50px double-size field', () => {
  const details = functionBody('operationPanelItemDetailsHtml');
  const resize = functionBody('resizeOperationNoteInput');
  const prepare = functionBody('prepareOperationNoteDownwardGrowth');
  const bindPanel = functionBody('bindOperationSidePanel');
  assert.ok(html.includes('record.details?.["催眠指令"] ?? record.details?.["功能列表"]'));
  assert.ok(html.includes('["完整催眠指令", commandText]'));
  assert.ok(html.includes('detailLabel: isHypnosisCommand ? "查看完整催眠指令" : "查看完整内容"'));
  assert.ok(details.includes('item?.detailLabel || "查看完整内容"'));
  assert.ok(html.includes('height:50px;min-height:50px;max-height:none;resize:none;overflow-y:hidden'));
  assert.ok(html.includes('font:22px/1.65'));
  assert.ok(resize.includes('Math.max(50, Math.ceil(Number(input.scrollHeight || 0)))'));
  assert.ok(prepare.includes('list.style.flex = "0 0 " + listHeight + "px"'));
  assert.ok(prepare.includes('panel.style.setProperty("height", "auto", "important")'));
  assert.ok(bindPanel.includes('resizeOperationNoteInput(noteInput)'));
  assert.ok(bindPanel.includes('panel.addEventListener("pointerdown"'));
  assert.ok(bindPanel.includes('operationPanelOpenDetailIds.add(detailId)'));
});

test('model connector explains SiliconFlow balance failures', () => {
  assert.ok(html.includes('function normalizeConnectorProviderError(value)'));
  assert.ok(html.includes('硅基流动账户余额不足，请充值当前 API 密钥所属账户，或更换有余额的 API 密钥。'));
  assert.ok(html.includes('return prefix + normalizeConnectorProviderError(detail)'));
  assert.ok(html.includes('"文生文插头代理失败：" + normalizeConnectorProviderError(message)'));
  assert.ok(html.includes('if (responseData?.error) throw new Error("文生文插头返回错误：" + normalizeConnectorProviderError'));
  assert.ok(html.includes('data-connector-preset-new'));
  assert.ok(html.includes('data-connector-preset-select'));
  assert.ok(html.includes('data-connector-preset-delete'));
  assert.ok(html.includes('function deleteModelConnectorPreset(presetId)'));
  assert.ok(html.includes('hypnoos:model-connectors:persistent-secret:v2:'));
  assert.ok(html.includes('localStorage.setItem(ST_MODEL_CONNECTOR_SECRET_PREFIX + id, legacy)'));
  assert.ok(html.includes('保存后会随此预设持久保留'));
});

test('chaos forum keeps the original surface with bounded model-driven updates', () => {
  const app = PHONE_APPS.find((item) => item.id === 'mc-anon');
  assert.equal(app?.label, '混沌心海');
  assert.ok(html.includes('data-mchan-action="refresh"'));
  assert.ok(html.includes('aria-label="手动更新混沌心海"'));
  assert.ok(html.includes('CHAOS_FORUM_THREAD_LIMIT = 20'));
  assert.ok(html.includes('CHAOS_FORUM_ROUND_EVENT = "HYPNOOS3_DIALOGUE_ROUND_ENDED"'));
  assert.ok(html.includes('refreshChaosForumFromModel({ manual: false })'));
  assert.ok(html.includes('globalThis.generateRaw({ prompt, systemPrompt: system'));
  assert.ok(html.includes('.slice(0, CHAOS_FORUM_THREAD_LIMIT)'));
});

test('monitor preserves three gates while consuming generated worldbook locations and arrangements', () => {
  const monitor = functionBody('renderMonitorPage');
  assert.ok(monitor.includes('const monitorRecords = monitorAdaptiveRecords()'));
  assert.ok(monitor.includes('monitorRecordForGate(index, monitorRecords)'));
  assert.ok(monitor.includes('placeholder="\' + escapeAttr(monitorPlan.arrangement)'));
  assert.ok(html.includes('工作地点: monitorPlan.location'));
  assert.ok(html.includes('地点安排: monitorPlan.arrangement'));
  assert.ok(html.includes('normalizeMonitorDispatchWorkText(rawWorkText, monitorPlan.arrangement)'));
  assert.ok(!html.includes('工作地点: "私立斋明学园男厕（学校男生很少，平时基本没人）"'));
  assert.ok(html.includes('监控必须生成3至6个彼此不同的地点'));
});

test('VIP3 hypnosis trigger stays first and keeps its four-part placeholder hint', () => {
  const triggerIndex = html.indexOf('["vip3_hypnosis_trigger","VIP3","催眠扳机"');
  const formerFirstIndex = html.indexOf('["vip3_forced","VIP3","强制高潮"');
  assert.ok(triggerIndex >= 0 && triggerIndex < formerFirstIndex);
  assert.ok(html.includes('"ONE_TIME",1000'));
  assert.ok(html.includes('催眠者可为目标角色植入词组、动作姿势或物品为催眠扳机；目标不会察觉，受到催眠扳机的刺激后进入预设状态。'));
  for (const marker of ['<span>催眠者</span>', '<span>目标角色</span>', 'placeholder="催眠者→目标角色→催眠扳机→效果"']) assert.ok(html.includes(marker), `missing trigger form part: ${marker}`);
  for (const field of ['triggerHypnotists', 'triggerStimuli']) assert.ok(html.includes(`data-hypnosis-trigger-field="${field}"`));
  assert.ok(!html.includes('data-hypnosis-trigger-field="triggerEffects"'));
  assert.ok(html.includes('永久催眠效果；无结束时间，直到明确解除或删除'));
  assert.ok(html.includes('hypnosisTriggerVariablePath(roleName, trigger)'));
  assert.ok(html.includes('parseHypnosisTriggerSpecification'));
});

test('hypnosis commands wait in phone input before host write or direct send', () => {
  assert.ok(html.includes('Promise.resolve(appendAppOperation(operationPayload))'));
  assert.ok(html.includes('APP操作已暂存，等待主界面确认'));
  assert.ok(html.includes('globalThis.__ST_HYPNOOS_WRITE_INPUT__(block, { append: false })'));
  assert.ok(html.includes('globalThis.__ST_HYPNOOS_DIRECT_SEND__(block)'));
  assert.ok(floatingHost.includes('globalThis.__ST_HYPNOOS_WRITE_INPUT__'));
  assert.ok(floatingCore.includes("const FRONTEND_REVISION = 'hypnoos3-1.0.0-turn-input-readable-v2'"));
  assert.ok(floatingHost.includes('overflow:visible;z-index:5;display:none'));
  assert.ok(floatingCore.includes("scriptUrl.searchParams.set('revision', FRONTEND_REVISION)"));
  assert.ok(floatingCore.includes('script.dataset.revision = FRONTEND_REVISION'));
  assert.ok(floatingHost.includes('writeInput: function (text, options) { return callApi("setInput", [text, options]); }'));
  assert.ok(floatingCore.includes('this.host.setInput(command, { append: false })'));
});

test('chat switching restores scoped world data only after the full phone save is ready', () => {
  assert.ok(html.includes('function adaptiveRegionKey()'));
  assert.ok(html.includes('ST_ADAPTIVE_REGION_PREFIX + ":" + adaptiveStorageScope()'));
  assert.ok(html.includes('localStorage.setItem(adaptiveRegionKey(), value)'));
  assert.ok(html.includes('function refreshOpenChatBoundApps()'));
  for (const renderer of ['renderLiteCalendarPage(page)', 'renderTimetablePage(page)', 'renderMonitorPage(page)', 'renderWorkPage(page)', 'renderRewardPage(page)', 'renderMapPage(page)', 'renderAdaptiveWorldApp(page)', 'renderDatabasePage(page)']) {
    assert.ok(html.includes(renderer), `missing chat-ready renderer: ${renderer}`);
  }
  assert.ok(floatingCore.includes("notifyChatReady(payload = {})"));
  assert.ok(floatingCore.includes("'HYPNOOS3_CHAT_CHANGED', { ...payload, ready: true }"));
  assert.ok(extensionCore.includes("this.floatingHost.notifyChatReady({ contextKey: this.host.contextKey() })"));
});

test('hypnosis target selection does not rerender the long command page', () => {
  const render = functionBody('renderHypnosisLitePage');
  const selectionStart = render.indexOf('"[data-hypnosis-select-option]"');
  const selectionEnd = render.indexOf('"[data-hypnosis-tier-details]"', selectionStart);
  const selectionBinding = render.slice(selectionStart, selectionEnd);
  assert.ok(selectionBinding.includes('updateDraft((draft) =>'));
  assert.ok(!selectionBinding.includes('rerenderPreservingScroll()'));
});

test('cheat mode writes finite refillable resources without intercepting commands', () => {
  const grant = functionBody('settingsGrantCheatResources');
  const payload = functionBody('settingsApplyCheatOperationPayload');
  const prepare = functionBody('settingsPrepareCheatMutation');
  const information = functionBody('informationValue');
  const setStarlight = functionBody('encounterSetStarlight');
  const deductStarlight = functionBody('encounterDeductStarlight');
  assert.ok(html.includes('const SETTINGS_CHEAT_RESOURCE_VALUE = 99999999'));
  assert.ok(html.includes('const SETTINGS_CHEAT_MODE_STORAGE_KEY = SETTINGS_CHEAT_MODE_STORAGE_PREFIX + "phone"'));
  assert.ok(grant.includes('__ST_HYPNOOS_GRANT_CHEAT_RESOURCES__'));
  assert.ok(floatingHost.includes('__ST_HYPNOOS_GRANT_CHEAT_RESOURCES__'));
  assert.ok(floatingCore.includes('grantCheatResources(value)'));
  assert.ok(grant.includes('rewardApplySystemMutation'));
  assert.ok(grant.includes('system[key] = SETTINGS_CHEAT_RESOURCE_VALUE'));
  assert.ok(payload.includes('return payload'));
  assert.ok(!payload.includes('作弊模式资源规则'));
  assert.ok(prepare.includes('return () => {}'));
  assert.ok(html.includes('再次获取资源'));
  assert.ok(!html.includes('∞'));
  assert.ok(!html.includes('if (!settingsCheatModeActive() && money < costMoney)'));
  assert.ok(!html.includes('if (!settingsCheatModeActive() && current < cost)'));
  assert.ok(!html.includes('if (!settingsCheatModeActive()) data.stat["系统"]["星光点"]'));
  assert.ok(!setStarlight.includes('settingsCheatModeActive'));
  assert.ok(!deductStarlight.includes('settingsCheatModeActive'));
  assert.ok(!information.includes('settingsCheatModeActive'));
});

test('pending input keeps frontend operations above the player turn text', () => {
  const pendingStart = html.indexOf('const buildPendingOperationText =');
  const pendingEnd = html.indexOf('const stripOperationBlocks =', pendingStart);
  const pending = html.slice(pendingStart, pendingEnd);
  assert.ok(pending.indexOf('parts.push(buildOperationBlock(entries))') < pending.indexOf('parts.push(playerInput)'));
  assert.ok(html.includes('const next = base ? block + "\\n" + base : block;'));
  assert.ok(html.includes('const next = base ? block + "\\n" + base.replace(/\\s*$/, "") : block;'));
});

test('hypnosis and MC recharge quotes use the canonical rule bridge', () => {
  assert.ok(html.includes('__ST_HYPNOOS_CALCULATE_COST__?.(feature.id'));
  assert.ok(html.includes('__ST_HYPNOOS_CALCULATE_MC_RECHARGE__?.({ quantity, currentEnergy, maxEnergy, fatigued })'));
  assert.ok(html.includes('容量修正: quote.billedQuantity < quote.requestedQuantity'));
  assert.ok(floatingHost.includes('__ST_HYPNOOS_CALCULATE_COST__'));
  assert.ok(floatingHost.includes('__ST_HYPNOOS_CALCULATE_MC_RECHARGE__'));
  assert.ok(floatingCore.includes('calculateMcEnergyRecharge(options)'));
});

test('profile removal clears only phone-side profile data and hides the whole dossier', () => {
  const remove = functionBody('deleteProfileRoleData');
  assert.ok(remove.includes('ST_LOCKED_PROFILE_ROLES.has(name)'));
  assert.ok(!remove.includes('encounterCurrentMvuData'));
  assert.ok(!remove.includes('encounterReplaceMvuData'));
  assert.ok(!remove.includes('requireWritablePhoneFloor'));
  assert.ok(remove.includes('removeImportedProfileWorldbookRole(name)'));
  assert.ok(remove.includes('dismissProfileRoleName(name)'));
  assert.ok(remove.includes('removeFavoriteRoleName(name)'));
  assert.ok(remove.includes('profileClearLocalPhotoSlots(name)'));
  assert.ok(!remove.includes('appendAppOperation'));
  const roles = functionBody('getStatsRoles');
  assert.ok(roles.includes('hasDatabaseProfileSource(variables)'));
  assert.ok(roles.includes('? { ...mvuRoles }'));
  assert.ok(roles.includes('delete visibleRoles[name]'));
  assert.ok(html.includes('确认移除'));
  assert.ok(!html.includes('确认请求 AI 删除'));
  assert.ok(html.includes('不会删除世界书条目或角色变量'));
  assert.ok(html.includes('restoreDismissedProfileRoleNames(Object.keys(roles))'));
  const binding = functionBody('bindPersonProfileActionButtons');
  assert.ok(binding.includes('button.addEventListener("pointerup"'));
  assert.ok(binding.includes('button.addEventListener("pointerdown"'));
  assert.ok(binding.includes('button.addEventListener("mousedown"'));
  assert.ok(binding.includes('button.addEventListener("touchstart"'));
  assert.ok(binding.includes('button.addEventListener("keydown"'));
  assert.ok(binding.includes('data-profile-delete-dialog-direct-bound') || binding.includes('profileDeleteDialogDirectBound'));
  assert.ok(binding.includes('void confirmProfileDeleteDialog(page)'));
});

test('profile roles are isolated per chat and technical worldbook entries are rejected', () => {
  const scope = functionBody('adaptiveStorageScope');
  const refresh = functionBody('refreshAdaptiveWorldbookRoleCache');
  const filter = functionBody('isProfileWorldbookTechnicalName');
  assert.ok(scope.includes('__ST_HYPNOOS_CHAT_STORAGE_SCOPE__'));
  assert.ok(scope.includes('__ST_HYPNOOS_FRONTEND_SLOT_SCOPE__'));
  assert.ok(refresh.includes('const scope = adaptiveStorageScope()'));
  for (const label of ['初始化', 'APP操控', '更新格式']) assert.ok(filter.includes(label));
  assert.ok(html.includes('if (!gender || isProfileWorldbookTechnicalName(name)) continue'));
  assert.ok(html.includes('if (!name || isProfileWorldbookTechnicalName(name)) continue'));
  assert.ok(html.includes('const DEFAULT_ROLE_NAMES = ["九鬼真白"]'));
});

test('avatar library applies uploaded images through host-safe controls', () => {
  const binding = functionBody('bindAvatarLibraryActivation');
  assert.ok(binding.includes('button.addEventListener("mousedown"'));
  assert.ok(binding.includes('button.addEventListener("touchstart"'));
  assert.ok(binding.includes('button.addEventListener("keydown"'));
  assert.ok(binding.includes('button.addEventListener("click"'));
  const render = functionBody('renderAvatarLibraryPage');
  assert.ok(render.includes('bindAvatarLibraryActivation(page.querySelector(\'[data-avatar-upload]\')'));
  assert.ok(render.includes('bindAvatarLibraryActivation(button, async () =>'));
  assert.ok(render.includes('profileSaveLocalPhoto(selectedRole, source)'));
});

test('profile photo area opens photo folder; folder slots open the avatar library floating window', () => {
  const picker = functionBody('renderProfileAvatarLibraryPicker');
  const open = functionBody('openProfileAvatarLibraryPicker');
  const profilePage = functionBody('bindPersonProfileEvents');
  assert.ok(open.includes('data-profile-avatar-library-picker'));
  assert.ok(open.includes('renderProfileAvatarLibraryPicker(page, picker, index)'));
  assert.ok(picker.includes('readAvatarLibraryIndex()'));
  assert.ok(picker.includes('profileGetPhotoStorageIdb(avatarLibraryImageKey'));
  assert.ok(picker.includes('profileSetPhotoSlotLive(page, index, source)'));
  assert.ok(picker.includes('importAvatarLibraryFiles(files)'));
  assert.ok(picker.includes('bindAvatarLibrarySelectionActivation(button, async () =>'));
  assert.ok(picker.includes('option.classList.toggle("is-selected", selected)'));
  const liveSelection = picker.slice(picker.indexOf('profileSetPhotoSlotLive(page, index, source)'), picker.indexOf('}));', picker.indexOf('profileSetPhotoSlotLive(page, index, source)')));
  assert.ok(!liveSelection.includes('renderProfileAvatarLibraryPicker'));
  assert.ok(picker.includes('data-profile-avatar-library-confirm'));
  assert.ok(!picker.includes('data-profile-avatar-library-photo-folder'));
  assert.ok(open.includes('findPhoneRoot(page)'));
  assert.ok(open.includes('if (current && Number(page.dataset.profileAvatarLibrarySlot || 0) === index) return'));
  assert.ok(open.includes('lockProfileAvatarLibraryPointer(page)'));
  assert.ok(!html.includes('function openProfilePhotoAvatarPicker'));
  const directActions = functionBody('bindPersonProfileActionButtons');
  assert.ok(!directActions.includes('bindAvatarLibraryActivation(button, () => openProfilePhotoDialog(page))'));
  assert.ok(profilePage.includes('if (action === "pick" || action === "select") openProfileAvatarLibraryPicker(page, slot)'));
  assert.ok(profilePage.includes('if (action === "local")'));
  assert.ok(!profilePage.includes('if (action === "change") openProfileAvatarLibraryPicker'));
  const photoDialog = functionBody('renderProfilePhotoDialog');
  assert.ok(photoDialog.includes('data-profile-photo-action="pick"'));
  assert.ok(photoDialog.includes('data-profile-photo-action="local"'));
  assert.ok(photoDialog.includes('data-profile-photo-action="select"'));
  assert.ok(photoDialog.includes('data-profile-photo-slot-cell="'));
  assert.ok(!photoDialog.includes('data-profile-photo-action="change"'));
  const profileAction = functionBody('runPersonProfileAction');
  assert.ok(profileAction.includes('if (action === "upload-photo")'));
  assert.ok(profileAction.includes('openProfilePhotoDialog(page)'));
  assert.ok(!profileAction.includes('openProfilePhotoAvatarPicker(page)'));
});

test('chat lifecycle clears stale profiles and no-chat map data', () => {
  const roles = functionBody('getStatsRoles');
  const graph = functionBody('loadStaticGraph');
  assert.match(html, /const __stHypnoosHasActiveChat = \(\) => \{/);
  assert.match(html, /getCurrentChatId/);
  assert.match(html, /context\?\.characterId/);
  assert.match(html, /__ST_HYPNOOS_HOST_HAS_ACTIVE_CHAT__/);
  assert.match(floatingHost, /hasApi\('hasActiveChat'\)/);
  assert.match(floatingCore, /hasActiveChat: \(\) => host\.hasActiveChat\(\)/);
  assert.match(html, /context\.chat\.length > 0/);
  assert.match(roles, /__ST_HYPNOOS_HAS_ACTIVE_CHAT__/);
  assert.match(graph, /__ST_HYPNOOS_HAS_ACTIVE_CHAT__/);
  assert.match(graph, /locations: \[\]/);
  assert.match(html, /chatRefreshToken/);
  assert.match(html, /refreshAdaptiveWorldbookRoleCache\(true\)/);
  assert.match(html, /refreshArchiveRoleSnapshotCache\(\)/);
  assert.match(html, /!hasDatabaseProfileSource\(\)/);
});

test('hypnosis placeholders are hints and trigger content is never parsed as syntax', () => {
  const parse = evaluateUiFunction('parseHypnosisTriggerSpecification');
  assert.deepEqual(
    { ...parse('123', '{{user}}', '数据库女角色') },
    { hypnotist: '{{user}}', target: '数据库女角色', trigger: '123', effect: '123' },
  );
  assert.deepEqual(
    { ...parse('口令→进入待命状态', '{{user}}', '数据库女角色') },
    { hypnotist: '{{user}}', target: '数据库女角色', trigger: '口令→进入待命状态', effect: '口令→进入待命状态' },
  );
  assert.deepEqual(
    { ...parse('{{user}}→数据库女角色→旧口令→旧效果', '备用施术者', '备用目标') },
    { hypnotist: '备用施术者', target: '备用目标', trigger: '{{user}}→数据库女角色→旧口令→旧效果', effect: '{{user}}→数据库女角色→旧口令→旧效果' },
  );
  const render = functionBody('renderHypnosisLitePage');
  assert.match(render, /missingContentFeature/);
  assert.match(render, /请填写「/);
  assert.ok(html.includes('detail["用户填写"] = trigger'));
});

test('archive worldbook binding stays optional in settings and remains reply-driven', () => {
  assert.ok(!html.includes('st-archive-bind-overlay'));
  assert.ok(!html.includes('__ST_ENSURE_ARCHIVE_BINDING_PROMPT__'));
  assert.ok(html.includes('data-settings-action="archive-create"'));
  assert.ok(html.includes('data-settings-action="archive-character"'));
  assert.ok(html.includes('data-settings-action="archive-migrate"'));
  assert.ok(html.includes('settingsTextPrompt(page, {'));
  assert.ok(html.includes('settingsSelectPrompt(page, {'));
  assert.ok(html.includes('title: "绑定角色卡世界书"'));
  assert.ok(html.includes('data-settings-archive-status'));
  assert.ok(html.includes('内置催眠规则已加载'));
  assert.ok(!html.includes('data-settings-archive-target'));
  assert.ok(html.indexOf('<h3>世界书绑定</h3>') < html.indexOf('<h3>档案</h3>'));
  assert.ok(html.includes('>新建专属世界书</button>'));
  assert.ok(html.includes('syncArchiveFromLatestReply({ knownRoles: archiveKnownRoleNames() })'));
  assert.ok(!functionBody('archiveConfigure').includes('syncArchiveFromLatestReply'));
  assert.ok(html.includes('await refreshArchiveRoleSnapshotCache()'));
  assert.ok(html.includes('function installGlobalButtonFeedback()'));
  assert.ok(html.includes('button:not(:disabled).st-button-feedback'));
  assert.ok(html.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(floatingHost.includes("'getArchiveWorldbookOptions','configureArchiveWorldbook'"));
  assert.ok(!floatingHost.includes('requestArchiveWorldbookAction'));
  assert.ok(!floatingHost.includes("'deleteWorldbook','configureArchiveWorldbook'"));
  assert.ok(!html.includes('以世界书与当前剧情为准'));
});

test('hypnosis start uses a touch-safe activation path before mobile blur rerenders', () => {
  const binding = functionBody('bindHypnosisStartActivation');
  const render = functionBody('renderHypnosisLitePage');
  assert.ok(binding.includes('button.addEventListener("pointerdown", activate)'));
  assert.ok(binding.includes('button.addEventListener("mousedown"'));
  assert.ok(binding.includes('button.addEventListener("touchstart"'));
  assert.ok(binding.includes('button.addEventListener("keydown"'));
  assert.ok(binding.includes('button.addEventListener("click", activate)'));
  assert.ok(binding.includes('now - lastActivationAt < 700'));
  assert.ok(binding.includes('result = handler()'));
  assert.ok(render.includes('bindHypnosisStartActivation(startButton, startHypnosis)'));
  assert.ok(render.includes('催眠操作暂存失败'));
});

test('raw operation containers use the built-in fold renderer without a SillyTavern regex', () => {
  assert.match(floatingHost, /ACTION_FOLD_RAW_RE\s*=\s*\/<\\s\*\(本轮/);
  assert.ok(floatingHost.includes('return source.includes(ACTION_FOLD_OPEN) || /<\\s*本轮(?:APP)?操作\\s*>/i.test(source)'));
  assert.ok(floatingHost.includes('var match = matchActionFold(source)'));
  assert.ok(floatingHost.includes('range.insertNode(createActionFoldCard(targetDocument, match.body))'));
  assert.ok(floatingHost.includes('label.textContent = "前端操作"'));
  assert.ok(floatingHost.includes('title.textContent = "本轮操作"'));
  assert.ok(floatingHost.includes('hint.textContent = "点击展开"'));
});
