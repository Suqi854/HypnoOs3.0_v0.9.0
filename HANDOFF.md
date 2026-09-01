# HypnoOS 维护交接

更新时间：2026-09-01（Asia/Shanghai）

## 新任务启动指令

在新 Codex 任务中先发送：

```text
继续维护 E:\sillytavern\卡\催眠app重置\HypnoOS2.0。
请先读取 HANDOFF.md 和 AGENTS.md，并检查 git status、git log -10、git remote -v。
不要立刻修改代码，先用简短列表汇报当前状态、未跟踪文件和准备处理的问题。
后续仍需先在本地 SillyTavern 安装和真实运行验证，通过后才能提交；只有我明确要求时才能推送。
```

## 仓库状态

- 工作目录：`E:\sillytavern\卡\催眠app重置\HypnoOS2.0`
- 当前分支：`main`
- 项目版本：`1.0.0`（见 `package.json`）
- 发布仓库名称仍为：`HypnoOs3.0_v0.9.0`
- 远端：`https://github.com/Suqi854/HypnoOs3.0_v0.9.0.git`
- 最新远端提交以 `git ls-remote origin refs/heads/main` 为准；只有用户在当前任务明确要求时才能推送。
- 当前关键提交：
  - `fix: restore profile fallback and connector responses`（本轮待提交）
  - `80a994f fix: make hypnosis start activation reliable`
  - `352ff9e fix: sync database data into phone profiles`
  - `5af061c feat: integrate database-backed phone state`
  - `7d389a8 feat: persist model presets and unify phone settings`
  - `3d79447 fix: restore interactive worldbook binding controls`
  - `e709314 feat: add plug-and-play hypnosis worldbook rules`
  - `37b062d fix: keep archive binding in settings only`
  - `2ddc6f4 feat: bind persistent archives to worldbooks`
  - `c7af677 fix: store phone on outside click`
  - `1ecec2c docs: add maintenance handoff for new tasks`
  - `88044f9 feat: add character-specific pet action sprites`
  - `cf36c2b fix: restore input order and unique pet reactions`
  - `272e03d fix: rebuild complete imported pet sprites`
  - `2442255 fix: smooth pet interactions and phone resizing`
  - `1b7c381 fix: stabilize mobile input and finite cheat resources`
  - `6863013 fix: stabilize mobile input and avatar selection`

## 2026-09-01 档案来源与模型响应修复

- 仓库先按用户指定版本包核对并回退到 `80a994f`；错误的本地 `2e957f6` 已移除，修复从干净基线重新完成。
- 截图日志确认档案模型调用本身成功（女性 12、男性 6）；实际问题是数据库插件存在但“重要人物表”为空时，手机仍把数据库标记为独占档案来源，遮住了已成功导入的世界书档案。
- 现在只有“重要人物表”存在有效记录时才由数据库独占人物档案；空表时继续显示当前聊天已导入/已缓存的档案。旧版没有表元数据时，仍可用角色的“数据来源=数据库”兼容识别。
- 自定义文生文响应保持优先读取正常 `content/text`，仅在正文为空时兼容 `reasoning_content/reasoning`，解决 OpenAI 兼容响应外壳存在但正文无法识别的问题。
- 未改现有设置三板块、应用布局或其他 UI；仅更新前端缓存标记与静态哈希。
- 自动验证：86/86、`check`、309 文件构建均通过。真实酒馆验证覆盖：空数据库人物表的世界书档案回退、真实 AutoCardUpdaterAPI 连接、人物/地点/库存/任务/技能/总结/大纲可逆投影，以及 reasoning-only 模拟响应；未调用付费 API，临时数据已恢复且复查无残留。

## 2026-09-01 地图、催眠扳机与模型等待修复

