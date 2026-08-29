# HypnoOS 维护交接

更新时间：2026-08-30（Asia/Shanghai）

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
- 最新功能提交：`37b062d5bb38b8f621d9ab12a2150f3a66e7bb23`
- 本文件提交并推送后，必须用 `git ls-remote origin refs/heads/main` 重新记录远端 SHA。
- 当前关键提交：
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

### 最近一次真实宿主结果

- `npm test`：65/65 通过。
- `npm run check`：通过。
- `npm run build`：通过，生成 `HypnoOS3.0-v1.0.0.zip`，308 个文件。
- UI 基线：`6faf6676007dccffbf58cae0326880af4a05860dece8736fc97c695e698356d5`。
- 本地真实酒馆档案绑定与收纳 QA：通过；确认无自动档案弹窗、设置页三种绑定操作存在、缩放和拖动不触发关闭、外部空白点击关闭。
- 两个本地扩展安装目录均已同步精确构建产物。

## 当前待确认

- 用户尚未完成取消档案存储自动弹窗后的手动视觉验收。
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

## 最近回档

- `HypnoOS-v1.0.0-before-worldbook-binding-20260829-215111-1ecec2c.zip`
- `HypnoOS-v1.0.0-after-worldbook-binding-20260830-004054-2ddc6f4.zip`
- `HypnoOS-v1.0.0-before-remove-auto-archive-prompt-20260830-005909-2ddc6f4.zip`
- `HypnoOS-v1.0.0-after-remove-auto-archive-prompt-20260830-010510-37b062d.zip`

以上回档均位于：`E:\sillytavern\卡\催眠app重置\版本`
