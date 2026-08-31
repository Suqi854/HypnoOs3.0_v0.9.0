import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };
const removedFeaturePattern = new RegExp(`gal${'game'}|\u4eba\u7269\u6f14\u51fa|\u56fd\u738b\u6e38\u620f`, 'i');

expect(manifest.minimum_client_version === '1.18.0', 'minimum_client_version 必须锁定 1.18.0');
expect(/^\d+\.\d+\.\d+$/.test(manifest.version), 'manifest 版本不是 SemVer');
expect(manifest.version === packageJson.version, 'manifest 与 package 版本不一致');
for (const path of [manifest.js, manifest.css, 'capability-contract.json']) {
  try { await stat(new URL(path, root)); } catch { failures.push(`缺少清单文件：${path}`); }
}

const ui = await readFile(new URL('ui/index.html', root));
const uiText = ui.toString('utf8');
const uiHash = createHash('sha256').update(uiText.replace(/\r\n/g, '\n')).digest('hex');
expect(uiHash === 'f51cdebbf1d17a43404d2a27fea616235170abcc7c565bb79fdb0c6aecd50ac3', `UI 基线哈希变化：${uiHash}`);
const hypnosisRulesSource = await readFile(new URL('src/hypnosis-rules.js', root), 'utf8');
expect(uiText.includes('html,body,#app{width:100%;height:100%;min-height:0;margin:0;overflow:hidden!important;overscroll-behavior:none}#app{contain:strict}'), '手机前端缺少满屏滚动锁');
expect(uiText.includes('window.__ST_OPEN_PENDING_INPUT_APP__'), '手机前端缺少本轮输入应用入口');
expect(uiText.includes('玩家本轮输入'), '本轮输入应用没有采用玩家输入合同');
expect(hypnosisRulesSource.includes("const SCHEMA = 'HypnosisRules/v1'") && hypnosisRulesSource.includes('commands.length !== 36'), '独立核心缺少新增催眠扳机后的完整36项催眠规则合同');
expect(hypnosisRulesSource.includes("command('vip3_hypnosis_trigger', 'VIP3', '催眠扳机'") && hypnosisRulesSource.includes("'permanent-hypnosis-trigger'"), '独立核心缺少VIP3永久催眠扳机合同');
expect(uiText.indexOf('["vip3_hypnosis_trigger","VIP3","催眠扳机"') < uiText.indexOf('["vip3_forced","VIP3","强制高潮"') && uiText.includes('placeholder="催眠者→目标角色→催眠扳机→效果"') && !uiText.includes('data-hypnosis-trigger-field="triggerEffects"'), '手机前端缺少VIP3首位催眠扳机或单框箭头格式');
expect(hypnosisRulesSource.includes('buildHypnosisRulePrompt') && hypnosisRulesSource.includes('calculateHypnosisCost') && hypnosisRulesSource.includes('calculateHypnosisBatchCost'), '独立核心缺少催眠规则提示词或单项/批次计费接口');
expect(hypnosisRulesSource.includes("excludedFeatures: Object.freeze(['vip6_pregnancy_confirmation', 'role.子嗣'])"), '催眠规则合同没有登记妊娠与子嗣功能删除项');
expect(!uiText.includes('pregnancyButton +') && !uiText.includes('childrenTabHtml +') && !uiText.includes('activeTab === "children"\n          ? renderProfileChildrenPanel'), '妊娠按钮或角色档案子嗣入口仍在运行路径中');
expect(uiText.includes('window.__ST_SEND_OPERATION_DIRECTLY__'), '本轮输入应用缺少直接发送合同');
expect(uiText.includes('window.__ST_OPEN_INFORMATION_APP__'), '手机前端缺少信息应用入口');
expect(uiText.includes('window.__ST_OPEN_AVATAR_LIBRARY_APP__'), '手机前端缺少头像库应用入口');
expect(uiText.includes('data-information-action="refresh-format"') && uiText.includes('st-information-feedback'), '信息应用缺少按键反馈');
expect(uiText.includes('st-information-pet-grid') && uiText.includes('grid-template-rows:repeat(3,44px)') && uiText.includes('__ST_HYPNOOS_SELECT_INFORMATION_PET__'), '信息应用缺少2x3桌宠选择');
expect(uiText.indexOf('<h3>桌宠人物</h3>') < uiText.indexOf('<h3>桌宠模式</h3>') && uiText.indexOf('<h3>桌宠模式</h3>') < uiText.indexOf('<h3>变量楼层</h3>'), '桌宠模式按钮没有位于桌宠人物与变量楼层之间');
expect(uiText.includes('__ST_HYPNOOS_TOGGLE_INFORMATION_PET_MODE__') && !uiText.includes('data-information-action="pet">切换人物'), '信息应用仍使用循环切换人物或缺少桌宠模式切换');
expect(uiText.includes('data-profile-gender-correction'), '人物档案缺少手动性别修正选择框');
expect(uiText.includes('declaredProfilePhotoSlots') && uiText.includes('roleData.portrait'), '人物档案没有读取头像或立绘兼容字段');
expect(uiText.includes('normalizeHypnosisTriggerEntries') && uiText.includes('renderHypnosisTriggerPanel(roleData)'), '人物档案缺少催眠扳机数据或效果页展示');
expect(uiText.includes('"催眠扳机": hypnosisTriggers') && uiText.includes('每个扳机词只对应一个催眠者和一个效果'), '世界书档案导入缺少一对一催眠扳机合同');
expect(uiText.includes('.st-person-tabs-left .st-person-tab::after{clip-path:polygon') && uiText.includes('.st-person-tab::after{inset:3px;background:#f4efe6}'), '档案页签没有使用内置剪贴箭头外观');
expect(uiText.includes('const importedRoles = readImportedProfileWorldbookRoles();') && uiText.includes('const visibleRoles = { ...importedRoles, ...adaptiveWorldbookRoleCache, ...archiveRoleSnapshotCache, ...mvuRoles };') && uiText.includes('return visibleRoles;'), '催眠目标角色源没有合并持久化档案、回复快照与MVU变量');
expect(uiText.includes('return favorites.concat(female, male);'), '角色选择没有按喜欢、女性、男性排序');
expect(uiText.includes('中国版') && uiText.includes('日本版') && uiText.includes('data-settings-region'), '设置缺少中国/日本通用模板选择');
expect(uiText.includes('HypnoWorldAdaptation/v1') && uiText.includes('generateAdaptiveWorldbookProfile') && uiText.includes('data-settings-action="clear-adaptive-data"'), '世界类应用缺少世界书生成适配层');
expect(uiText.includes('openTimetablePage(calendarTile)') || uiText.includes('openTimetablePage);'), '课程表没有恢复原始专属界面');
expect(uiText.includes('data-calendar-timetable-toggle') && uiText.includes('timetableAppEnabled()'), '日历缺少课程表显示开关');
expect(uiText.includes('const ST_HOME_DOCK_IDS = ["settings", "information", "pending-input", "hypno"]'), '底部固定应用顺序不正确');
expect(uiText.includes('const PERSON_PROFILE_CONFIDENTIAL_TABS = ["sensitivity", "effects", "remodel"]') && !uiText.includes('data-profile-action="bad-records"') && !uiText.includes('data-profile-locked-bad-records'), '档案劣迹入口仍在运行路径中');
expect(!uiText.includes('row: 2, enter: "hospital"') && !uiText.includes('hospital: settingsLineStageValue(ST_HOSPITAL_LINE_KEY)'), '医院线或改造室入口仍在地图/设置运行路径中');
expect(uiText.includes('specialLocations: { title: "特殊地点"') && uiText.includes('function adaptiveSpecialLocationItems()'), '世界书适配合同缺少特殊地点数据');
expect(uiText.includes('const items = adaptiveSpecialLocationItems();') && !uiText.includes('const items = SPECIAL_LOCATION_STATIC_ITEMS.concat(specialLocationDynamicItems());'), '特殊地点目录仍回退4.3固定数据');
expect(uiText.includes('区域地图、特殊地点和监控地点必须从同一批世界书事实中共同生成'), '区域地图、特殊地点与监控地点没有同源生成约束');
expect(uiText.includes('normalizeHomeLayoutOrder') && uiText.includes('bindHomeLayoutDrag'), '桌面缺少自动补位或拖动排序');
expect(uiText.includes('rewardFemaleArchiveEntries') && uiText.includes('rewardItemFemaleArchiveTarget'), '成就任务没有限定女性档案角色');
expect(uiText.includes('adaptiveTimetableBase()') && uiText.includes('adaptiveCalendarDays()'), '原始日历/课程表没有接入世界书适配数据');
expect(uiText.includes('openMchanPage(tile)') && uiText.includes('adaptiveMchanState(defaultState())'), '混沌心海没有保持原UI并接入适配帖子');
expect(uiText.includes('CHAOS_FORUM_THREAD_LIMIT = 20') && uiText.includes('refreshChaosForumFromModel({ manual: false })') && uiText.includes('data-mchan-action="refresh"'), '混沌心海缺少自动/手动模型更新或20帖上限');
expect(uiText.includes('openRewardPage(null)') && uiText.includes('adaptiveRewardConfig()'), '任务与成就没有保持原UI并接入适配数据');
expect(uiText.includes('openWorkPage(null)') && uiText.includes('activeWorkJobs()'), '打工没有保持原UI并接入适配数据');
expect(uiText.includes('openMonitorPage(null)') && uiText.includes('monitorRecordForGate(index, monitorRecords)') && uiText.includes('工作地点: monitorPlan.location'), '监控没有保持原UI并按门位接入适配数据');
expect(!uiText.includes('工作地点: "私立斋明学园男厕（学校男生很少，平时基本没人）"'), '监控派遣仍写死旧学校男厕');
expect(uiText.includes('data-settings-worldbook-picker="adaptive"') && uiText.includes('type="checkbox"') && uiText.includes('generateAdaptiveWorldbookProfile(worldbookNames)'), '通用适配没有支持下拉多选世界书合并');
expect(uiText.includes('data-settings-worldbook-picker="profile"') && uiText.includes('data-settings-profile-worldbooks') && uiText.includes('importProfileRolesFromWorldbooks'), '设置缺少下拉多选世界书档案导入');
expect(uiText.includes('renderSettingsHelpSection(page)') && uiText.includes('data-settings-action="toggle-help"') && uiText.includes('function removeHomeHelpTile()'), '帮助应用没有迁入世界书适配数据下方的折叠按钮');
expect(uiText.includes('本插件基于二创改编，原作者：Ramiel；二改作者：louisHM；本插件作者SuQi') && !uiText.includes('title: "社区提醒"'), '帮助提醒文案不正确');
expect(!uiText.includes('ST_HOME_AUTHOR_STATUS') && !uiText.includes('st-home-author-status'), '主页状态栏仍注入Ramiel作者名');
expect(!uiText.includes('timeText: \\"Ramiel\\"'), 'React主页状态栏仍显示Ramiel');
expect(uiText.includes('HypnoOS人物档案提取器') && uiText.includes('typeof globalThis.generateRaw === "function"'), '档案导入没有接入模型提取链');
expect(uiText.includes('data-settings-profile-import-status') && uiText.includes('模型正在分析'), '档案导入缺少就地进度与结果反馈');
expect(uiText.includes('data-settings-tab="general"') && uiText.includes('data-settings-tab="models"') && uiText.includes('data-settings-tab="logs"'), '设置页缺少聊天与变量、模型插头、日志三个板块');
expect(uiText.includes('renderDiagnosticLogs()') && uiText.includes('data-settings-log-view') && uiText.includes('ST_DIAGNOSTIC_LOG_LIMIT'), '设置日志板块缺少诊断日志和有界日志存储');
expect(uiText.includes('diagnosticRedact') && uiText.includes('[REDACTED]') && uiText.includes('profile.import.failure'), '诊断日志缺少脱敏或关键档案错误记录');
expect(uiText.includes('.st-settings-worldbook-option input:checked') && uiText.includes('background:#ff3f91'), '世界书下拉多选缺少粉色勾选反馈');
expect(uiText.includes("html: '<strong>档案</strong>'"), '男女档案顶部没有显示档案');
expect(uiText.includes('const SETTINGS_CHEAT_UNLOCK_KEY = "666666"') && uiText.includes('data-settings-cheat-key'), '作弊模式缺少独立密钥门控');
expect(uiText.includes('data-settings-cheat-indicator') && uiText.includes('再次获取资源') && uiText.includes('.st-settings-cheat-panel.is-active .st-settings-button.danger'), '作弊模式缺少重复补充资源或关闭控件');
expect(uiText.includes('settingsCheatSystemView') && uiText.includes('settingsGrantCheatResources') && uiText.includes('SETTINGS_CHEAT_RESOURCE_VALUE = 99999999'), '作弊模式缺少VIP覆盖或有限资源写入');
expect(!uiText.includes('∞') && uiText.includes('全部VIP已解锁'), '作弊模式仍伪装无限资源或缺少VIP解锁反馈');
expect(!uiText.includes('settingsSetCheatModeWorldbooks') && !uiText.includes('settingsCheatModePayload') && !uiText.includes('settingsCheatModeReminder'), '作弊模式仍与世界书或剧情暂存耦合');
expect(!uiText.includes('const confirmed = await encounterConfirm(page, {\n      title: active ? "开启作弊模式"'), '正确密钥后仍有额外确认阻断作弊模式');
expect(!uiText.includes('openAdaptiveWorldApp(calendarTile, "calendar")'), '日历仍被统一卡片页覆盖');
expect(uiText.includes('encounterBuiltInPackagesCache = [];') && uiText.includes('encounterResetLibraryFor070Once'), '邂逅内置角色包没有清空');
for (const label of ['API 预设', '附加主体参数', '排除主体参数', '附加请求标头']) {
  expect(uiText.includes(label), `文生文连接器缺少预设字段：${label}`);
}
expect(uiText.includes('data-connector-load-models="text"'), '自定义直连缺少加载模型按钮');
expect(!uiText.includes('酒馆后端代理'), '模型插头仍显示酒馆后端代理');
expect(uiText.includes('data-connector-field="model"') && uiText.includes('placeholder="请先加载并选择模型" readonly'), '模型名必须由列表只读回填');
expect(uiText.includes('return base + "/models"'), '自定义直连缺少模型列表端点');
expect(uiText.includes('return base + "/chat/completions"'), '自定义直连缺少生成端点');
expect(uiText.includes('removeReactChrome(root)'), '切换内部应用时没有清理旧 React 顶栏');
expect(uiText.includes('#app>.w-full.flex.items-center.justify-center.p-2>div:first-child'), '手机前端缺少重复机壳消除规则');
expect(!removedFeaturePattern.test(uiText), '手机前端不得残留已移除功能的运行代码');
const floatingHost = await readFile(new URL('public/floating-bootstrap.js', root), 'utf8');
for (const marker of ['data-phone-drag', 'pet-character-toggle', 'sidecar', 'launcher']) {
  expect(floatingHost.includes(marker), `4.3 悬浮宿主缺少关键能力：${marker}`);
}
expect((floatingHost.match(/data-phone-resize=/g) || []).length === 2, '悬浮宿主必须保留下方左右两个缩放热区');
expect(floatingHost.includes('.sidecar{display:none!important}'), '外部信息挂件仍可能占用界面空间');
expect(floatingHost.includes('savePhoneScale'), '手机缩放没有持久化');
expect(floatingHost.includes('resizeAnimationFrame = requestFrame(flushResizeFrame)') && floatingHost.includes('clampPosition(x, resizeState.top, size)'), '手机缩放没有按动画帧合并或仍依赖强制布局回读');
expect(floatingHost.includes("scrolling='no'"), '手机 iframe 必须关闭文档滚动条');
expect(!floatingHost.includes('0 0 0 6px rgba(17,12,30,.72)'), '悬浮宿主仍包含额外 6px 黑色描边');
expect(!removedFeaturePattern.test(floatingHost), '悬浮宿主不得残留已移除功能的按钮、同步或渲染代码');
expect(floatingHost.includes('config.singletonKey'), '悬浮宿主没有使用可配置独立单例键');
expect(floatingHost.includes('var PET_CHARACTER_ORDER = ["miku", "rem", "mai", "umaru", "alisa", "hyakka"]'), '悬浮宿主桌宠顺序或数量不正确');
expect(floatingHost.includes('hypnoos-pet-wand-container') && floatingHost.includes('menu.lastElementChild !== wandPetEntry'), '收纳桌宠没有固定在魔法棒菜单底部');
expect(floatingHost.includes('var petDisplayMode = "floating"') && floatingHost.includes('launcher.hidden = stored'), '桌宠悬浮/收纳模式没有持久化切换');
expect(floatingHost.includes('label.textContent = "催眠手机"') && floatingHost.includes('if (stored && shellOpen) toggleShell(false)'), '收纳模式没有显示催眠手机或关闭已打开的手机');
expect(floatingHost.includes('toggleShell(!shellOpen)'), '魔法棒催眠手机入口不能再次点击关闭');
expect(floatingHost.includes('if (nextName !== "idle" && !petReadyAssets.has(petStateAsset(nextName))) nextName = "idle"'), '桌宠动作素材未就绪时没有回退到 idle，仍可能出现空白帧');
expect(floatingHost.includes("<span class='pet-sprite'></span>") && !floatingHost.includes('pet-sprite-underlay'), '完整桌宠素材仍被模糊补层重复渲染');
expect(floatingHost.includes("data-pet-state='unique_a'") && floatingHost.includes("data-pet-state='unique_b'") && floatingHost.includes("data-pet-state='held_scared'") && floatingHost.includes("data-pet-state='landing'"), '桌宠单击、长按、拖拽或落地缺少独立动画');
for (const id of ['miku', 'rem', 'mai', 'umaru']) {
  for (const action of ['click', 'long', 'drag']) {
    expect(floatingHost.includes(`@keyframes pet-${id}-${action}`), `${id} 缺少独立的 ${action} 动画`);
  }
  expect(floatingHost.includes(`[data-pet-character='${id}'][data-pet-state='unique_a']`) && floatingHost.includes(`[data-pet-character='${id}'][data-pet-state='unique_b']`) && floatingHost.includes(`[data-pet-character='${id}'][data-pet-state='held_scared']`), `${id} 的独立交互动作没有完整绑定`);
}
for (const id of ['alisa', 'hyakka']) {
  expect(!floatingHost.includes(`[data-pet-character='${id}'][data-pet-state=`), `${id} 的 4.3 动作不应被新增覆盖`);
}
const pendingStart = uiText.indexOf('const buildPendingOperationText =');
const pendingEnd = uiText.indexOf('const stripOperationBlocks =', pendingStart);
const pendingSource = uiText.slice(pendingStart, pendingEnd);
expect(pendingSource.indexOf('parts.push(buildOperationBlock(entries))') < pendingSource.indexOf('parts.push(playerInput)'), '本轮输入仍把玩家文字放在前端操作之前');
expect(uiText.includes('const next = base ? block + "\\n" + base : block;'), '输入框回退仍把前端操作放在玩家文字之后');
expect(floatingHost.includes('petMotionFrame = requestFrame(advancePetFrame)'), '桌宠帧动画没有使用浏览器动画帧调度');
expect(floatingHost.includes('PET_ASSET_REVISION = "character-actions-20260828"') && floatingHost.includes('?revision=" + PET_ASSET_REVISION'), '桌宠专属动作素材缺少缓存版本');
expect(floatingHost.includes('host.requestAnimationFrame.bind(host)'), '动画帧调度仍被限制在局部作用域或丢失宿主绑定');
expect(floatingHost.includes('transform:translateZ(0) scale(var(--phone-scale))') && !floatingHost.includes('isolation:isolate;transform:scale(var(--phone-scale))'), '手机缩放没有统一作用于整个容器');
expect(floatingHost.includes('(horizontal * 430 + vertical * 812) / (430 * 430 + 812 * 812)'), '手机缩放仍会在横轴与纵轴之间跳变');
for (const id of ['miku', 'rem', 'mai', 'umaru', 'alisa', 'hyakka']) {
  try { await stat(new URL(`public/assets/pet/v5/${id}/${id}-idle-v5.png`, root)); } catch { failures.push(`缺少桌宠素材：${id}`); }
}
expect(uiText.includes('normalizeConnectorProviderError') && uiText.includes('硅基流动账户余额不足'), '模型插头没有识别硅基流动余额不足错误');
const extensionSource = await readFile(new URL('src/extension.js', root), 'utf8');
expect(!extensionSource.includes('hypnoos3-launcher'), '不得重新引入自制 H 启动器');
const floatingHostSource = await readFile(new URL('src/floating-host.js', root), 'utf8');
expect(floatingHostSource.includes('__HYPNOOS3_EXTENSION_FLOATING_SINGLETON__'), '插件没有独立于4.3脚本的单例命名空间');
expect(floatingHostSource.includes('hypnoos3-extension-floating-phone-host'), '插件没有独立于4.3脚本的宿主节点');
expect(floatingHostSource.includes("scriptUrl.searchParams.set('revision', FRONTEND_REVISION)"), '悬浮宿主脚本缺少版本缓存标识');
expect(floatingHostSource.includes('directSend(text)'), '插件宿主缺少直接发送桥');
const hostAdapterSource = await readFile(new URL('src/host-adapter.js', root), 'utf8');
expect(hostAdapterSource.includes('getCharacterWorldbookNames()'), '宿主适配器缺少当前角色世界书解析');
expect(hostAdapterSource.includes("{ type: 'message', message_id: 'latest' }"), '宿主适配器没有读取最新楼层变量');
expect(hostAdapterSource.includes('extractLatestUserOperationBlock') && hostAdapterSource.includes('buildLatestOperationGate'), '宿主适配器缺少最新真实用户操作闸门');

