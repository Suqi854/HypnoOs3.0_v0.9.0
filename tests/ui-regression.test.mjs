import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import test from 'node:test';

import { PHONE_APPS } from '../src/apps.js';
import { getRegionPack } from '../src/regions.js';

const html = await readFile(new URL('../ui/index.html', import.meta.url), 'utf8');
const floatingHost = await readFile(new URL('../public/floating-bootstrap.js', import.meta.url), 'utf8');
const floatingCore = await readFile(new URL('../src/floating-host.js', import.meta.url), 'utf8');

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
  assert.ok(floatingHost.includes('var petDisplayMode = "floating"'));
  assert.ok(floatingHost.includes('hypnoos-pet-wand-container'));
  assert.ok(floatingHost.includes('menu.lastElementChild !== wandPetEntry'));
  assert.ok(floatingHost.includes('launcher.hidden = stored'));
  assert.ok(floatingHost.includes('label.textContent = "催眠手机"'));
  assert.ok(floatingHost.includes('fa-mobile-screen-button extensionsMenuExtensionButton'));
  assert.ok(floatingHost.includes('if (stored && shellOpen) toggleShell(false)'));
  assert.ok(floatingHost.includes('toggleShell(!shellOpen)'));
  assert.ok(floatingHost.includes('if (nextName !== "idle" && !petReadyAssets.has(petStateAsset(nextName))) nextName = "idle"'));
  assert.ok(!floatingHost.includes('nextName !== "held_scared" && !petReadyAssets.has'));
  assert.ok(!floatingHost.includes('label.textContent = "桌宠 · " + name'));
  assert.ok(floatingHost.includes("<span class='pet-sprite'></span>"), '桌宠缺少单层清晰渲染');
  assert.ok(!floatingHost.includes('pet-sprite-underlay'), '完整桌宠素材仍被模糊补层重复渲染');
  assert.ok(floatingHost.includes("data-pet-state='unique_a'") && floatingHost.includes("data-pet-state='unique_b'") && floatingHost.includes("data-pet-state='held_scared'") && floatingHost.includes("data-pet-state='landing'"), '桌宠单击、长按、拖拽或落地缺少独立动画');
  assert.ok(floatingHost.includes('petMotionFrame = requestFrame(advancePetFrame)'), '桌宠帧动画没有使用浏览器动画帧调度');
  assert.ok(floatingHost.includes('host.requestAnimationFrame.bind(host)'), '动画帧调度仍被限制在局部作用域或丢失宿主绑定');
  assert.ok(!floatingHost.includes('if (event.pointerType !== "mouse") {\n        var longPressPointerId'), '桌宠长按仍仅支持触屏');
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

test('model connector explains SiliconFlow balance failures', () => {
  assert.ok(html.includes('function normalizeConnectorProviderError(value)'));
  assert.ok(html.includes('硅基流动账户余额不足，请充值当前 API 密钥所属账户，或更换有余额的 API 密钥。'));
  assert.ok(html.includes('return prefix + normalizeConnectorProviderError(detail)'));
  assert.ok(html.includes('"文生文插头代理失败：" + normalizeConnectorProviderError(message)'));
  assert.ok(html.includes('if (data?.error) throw new Error("文生文插头返回错误：" + normalizeConnectorProviderError'));
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

test('VIP3 hypnosis trigger stays first and uses the permanent four-part contract', () => {
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
  assert.ok(floatingCore.includes("const FRONTEND_REVISION = 'hypnoos3-1.0.0-pet-source-rebuild'"));
  assert.ok(floatingCore.includes("scriptUrl.searchParams.set('revision', FRONTEND_REVISION)"));
  assert.ok(floatingCore.includes('script.dataset.revision = FRONTEND_REVISION'));
  assert.ok(floatingHost.includes('writeInput: function (text, options) { return callApi("setInput", [text, options]); }'));
  assert.ok(floatingCore.includes('this.host.setInput(command, { append: false })'));
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
  assert.ok(roles.includes('const visibleRoles = { ...importedRoles, ...adaptiveWorldbookRoleCache, ...mvuRoles }'));
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

test('hypnosis start uses a touch-safe activation path before mobile blur rerenders', () => {
  const binding = functionBody('bindHypnosisStartActivation');
  const render = functionBody('renderHypnosisLitePage');
  assert.ok(binding.includes('button.addEventListener("mousedown"'));
  assert.ok(binding.includes('button.addEventListener("touchstart"'));
  assert.ok(binding.includes('button.addEventListener("keydown"'));
  assert.ok(binding.includes('button.addEventListener("click"'));
  assert.ok(render.includes('bindHypnosisStartActivation(startButton, startHypnosis)'));
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
