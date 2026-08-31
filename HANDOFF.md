# HypnoOS 维护交接

更新时间：2026-08-31（Asia/Shanghai）

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
- 最新功能提交：`7d389a8 feat: persist model presets and unify phone settings`（仅本地，尚未推送）
- 本文件提交并推送后，必须用 `git ls-remote origin refs/heads/main` 重新记录远端 SHA。
- 当前关键提交：
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

## 当前实现状态

### 已完成并有回归测试

- `HypnoState` 为主要运行状态源；MVU/TH 为可选兼容适配器。
- 每轮 AI 回复后刷新 MVU 兼容变量。
- 催眠指令先进入手机“本轮输入”，再由玩家选择写入输入框或直接发送。
- 发送内容显示顺序为前端操作在上、玩家本轮输入在下。
- MC 能量使用统一有限数值计算；作弊资源为可消费的 `99999999`。
- 手机输入框移动端焦点、催眠启动触摸事件已做回归保护。
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

### 最近一次真实宿主结果

- `npm test`：70/70 通过。
- `npm run check`：通过。
- `npm run build`：通过，生成 `HypnoOS3.0-v1.0.0.zip`，308 个文件。
- UI 基线：`531cfb7b34ee6d69ba895008723e72a7e3ef04ac7b9d5c711218983044541218`。
- 本地真实酒馆模型预设 QA：通过；实际新增并保存临时预设、加载模型、持久化密钥，切换聊天后确认预设与密钥仍在，返回后删除预设并确认对应密钥被清除；全过程无页面错误。
- 本地真实酒馆世界书绑定、即插即用催眠规则与收纳 QA：通过；实际点击手机原生新建、角色卡绑定（可用时）和迁移界面并完成迁移。确认 36 条指令完整，World Info 只注入一次；切换聊天后规则删除但两条档案保留，返回后规则恢复；缩放和拖动不关闭手机，外部空白点击关闭；全过程无页面错误。
- 两个本地扩展安装目录均与最终构建产物逐文件一致：各 308 个文件，0 缺失、0 额外、0 哈希差异。

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

以上回档均位于：`E:\sillytavern\卡\催眠app重置\版本`
