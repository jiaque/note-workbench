# 首版补齐与验收（2026-09-20）

用户确认：本轮补齐首版欠缺功能；大文件处理、query 搜索嵌入、属性语义查询、收藏、最近访问、重命名更新引用、合并单元格、跨区粘贴暂不做。暂不打包、不安装、不发布。

## 本轮实现范围

| 项目 | 实现与验收口径 |
| --- | --- |
| 默认打开 | 自定义编辑器 priority=default；尊重用户既有文件关联 |
| 阅读一致性 | 以实时预览为准，保留段落空行、表头背景、对齐、字体、列宽、行高和换行；阅读时仅隐藏编辑控件 |
| Wiki 补全 | 源码编辑器和实时预览均补全笔记、YAML aliases、标题和块 ID |
| 链接打开 | 重名笔记选择候选；缺失笔记显示创建入口；默认当前目录，可设根目录或指定目录 |
| 反向链接 | 展示每次引用的上下文，并定位来源偏移 |
| 新表格 | 选择数据行数与列数，生成 Markdown，焦点进入第一数据格 |
| 表格键盘 | Tab/Shift+Tab 移格，末格 Tab 加行，Enter 完成本格，Shift+Enter 换行并保存为 br |
| 表格反馈 | 菜单目标高亮、非法操作禁用、增删后焦点定位；拖动 Esc/失焦/版本变化取消及边缘滚动 |
| HTML 列定义 | 普通显式 colgroup/col 随列增删重排；跨样式分组、span 列定义等不安全操作保护源码 |
| 格式操作 | 加粗、斜体、删除线、行内代码、链接、标题、引用、列表、任务；常用快捷键 |
| 撤销与冲突 | 原生撤销重做不切换源码页；对比、另存本地草稿、采用外部版本 |
| 图谱索引 | 文件内容缓存，变更文件更新；缓存语法元数据和引用；进度、取消、手动刷新 |
| 远程图片 | 设置控制 HTTPS 图片，覆盖编辑、阅读、浮层和 PDF；更改后重新打开 |

## 验收记录

- 49 项单元测试、TypeScript 检查、开发构建通过。
- 隔离 VS Code 宿主：真实文档编辑、保存、过期操作拒绝、原生撤销重做通过；撤销/重做前后为同一 CustomEditor 标签页。
- 浏览器：新表格行列选择、首格焦点、末格 Tab 加行、新行首格焦点、Shift+Enter 保存 br、Enter 完成、Wiki 笔记补全写入通过。
- 固定 1280×900 视口对照用户报告的全部 5 张表格、108 个单元格，字体、行高、背景、对齐、内边距及列宽一致；数据坐标容差 0.01px。阅读视图不再切换成另一套表格样式。
- HTML colgroup 实测：列重排后 25%/75% 定义随内容变为 75%/25%；HTML 与 Markdown 两表合计 15 格的实时预览/阅读尺寸和样式一致。非法左移操作禁用。
- 隔离宿主已通过多视图同步、源码补全、未改笔记缓存身份保持、嵌入源更新刷新。
- 隔离宿主已通过新 Markdown 文件默认选用本编辑器、VS Code Auto Save 自动落盘；已有用户文件关联仍优先。
- 浏览器实际鼠标拖动 Markdown 行重排、Ctrl+B 选中文本加粗通过。
- Mermaid.md 中 22 类图表均生成有尺寸的 SVG，浏览器无渲染错误，包含 Flowchart、Sequence、Class、State、ER、Journey、Gantt、Pie、Quadrant、Requirement、Git、Mindmap、Timeline、ZenUML、Usecase、Swimlane、Sankey、XY、Block、Packet、Kanban、Architecture。这是类型代表样例验收，不是所有语法排列组合的证明。
- 原有光标浏览器回归 PASS：点击命中、重复上下移动、渲染回执后继续编辑、源码不变。
- 多窗口关闭恢复、真实输入法、不同平台媒体编码仍需人工验收；本轮未打包或安装。
- 实际中文输入法组合、不同操作系统媒体编码不以普通键盘或合成事件冒充通过。

撤销实现参考 VS Code 自身 [MarkdownEditorProvider](https://github.com/microsoft/vscode/blob/main/extensions/markdown-language-features/src/preview/markdownEditorProvider.ts)：活动 CustomTextEditor 可直接执行原生 undo/redo，无需切换源码编辑器。

Mermaid 验收按锁定的 12.0.0 和[官方语法目录](https://mermaid.js.org/intro/syntax-reference.html)记录；单个样例通过不代表该图类型所有语法组合均已测试。