async function files(dir) {
  const result = [];
  for (const name of await readdir(dir)) {
    const path = join(dir, name);
    const info = await stat(path);
    if (info.isDirectory()) result.push(...await files(path));
    else if (/\.(?:js|mjs)$/.test(name)) result.push(path);
  }
  return result;
}

const rootPath = fileURLToPath(root);
const sourceRoot = fileURLToPath(new URL('src/', root));
for (const path of await files(sourceRoot)) {
  const text = await readFile(path, 'utf8');
  const label = relative(rootPath, path);
  expect(!/\beval\s*\(/.test(text), `${label} 使用 eval`);
  expect(!/new\s+Function\s*\(/.test(text), `${label} 使用 new Function`);
  expect(!/https?:\/\/[^'"`\s]*\.(?:js|mjs)(?:[?'"`\s]|$)/i.test(text), `${label} 引用远程脚本`);
  expect(!/innerHTML\s*=/.test(text), `${label} 对 innerHTML 赋值`);
  expect(!/(?:sk-|api[_-]?key\s*[:=]\s*['"])[A-Za-z0-9_-]{12,}/i.test(text), `${label} 疑似包含 API 密钥`);
}

if (failures.length) {
  console.error(failures.map((item) => `FAIL ${item}`).join('\n'));
  process.exitCode = 1;
} else console.log(`PASS static checks; UI baseline ${uiHash}`);