- 无聊天地图改由宿主桥直接确认当前聊天，并要求聊天消息已实际载入；仅残留角色/聊天标识但消息为空时不会再读取旧地图存档或 4.3 默认地点。
- 所有催眠指令的输入框提示都只作为填写示例，不参与语法解析；每条已选指令只要求实际输入非空原文。VIP3“催眠扳机”直接复用界面已填写的催眠者和已选择的目标角色，输入原文完整进入操作载荷，真实鼠标点击可正常暂存。
- 通用适配模板的独立 API 与档案的酒馆当前模型统一增加 90 秒等待上限；超时会中止可取消的网络请求、显示明确错误并恢复按钮，不再永久停留在“正在连接文生文模型”。
- 未改页面布局、样式或既有三板块 UI；前端缓存标记升级为 `hypnoos3-1.0.0-map-trigger-model-v1`。
- 自动验证：89/89、`check`、309 文件构建均通过。真实酒馆验证覆盖：无聊天地图 0 地点、全部 36 条催眠指令输入原文的真实鼠标点击、档案与适配模板的可控超时恢复；未调用付费 API，临时模型配置已恢复。

## 本地运行环境

- SillyTavern：`http://127.0.0.1:8000/`
- 扩展安装目录：
  `E:\sillytavern\sillytavern\SillyTavern\public\scripts\extensions\third-party\HypnoOS3.0`
- 兼容安装目录：
  `E:\sillytavern\sillytavern\SillyTavern\public\scripts\extensions\third-party\HypnoOS3.0-v1.0.0`
- 构建来源：`dist\HypnoOS3.0`
- 回档目录：`E:\sillytavern\卡\催眠app重置\版本`
- 不得提交或修改：`.codex-remote-attachments/`
- `artifacts/` 是本地 QA 临时输出，默认不提交。

## 不可破坏的约束

1. 保留现有 4.3 UI、布局、样式与用户可见工作流，除非用户明确要求改变。
2. 采用小步修改，不推倒重写；每个独立问题单独提交。
3. 每一步必须依次运行 `npm test`、`npm run check`、`npm run build`。
4. 静态检查不能替代真实 SillyTavern 验证。
5. 修改后先安装本地酒馆并验证，用户明确要求后才能推送 GitHub。
6. 每一步完成后在回档目录保存 ZIP。
7. 不确定能否删除的兼容代码先保留并报告。
8. 不得把固定旧角色、地点或世界观重新混入任意角色卡。
9. 爱丽莎和千杀百花使用原 4.3 桌宠动作，未经明确要求不得覆盖。
10. 只有新增或改动 UI 时才先出效果图并等待用户确认；纯逻辑修复、数据处理、测试，以及按用户明确要求恢复旧 UI 不需要效果图。

## 当前实现状态

### 已完成并有回归测试

