# dsh-context-explainer（定制版说明）

本仓库是从 [bowenliang123/dsh-context](https://github.com/bowenliang123/dsh-context) **v0.82.1** 同步代码后做的定制 Fork，
包名与所有注册 ID 改为 `dsh-context-explainer`，用于和原版 `dsh-context` **同时安装、互不冲突**。

> 上游原始文档（README.md / README_en.md / docs/）保留未动；本文档只记录本 Fork 的改动。

---

## 0. 与上游的隔离（共存必需）

| 项 | 原版 | 本 Fork |
|---|---|---|
| 包名 / bundle | `dsh-context` | `dsh-context-explainer` |
| 上下文视图 slot id | `context` | `context-explainer` |
| 编队视图 slot id | `fleet` | `fleet-explainer` |
| 侧栏标签 key | `dsh-context` | `dsh-context-explainer` |
| 会话动作 slot id | `context-jump` | `context-jump-explainer` |
| 输入区浮层 slot id | `context-modal` | `context-modal-explainer` |
| 斜杠命令 | `/context` | `/context-explainer` |
| HTTP 路由 | `/api/dsh-context/*` | `/api/dsh-context-explainer/*` |

所有 ID 集中在 [`src/client/ids.ts`](src/client/ids.ts) 一处维护；Tab 名称显示为 **E上下文 / E编队**（8 种语言均已本地化）。

---

## 1. 面板 Resize（拖拽调整）

所有主要并排/堆叠面板都支持拖拽分隔条调整尺寸，拖拽条默认可见、hover 变品牌紫：

- 概览页：**上下文统计 ↔ 插件信息**
- 统计行：**Token 统计 ↔ 耗时统计**
- 主视图：**上下文趋势 ↔ 上下文浏览器**
- 下折行：**上下文事件 ↔ 文件活动**
- 编队页：**Agent 关系图 ↔ 看板**（宽屏）、**时间线 ↔ 任务 ↔ 事件流**（纵向高度）

实现：

- [`src/client/components/columnSplitter.tsx`](src/client/components/columnSplitter.tsx)
  - `useColumnSplit`：flex 行内按列宽拖拽（React 状态）
  - `useEdgeResize`：按元素边缘拖拽（支持横向/纵向、上一元素/下一元素，自动识别 grid 容器并改写 `grid-template-columns`）
- **重置排版**：顶部工具栏 ⛶ 左侧的「重置排版」按钮，一键恢复所有面板默认尺寸
  - [`src/client/layoutStore.ts`](src/client/layoutStore.ts)：记录首次拖拽前的内联样式，重置时回滚并通知各组件清空宽度状态

> 窄屏（<900px）自动隐藏拖拽条；DSH 右侧栏本身也支持拖拽 resize，面板放入右侧栏同样可用。

---

## 2. 放大（全屏阅读）

统一的放大层组件 [`src/client/components/textZoom.tsx`](src/client/components/textZoom.tsx)：Portal + `fixed inset-0` 全屏、铺满宽度、等宽字体、
工具条带**紫色 ⛶ 徽标**（用于和 DSH 自带窗口区分）+ 复制 / 查找 / 关闭，`Esc` 关闭。

覆盖的入口：

| 入口 | 行为 |
|---|---|
| 文本区块（工具「描述」、「参数」、系统提示词、消息文本等） | 标题栏 ⛶ → 全宽阅读，保留原文/Markdown、复制、查找 |
| 工具调用卡（`← run_code`） | 卡头 ⛶ → **code + description 合并成一份连续文档**，一键复制 |
| 命令执行「命令」/「结果」 | 区块 ⛶ → 全宽阅读，带复制与查找 |
| 文件活动 | 点文件名或行内 ⛶ → **插件内文件预览**（不再弹 DSH 窗口） |
| 整页视图 | 顶部 ⛶「全屏」→ **原位放大**（不克隆视图），所有按钮/状态保留 |

文件预览由宿主只读接口提供：[`src/host/fileRoute.ts`](src/host/fileRoute.ts)
（`POST /api/dsh-context-explainer/file`，512KB 上限、拒绝二进制、失败给出原因）；
文本放大后保留「在 DSH 中打开」作为兜底入口。

---

## 3. 轮次 / 步数下拉筛选

统计卡片里的 **「N 轮次」** 与 **「N 步数」** 现在是下拉选择器：

- 点「轮次」→ 列出「全部（取消筛选）」+ 每一轮；选中后**下方所有面板**切换为该轮数据
- 点「步数」→ 若已选轮次，只列该轮的步；否则列出全部步（可滚动）
- 选中态数字旁显示 ▾ 并变品牌紫；选择后自动滚动到趋势图

受影响的 panel：上下文统计（轮/步/注入/压缩/剪枝/IO/工具/命令）、趋势图、上下文浏览器、上下文事件、文件活动、命令执行。

实现：[`src/client/scope.ts`](src/client/scope.ts) 对 `ContextTimeline` 做切片（requests/events/nodes/archive/fileOps/commands/spans + 重算 counts），
contextView 统一以 `view` 驱动所有面板。

> 耗时 / Token 统计仍为会话全局口径（依赖无法按轮归属的 spans 与成本数据）。

---

## 4. 其它改动

- **插件信息卡**：移除 DeepSeek 推广卡；「插槽注册」默认**折叠成一行**（插件 id），点击展开 6 条注册明细，id 带彩色标注
- **整页全屏**：由"克隆一份视图"改为**原位放大**（根节点加 `lc-fs-expanded`），按钮与状态完全同步
- **统计行等高**：第一行两块面板高度对齐，内容顶部对齐
- 文档保留：上游 README / docs 未改动

---

## 构建与安装

```bash
pnpm install
pnpm build          # 产出 lib/index.js（host）与 lib/client.js（client）
pnpm typecheck
pnpm test           # 2022+ 用例
```

安装到 DSH profile（`~/.dsh/profiles/<name>/package.json`）：

```json
{
  "dependencies": { "dsh-context-explainer": "link:/path/to/plugins-wip/dsh-context-plugin" },
  "dsh": { "profile": { "bundles": ["...", "dsh-context-explainer"] } }
}
```

然后在该目录 `pnpm install` 并**重启 DSH**。

---

## 已知限制（DSH 侧，插件无权修改）

- DSH 自带的「结果 / 内容 / 应用 / 编辑」窗口：由 DSH 渲染，插件只能决定"打开什么"，不能改其排版与工具条位置
- 内容 Markdown 里的超链接：由 DSH 的 MarkdownText 处理，点击仍走 DSH
- 图片附件：二进制内容仍使用 DSH 查看器（插件放大层是文本层）
