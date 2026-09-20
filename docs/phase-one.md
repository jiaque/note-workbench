# Phase 1 scope / 第一阶段范围

Updated: 2026-09-20 · Version: 0.5.7

Phase 1 feature development is complete under the scope confirmed by the project owner. This is a scope decision, not a claim that every acceptance scenario has passed. This record supersedes earlier pending-item lists where they conflict with this decision.

第一阶段按项目负责人确认的范围完成。此前尚未补齐的功能本轮暂缓，不再作为第一阶段阻塞项；这不代表所有验收场景均已验证。历史文档中的待办如与此记录冲突，以本次范围确认为准。

## Included / 已包含

Live Preview and floating block previews; reading/source views; Markdown and supported HTML; equations and Mermaid; wiki links, aliases, heading/block references and note embeds; missing-note creation; ordinary table editing and reordering; graph and backlinks; PDF export; configurable CSS motion and isolated animated SVG; English/Chinese UI and ordered settings.

实时预览与浮层、阅读/源码视图、Markdown 与受支持的 HTML、公式与 Mermaid、双链/别名/标题和块引用/笔记嵌入、缺失笔记创建、普通表格编辑与重排、连接图与反链、PDF 导出、可配置 CSS 动效与隔离 SVG，以及中英文界面和设置排序。

## Deferred / 暂缓

- Additional formatting shortcuts for inline code, headings, quotes and lists. Markdown syntax remains supported.
- Direct table controls within mixed HTML containers; merged-cell editing and cross-region paste.
- Duplicate block-ID warnings and retaining a previous-note label after switching to non-Markdown files.
- Large-file optimization, query embeds and semantic property queries.
- Favorites, recent-note lists and updating references on rename.

对应暂缓项：更多格式快捷键（语法仍支持）、混合 HTML 容器内表格控件、合并单元格与跨区粘贴、重复块 ID 提示、切换非 Markdown 后的上一篇笔记提示、大文件优化、查询嵌入/属性查询、收藏/最近访问、重命名更新引用。

## Validation / 验证边界

Existing records include 61 unit tests and isolated VS Code host checks. Further validation remains for real IME input, multi-window close/recovery, full keyboard accessibility, dark/high-contrast themes and zoom, performance, and platform-dependent media behavior. Passing individual checks does not establish complete cross-platform compatibility.

已有记录包含 61 项单元测试与隔离 VS Code 宿主检查。真实输入法、多窗口关闭/恢复、完整键盘可访问性、深色/高对比度/缩放、性能和平台媒体行为仍需继续验证。本次 README、样例及截图更新不增加代码测试结论。

See [development history](status.md), [English README](../README.md) and [中文说明](../README.zh-CN.md).