- `HypnoState` 为主要运行状态源；MVU/TH 为可选兼容适配器。
- 每轮 AI 回复后刷新 MVU 兼容变量。
- 催眠指令先进入手机“本轮输入”，再由玩家选择写入输入框或直接发送。
- 发送内容显示顺序为前端操作在上、玩家本轮输入在下。
- MC 能量使用统一有限数值计算；作弊资源为可消费的 `99999999`。
- 手机输入框移动端焦点、催眠启动触摸事件已做回归保护。
- “启动催眠”同时支持 pointer、mouse、touch、键盘和标准 click；标准 click 不再被空拦截，不同事件合成会在 700ms 内去重，暂存异常会显示可重试提示。
- 人物档案可从手机存储移除，并按聊天/角色卡隔离。
- 世界书技术条目不会被误识别为人物。
- 照片夹的照片位和选择按钮可打开头像库，头像选择不会回顶。
- 收纳模式、催眠手机开关、缩放帧合并已有回归检查。
- 初音未来、蕾姆、樱岛麻衣、土间埋使用独立的 8 帧点击、长按和拖拽动作素材。
- 四个新增桌宠动作条检查：尺寸 `768x96`、至少 3 个不同帧、封闭透明缺口为 0。
- 爱丽莎和千杀百花的原动作资源未修改。
- 收纳模式下点击手机外空白区域会关闭手机；缩放热区和拖动边框不会触发关闭。
- 档案可一对一绑定世界书，支持新建专用世界书、绑定角色卡外部世界书、迁移到所选世界书。
- 每轮 AI 回复会用回复内容更新档案；MVU 仅作为结构化校正，没有 MVU 时仍可按回复更新。
- 档案和催眠剧情上下文写入绑定世界书；迁移只删除旧世界书中由 HypnoOS 管理的档案条目。
- 不再在新卡或新对话时自动弹出档案存储界面；绑定功能只保留在设置页。
- 已完整审计 `催眠APP初版.json` 与 `催眠app二改 v4.3（louisHM 完全免费）.json` 的催眠规则，按现有 `HypnosisRules/v1` 格式合并为无重复规则集；保留 36 条催眠指令并登记两份来源 SHA-256 与审计条目 ID。
- 玩家在设置中绑定档案存储世界书后，进入该聊天会自动写入唯一的 `[HypnoOS内置]催眠规则` 条目；离开该聊天只删除该临时规则，人物档案、剧情上下文和玩家原条目继续保留；返回聊天后自动恢复规则。
- 绑定世界书承载催眠规则时，扩展提示不会重复注入同一规则；酒馆加载旧聊天首条问候不会误触发档案模型同步。
- 设置模块已改名为“世界书绑定”；新建专属世界书、绑定角色卡世界书和迁移已有世界书全部使用催眠手机原生弹窗，不再调用 SillyTavern 宿主弹窗。
- 档案世界书操作不再依赖当前可写消息楼层；绑定后不再立即调用模型同步，并在当前面板就地显示忙碌、成功或失败状态。
- 所有可用按钮都有悬停/键盘焦点高亮、按下缩放和点击后反馈动画，并为减少动态效果偏好提供降级反馈。
- 世界书绑定状态变化会立即刷新扩展提示，避免规则已经写入世界书但旧扩展提示仍短暂重复注入。
- 模型插头改为多预设结构：可通过下拉列表切换已保存 API 预设，也可新增和删除预设；旧单预设配置会自动迁移。
- API 密钥按预设持久保存在当前浏览器本地存储中，切换聊天后不再丢失；删除预设时同步删除对应密钥，最后一个预设被删除后恢复默认空预设。
- 模型插头按连接信息、生成参数和高级连接参数重新分区；启用开关不会再因重渲染清空尚未保存的输入。
- 设置页已恢复为“聊天与变量 / 模型插头 / 日志”三个独立板块，不再把三者合在一页。
- 内置世界书催眠规则升级为 `4.3.0-hypnoos.6`；保留核心规则、参数与强度以及内部 36 条指令注册，但从实际注入正文删除“催眠指令白名单”“结果分类”“输出硬检查”。
- 已有 `[HypnoOS档案]人物状态` 和 `[HypnoOS档案]剧情与催眠上下文` 会按类型复用原 UID；跨聊天遗留的重复条目和正文重复包裹会一次性收纳为各一条，之后重复进入同一聊天不再重写正确条目。
- 新增“数据库”应用，UI 只增加一个原样式主页图标和只读表格页，其他既有 UI 不变。
- 已接入数据库本体 `spv8.9.1` 实际提供的 `AutoCardUpdaterAPI`：读取全局数据、主角信息、重要人物、技能、背包、任务、总结和总体大纲 8 张表；标准字段映射到现有角色档案、地点/时间、库存和任务，原始表格通过数据库应用直接读取。
- 数据库存在时，它是每轮人物/变量更新的权威来源；每轮只读取数据库并跳过模型与世界书档案生成。数据库不可用时保留原世界书绑定兼容路径。
- 每个聊天的 `HypnoState` 现在同时写入酒馆聊天元数据和浏览器 IndexedDB 镜像；退出并返回同一聊天时，设置、应用数据和世界书绑定会自动恢复，除非玩家明确重新绑定。
- 聊天切换期间的异步更新带有上下文校验，旧聊天的延迟回调不能再把状态写入新聊天；聊天元数据优先即时保存，避免退出前的防抖写入丢失。
- 数据库运行时短暂返回 0 行表时不再清除已导入的人物档案、任务和背包；收到非空权威快照后仍按数据库内容正常更新。
- 收纳模式与悬浮模式现在共用同一聊天切换档案刷新：切换聊天时立即清除旧缓存，宿主上下文稳定后主动重读当前角色世界书与档案快照，并刷新已打开档案页。
- 未选择角色卡或聊天时，人物档案返回空状态，地图/学校地图不再回退 4.3 固定地点或地区模板；进入有效聊天后才读取该聊天的数据。
- 无聊天判定由宿主桥提供，并要求消息列表已实际载入；聊天切换残留的旧 ID 不再足以激活地图数据。
- 收纳模式和悬浮模式都按 `角色/群组 + chatId` 读取独立存档；聊天切换只卸载当前内存视图，不删除 IndexedDB 镜像，切回原聊天会恢复该聊天自己的设置、档案和应用数据。
- 酒馆触发角色聊天或群聊删除事件时，会同步删除相同归属和 chatId 的 HypnoOS 镜像；带归属的删除绝不跨角色回退，同名但归属不明时宁可保留，避免误删其他角色存档。
- 数据库重要人物现按档案应用原有分组投影为“信息 / 衣着 / 状态 / 事件 / 效果 / 物品”；`性别/年龄` 会拆成明确性别与年龄，不猜测数据库未提供的字段，女性和男性分别进入对应档案应用。
- 数据库模式下档案角色只读取当前 HypnoState 数据，不再自动混入角色世界书、绑定档案世界书或旧导入缓存；数据库不可用时仍保留原世界书档案合并流程。
- 地点、时间、主角身份、库存和任务继续同步；主角技能、总结和总体大纲改存 HypnoOS 自有状态并在每次桥接读取时重新投影，避免被酒馆变量 Schema 清除。数据库任务同时适配原任务应用的“任务 / 完成条件 / 已完成 / 奖励星光点”字段。
- 数据库核心模块仍带 `database-profile-v3` 缓存版本标识；手机前端升级为 `hypnoos3-1.0.0-hypnosis-start-v4`，避免浏览器继续执行修复前的启动按钮事件绑定。
- 手机前端当前缓存标识为 `hypnoos3-1.0.0-map-trigger-model-v1`；催眠指令输入提示不参与格式校验，档案与适配模板模型请求具有统一超时恢复。

