# HypnoOS 维护交接

更新时间：2026-08-29（Asia/Shanghai）

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
- 远端 `main` 已确认指向：`88044f99d1f20aee06778825f544a93182b39635`
- 当前关键提交：
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

### 最近一次真实宿主结果

- `npm test`：63/63 通过。
- `npm run check`：通过。
- `npm run build`：通过，生成 `HypnoOS3.0-v1.0.0.zip`，307 个文件。
- 本地桌宠 QA：素材加载、点击/长按/拖拽状态、透明渲染和缩放通过。
- 覆盖安装后第一次 QA 出现一次启动时序警告：
  `phone frontend boot guard released without patch-ready signal`。
  第二次完整运行通过；若用户再次遇到加载问题，需要单独复现，不要直接忽略。

## 当前待确认

- 用户尚未在推送 `88044f9` 后反馈四个角色专属动作的最终视觉验收结果。
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

## 最近回档

- `HypnoOS-v1.0.0-before-character-action-sprites-20260828-cf36c2b.zip`
- `HypnoOS-v1.0.0-after-character-action-sprites-20260828-88044f9.zip`

两者位于：`E:\sillytavern\卡\催眠app重置\版本`
