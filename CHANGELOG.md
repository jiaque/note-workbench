# Changelog

## 0.5.2 — 2026-09-18

- Correct the Marketplace publisher identifier to `jiaque`, as confirmed by the upload validation response. The extension ID is `jiaque.note-workbench`.

## 0.5.1 — 2026-09-18

- Set the owner-provided publisher identity and the Note Workbench — Obsidian-style Editor display name.
- Add repository, issue tracker, homepage and discovery keywords; enable Marketplace README link rewriting.
- Retain the existing 0.5.0 features and document migration from the local development extension identity.

## 0.5.0 — 2026-09-18

- Add PDF export from the note menu and command palette, including synchronized unsaved edits.
- Render with the existing Markdown/HTML pipeline and a local headless Chrome/Edge profile; wait for Mermaid, fonts and images before printing.
- Add white A4 print styling, expanded callouts, repeated table headers, cancellation and explicit failure reporting.
- Include Apache-2.0 license files in the packaged extension.

## 0.4.1 — 2026-09-18

- Show complete, uniformly styled source in active Markdown headings; render their heading and inline HTML styles in the floating preview and inactive headings.
- Preserve existing paragraph and table cell formatting; restore heading rendering on blur.

## 0.4.0 — 2026-09-18

- Add default-on live block preview overlay with shared rendering, stale-result protection and a VS Code setting.
- Keep blur synchronization separate from disk saving; retain Ctrl+S and VS Code Auto Save semantics.
- Replace table textareas with formatted inline editors, remove cell outlines and restore compact layout/style precedence.
- Replace the duplicate file sidebar with an independent interactive connection graph, local/global scopes, backlinks, filters and persisted dock/orientation settings.
- Add graph resolution and preview regression coverage; document browser evidence separately from blocked host integration tests.

## 0.3.0 — 2026-09-18

- Replace block edit buttons and explicit draft application with a persistent full-document Live Preview editor.
- Reveal formatting syntax at the caret and share sanitized rendering with reading view; preserve inline HTML styles, nested emphasis and inline math.
- Edit table cells with one click and automatic synchronization; retain input focus across acknowledgements and cell changes.
- Serialize host edits without overwriting later typing, preserve CRLF offsets, and drain queued changes before saving.
- Add synchronization, conflict, newline and decoration regression tests; record browser interaction evidence and remaining host validation separately.

## 0.2.0 — Formatting compatibility preview

- 去掉顶部品牌栏和重复文件名，表格操作收进右键菜单与边缘控件，保留富文本展示。
- 按官方文档补充全部 Callout 类型/别名、代码高亮、注释、高亮、标签、全局脚注、图片尺寸、块 ID 和笔记嵌入。
- 保留受限 HTML 样式与静态 SVG；扩展 MathJax、PDF/媒体/Canvas 展示，支持 cssclasses 和库内样式表。
- 新增全语法合成笔记、附件与回归测试。完整兼容验收和完整首版尚未完成，详见兼容清单。

## 0.1.0 — Development preview

- 创建独立 VS Code 自定义编辑器、活动栏笔记列表与构建配置。
- 增加 Markdown/HTML、公式和 Mermaid 基础渲染。
- 实现源码片段编辑及普通表格增删、重排操作。
- 增加范围/版本校验、保真核心测试、宿主测试和本地 VSIX 打包。
- 完整首版功能及当前限制见 `docs/status.md`，本版本不在 Marketplace 发布。
