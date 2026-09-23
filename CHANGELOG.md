# Changelog

## Unreleased

- Restrict blank-gap deletion outlines to actual empty line boxes, avoiding highlights that overlap adjacent rendered callouts or images.

## 0.6.3 — 2026-09-23

- Rebase table actions after edits elsewhere in a note instead of rejecting a valid unchanged table. Separate the block-delete button from the table's add-column hit area.

- Treat standalone navigation anchors as part of the following block and standalone Obsidian block IDs as part of the preceding block when deleting. Preserve next-section anchors and focus visible content after deletion. Delete balanced HTML containers across Markdown node boundaries without leaving closing tags.

- Remove adjacent blank separators when deleting blocks so repeated insert/delete cycles do not expand spacing. Allow excess blank gaps to be deleted, and reuse Markdown syntax trees across live preview and formatting controls to reduce typing work.

- Show the floating preview immediately after inserting an empty paragraph. Add a hover-only block delete button, a pale red outline only when hovering that button, and undo support.

- Keep block previews and source selections active when opening formatting menus; restore selections across host undo/redo so formatting can continue immediately. Use chain-link and highlighted-A toolbar icons.

- Add contextual formatting controls, source caret/selection hints in block previews, local image/file path completion and URL paste over selected text.
- Add a hover-only paragraph insertion button between top-level blocks; its right-click menu inserts tables or managed Markdown TOCs and dismisses when the pointer moves away.
- Add configurable H1–H6 TOC ranges, automatic/manual updates, per-heading exclusion, bilingual settings and a writing-helpers example.

- Accept and discard the standard SVG 1.1 public doctype emitted by plotting tools without loading a DTD; retain entity and active-content restrictions. Show readable image paths and actual loading errors instead of reporting all failures as missing files.

## 0.6.2 — 2026-09-22

- Give tables inside callouts accent-tinted headers, alternating row backgrounds and borders in rendered views and PDF output, following the nearest callout color.

- Keep floating block previews clear of the editable line after delayed image loads, image failures and editor reflow; anchor above previews by their bottom edge and track layout changes.

## 0.6.1 — 2026-09-21

- Tune A4 PDF output for printing with 12 mm side margins, 10.5 pt body text and 9.5 pt tables; keep editor display styles unchanged.

- Wrap long code-block lines in Live Preview, reading mode and block previews without changing source text or expanding the page width.

- Add structured SVG tooltip cards with bold titles, safe series-color dots and right-aligned values. Keep plain-text declarations compatible; document full-plot category bands for line/bar/stacked charts and include browser regression coverage.

- Add declared SVG hover regions with plain-text tooltips, exact path hit detection, viewBox scaling and preserved image isolation. Include bilingual chart examples.
- Update note references on VS Code file/folder rename and move, preserving aliases, fragments and dirty document contents; skip ambiguous targets. Add an enabled-by-default setting.
- Add a filterable native Tags panel using inline/frontmatter tags and the existing note index; clicking a rendered tag opens the panel.

- Keep focus in table cells when clicking nested code or styled text: consume the cell mouse event before replacing its rendered content, preventing the outer Live Preview widget from reopening the table's source position.

- Make inline formatting toggle existing surrounding markers off rather than adding another pair. Keep selected whitespace outside emphasis and use equivalent inline HTML for punctuation boundaries that cannot be expressed with Markdown emphasis without changing text spacing.

## 0.6.0 — 2026-09-20

- Fix local development update white screens caused by missing hashed JavaScript chunks. Add `npm run sync:dev` to copy and verify the complete build while preserving the development extension identity.

- Prevent handled formatting and editor shortcuts from also triggering VS Code commands; retain host shortcuts outside the editor and unhandled modifier combinations.

- Add document find in Live Preview, Reading and Source with Ctrl/Cmd+F, next/previous navigation, result counts, case matching and highlights.
- Search full source in editing views and rendered text in Reading; reveal table matches and folded reading content without changing the document.
- Keep search-input undo separate from document undo. Add literal/Unicode search tests and a real-browser regression (`npm run test:find`).
- Provide English and Chinese READMEs, a fictional example notebook and screenshots of Live Preview, tables and the graph.

## 0.5.7 — 2026-09-20

- Add `noteWorkbench.language`: follow VS Code by default, or choose Simplified Chinese / English. Reload Window applies changes.
- Localize note and table menus, live block previews, graph controls, PDF UI and extension messages without changing authored content.
- Localize manifest descriptions, settings and command titles using VS Code's display language.
- Adapt motion submenu width to English labels and test locale precedence, placeholder parity and content preservation.

## 0.5.6 — 2026-09-20

- Replace the long document menu with a compact view switcher and grouped actions.
- Remove formatting buttons from the menu while retaining formatting shortcuts.
- Group motion pause/resume and SVG replay in a submenu, with keyboard navigation and an inline layout in narrow windows.
- Preserve property visibility, table insertion, PDF export, save and conflict recovery actions.

## 0.5.5 — 2026-09-20

- Add 34 opt-in motion presets with typed inline parameters; motion is enabled by default and can be disabled live in settings.
- Respect reduced-motion preferences and provide note-level pause/resume and SVG replay controls.
- Filter author SVG into isolated images, retaining editable source and CSS/SMIL animations; provide static image variants for disabled motion and PDF.
- Share disclosure styling and preserve open/closed state across Live Preview and reading mode.
- Parse CSS declarations structurally and keep existing table layout and document editing behavior.

## 0.5.4 — 2026-09-20

- Register Note Workbench as a default editor candidate for Markdown; existing user editor associations retain precedence.
- Preserve source blank-line spacing in reading view and share Live Preview block containers and table layout, without editing controls.
- Add Wiki note/alias/heading/block completion, missing-note creation, ambiguity selection and backlink occurrence navigation.
- Cache note contents and parsed link metadata for incremental graph updates, with progress and cancellation.
- Add table insertion, last-cell Tab append, Shift+Enter line breaks, disabled invalid actions and HTML colgroup edits.
- Add formatting actions and shortcuts, native undo/redo without source-view switching, and conflict comparison/recovery choices.
- Add a remote-image setting for note views and PDF, and bundle the official ZenUML renderer.

## 0.5.3 — 2026-09-18

- Add a dedicated note-and-graph icon for the extension listing.
- Fix mouse caret placement and Up/Down navigation after rendered tables and callouts by including block margins in CodeMirror widget measurements.
- Keep the active block editable while moving within it; retain existing heading, inline formatting and table editing behavior.
- Add a real-browser regression for hit testing, repeated vertical movement and render acknowledgements (`npm run test:caret` after building).

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