### 最近一次真实宿主结果

- `npm test`：84/84 通过。
- `npm run check`：通过。
- `npm run build`：通过，生成 `HypnoOS3.0-v1.0.0.zip`，309 个文件。
- UI 基线：`47a85f989ed11df8c03016da8c4c11edd1688579bc83833891ae59b3234bfebe`（仅启动催眠事件与失败反馈逻辑变化，布局与样式未改）。
- 本地真实酒馆催眠指令启动 QA：36/36 指令均以“只有标准 click、没有 mousedown/touchstart”的兜底路径成功暂存；真实物理点击只生成 1 条暂存，触摸启动也通过。QA 使用可回退数据库档案快照验证催眠扳机，结束后恢复原聊天状态，全程无页面错误。
- 本地真实酒馆模型预设 QA：在恢复三板块后再次通过；实际新增并保存临时预设、加载模型、持久化密钥，切换聊天后确认预设与密钥仍在，返回后删除预设并确认对应密钥被清除；全过程无页面错误。
- 本地真实酒馆世界书绑定、即插即用催眠规则与收纳 QA：通过；精简规则在 World Info 只注入一次，人物状态、剧情上下文和内置规则各自唯一，正文包裹各一层；切换聊天后规则删除但两条档案保留，返回后规则恢复；全过程无页面错误。
- 本地真实酒馆数据库 QA：通过；实际检测数据库本体 `AutoCardUpdaterAPI`，数据库应用读取 8 张标准表，设置页显示三个独立板块，刷新无页面错误。
- 本地真实酒馆聊天持久化 QA：通过；人为删除原聊天元数据后切换聊天并返回，仍从同聊天 IndexedDB 镜像恢复设置、角色卡世界书绑定和数据库来源人物；内置规则自动重新加载，测试数据随后已还原，无页面错误。
- 本地真实酒馆收纳档案/空地图 QA：通过；无角色卡/聊天时地图显示 0 地点、当前位置未记录且不含学校/城市中心/住宅区；收纳模式切换到另一聊天并返回，手机重新打开前档案已自动恢复，全程无页面错误。
- 本地真实酒馆独立存档生命周期 QA：通过；实际在两个已有聊天之间切换并返回，原聊天设置、世界书绑定和数据库人物从独立镜像恢复；另用临时镜像键触发真实 `CHAT_DELETED` 事件，目标镜像被删除且当前聊天镜像逐字节保持不变，全程无页面错误，未删除用户真实聊天。
- 本地真实酒馆数据库档案投影 QA：通过；用可回退的 8 表数据库快照完成重新初始化，女性角色进入女性档案、男性角色进入男性档案，年龄和档案字段可见；地点、库存、任务、技能、总结、总体大纲均可读，测试后恢复原聊天状态，全程无页面错误。
- 两个本地扩展安装目录均与最终构建产物逐文件一致：各 309 个文件，0 缺失、0 哈希差异。

## 当前待确认

- 自动化已验证催眠手机原生弹窗和按钮反馈；用户仍可进行最终人工视觉手感验收。
- 未绑定世界书时不会持久写入档案；玩家需要在设置页主动选择绑定方式。这是当前明确产品行为，不应重新加自动弹窗。
- 用户尚未反馈四个角色专属动作的最终视觉验收结果。
- 若下一条反馈仍是桌宠动作问题，先确认浏览器实际加载的素材 URL 带有：
  `?revision=character-actions-20260828`。
- 不要仅通过 CSS 摇晃模拟角色动作；专属动作必须来自逐帧 PNG。
- 当前没有其他已确认且尚未修复的新故障。新任务不要从旧聊天的问题清单猜测故障，先根据用户最新反馈复现。

## 常用验证命令

```powershell
npm test
npm run check
npm run build
```

真实酒馆桌宠 QA 需要 Playwright 环境：

```powershell
$env:CODEX_NODE_MODULES='C:\Users\SU\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:PLAYWRIGHT_BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
& 'C:\Users\SU\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/qa-local-pet-motion-resize.mjs
```

## 发布检查

推送前必须再次确认：

```powershell
git status --short
git remote -v
git log -3 --oneline
git push origin main
git ls-remote origin refs/heads/main
```

只允许显式暂存任务文件；不得使用会把 `.codex-remote-attachments/` 或 `artifacts/` 一并加入的宽泛暂存命令。

档案绑定与收纳真实酒馆 QA：

```powershell
$env:CODEX_NODE_MODULES='C:\Users\SU\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:PLAYWRIGHT_BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/qa-local-archive-binding.mjs
```

模型预设持久化与删除真实酒馆 QA：

```powershell
$env:CODEX_NODE_MODULES='C:\Users\SU\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$env:PLAYWRIGHT_BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/qa-local-settings-presets.mjs
```

## 最近回档

- `HypnoOS-v1.0.0-before-worldbook-binding-20260829-215111-1ecec2c.zip`
- `HypnoOS-v1.0.0-after-worldbook-binding-20260830-004054-2ddc6f4.zip`
- `HypnoOS-v1.0.0-before-remove-auto-archive-prompt-20260830-005909-2ddc6f4.zip`
- `HypnoOS-v1.0.0-after-remove-auto-archive-prompt-20260830-010510-37b062d.zip`
- `HypnoOS-v1.0.0-after-plug-and-play-hypnosis-rules-20260830-134637-e709314.zip`
- `HypnoOS-v1.0.0-after-worldbook-dialog-feedback-20260830-142554-3d79447.zip`
- `HypnoOS3.0-v1.0.0-20260831-7d389a8.zip`（SHA-256：`EC07D54163ED38733FBA5FDC7AC459B069BE2CC09F986158286599D52E2EF3A5`）
- `HypnoOS3.0-v1.0.0-20260831-5af061c.zip`（SHA-256：`A3A9450AA6FFA7EECE1BC990D309A8740B92D42B851D2EB330C01E063F506BC2`）
- `HypnoOS3.0-v1.0.0-20260831-7cb66c3.zip`（SHA-256：`EE63E004348050BA0FA6BFF3C0F827CC5C89FACD85A345CD768018A47F451E2F`）

以上回档均位于：`E:\sillytavern\卡\催眠app重置\版本`
