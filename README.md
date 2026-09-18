# Note Workbench — Obsidian-style Editor

<img src="media/icon.png" alt="Note Workbench" width="96" height="96">

在 VS Code 中使用 Obsidian 风格的实时编辑、笔记连接图与 Markdown/HTML 混排。支持块预览浮层和表格原位编辑，让笔记阅读、修改和关系浏览在同一个工作区完成。

本项目为独立开发的 VS Code 扩展，非 Obsidian 官方产品，未获其官方背书；运行时无需安装 Obsidian 或 Obsidian Visualizer。Obsidian 名称及相关商标归其各自权利人所有。

使用 TypeScript 开发，当前为 **0.5.3 开发预览，不是需求文档中的完整首版**。

## 从 VS Code 扩展商店安装

需要 VS Code **1.100.0 或更新版本**。日常使用无需安装 Node.js、npm 或 Obsidian。

1. 打开 VS Code，点击左侧的 **扩展** 图标，或按 `Ctrl+Shift+X`（macOS：`Cmd+Shift+X`）。
2. 搜索 **Note Workbench**，选择发布者为 **jiaque** 的 **Note Workbench — Obsidian-style Editor**。也可以输入 `@id:jiaque.note-workbench` 精确查找。
3. 点击 **安装**，按 VS Code 提示完成安装。
4. 打开你的笔记文件夹，在资源管理器中右键一个 `.md` 文件，选择 **Note Workbench: 打开笔记编辑器**，即可开始实时预览编辑。

也可以打开 [Visual Studio Marketplace 扩展页面](https://marketplace.visualstudio.com/items?itemName=jiaque.note-workbench)，或在已配置 `code` 命令的终端中执行：

```shell
code --install-extension jiaque.note-workbench
```

安装后，点击左侧活动栏的 **Note Workbench** 图标可查看笔记连接图。已打开的 Markdown 文件也可以通过标签页右键菜单中的 **重新打开编辑器的方式… → Note Workbench** 切换编辑器。

如果暂时搜索不到，请先使用完整扩展 ID 查询或打开上面的商店链接；仍在审核中的版本需要等待商店验证完成。安装操作说明可参考 [VS Code 官方扩展文档](https://code.visualstudio.com/docs/configure/extensions/extension-marketplace)。

## 本地开发运行

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

在 VS Code 中打开本项目文件夹，按 F5 运行“运行 Note Workbench”。新窗口默认打开合成样本笔记库 `test/fixtures/vault`。右键 `.md` 文件，选择 **Note Workbench: 打开笔记编辑器**，或通过“重新打开编辑器的方式”选择 Note Workbench。

用户使用打包后的扩展不需要 Node.js/npm，不需要额外服务。`npm run preview` 仅供开发者在浏览器验证界面；它使用内存样本，不会保存笔记文件，也不代表完整 VS Code 宿主行为。

## 这个开发预览包含什么

- 独立自定义 Markdown 编辑器与活动栏连接图，支持全局/局部图、反向链接、四边停靠和参数记忆。
- Markdown/GFM、HTML 样式和静态 SVG；完整 Callout 类型、Wiki 链接、标题/块嵌入、高亮、注释、脚注、代码高亮、公式和 Mermaid。
- 图片尺寸、音视频、离线 PDF 翻页和 Canvas 形状；YAML 属性显隐、cssclasses 与库内 CSS。
- 默认实时预览直接输入、阅读/源码模式切换与 Ctrl+S 保存。
- 导出 PDF：笔记右上角“··· → 导出 PDF”，或命令面板执行 **Note Workbench: 导出 PDF**，选择保存位置。
- 非表格块编辑时，上方浮层实时显示渲染结果；设置 `noteWorkbench.editor.blockPreview.enabled` 默认开启。离开块同步文档，落盘由 Ctrl+S / VS Code Auto Save 负责。
- 普通矩形 Markdown/HTML 表格的富文本展示、单击单元格直接输入、边缘增行列、右键菜单及拖动手柄。
- 源码范围检查、文档版本冲突拒绝，保护未被编辑的正文。
- 合成笔记样本、核心测试、VS Code 宿主集成测试和本地打包脚本。

正文默认在同一个 CodeMirror 文档中直接编辑：光标进入格式区域时显示对应语法，其余部分使用统一渲染结果。单元格单击输入并自动同步，无需“应用”。已实现范围和验证证据见 [官方格式兼容清单](docs/obsidian-compatibility.md)，没有用单篇报告代替全语法验收。

## 当前限制

PDF 默认白底 A4、展开折叠块、隐藏编辑控件，导出点击时已同步的内容，无需先保存 Markdown。支持中文、普通表格、HTML 样式、公式、Mermaid、图片和笔记嵌入；多页表格重复表头。使用本机 Chrome / Edge，自动检测优先 Chrome；也可在 `noteWorkbench.pdf.browserPath` 指定可执行文件。没有浏览器时会给出提示，不自动下载浏览器。PDF/音视频附件显示文字提示，不合并附件页或播放内容；超宽表格、复杂打印 CSS 仍需检查导出结果。无法加载图片或渲染图表时报告失败，不假称成功。

- Wiki 补全、语义查询和 query 嵌入仍待实现；图谱目前采用防抖全量扫描，尚无大库性能验收，也不自动导入旧扩展私有布局状态。跨篇导航和来源变化刷新已有实现，真实宿主验收未完成。
- 合并单元格、嵌套表格、`colgroup`、省略闭合标签的 HTML 表格使用源码编辑；普通表格嵌在其他 HTML 块内时暂不提供结构控件。
- 行移动不跨 Markdown 表头或 HTML 分区；列移动同步保留原始单元格内容和 Markdown 对齐标记。
- 正文输入短暂合并后同步到 VS Code 文本文档，Ctrl+S 会先排空编辑队列再保存。外部冲突时停止覆盖并保留本地内容，可从笔记菜单复制；真实宿主关闭恢复、输入法和撤销验收仍需完成。
- 撤销/重做通过稳定文本编辑器路径调用，可能发生短暂的源码视图切换；快捷键和菜单的完整交互还需完善。
- 不宣称已通过完整首版验收，详见 [开发状态](docs/status.md)。

## 打包与测试

```powershell
npm run package
# 输出 artifacts/note-workbench-0.5.3.vsix
```

在 VS Code 扩展面板的“…”菜单中选择“从 VSIX 安装”。发布配置使用发布者 ID `jiaque`（发布者显示名称：jiaque），扩展标识为 `jiaque.note-workbench`。此前 `local-development.note-workbench` 为独立的本地开发身份，安装此包不会自动将其替换；切换时请禁用或卸载旧身份版本，避免重复菜单和编辑器入口。

```powershell
npm run test:extension
```

宿主测试默认下载官方 VS Code 1.100.3 至项目内的 `.vscode-test`，使用独立配置与合成笔记。可设置 `NOTE_WORKBENCH_VSCODE` 指向已有 VS Code 可执行文件，或用 `NOTE_WORKBENCH_VSCODE_VERSION` 选择其他测试版本。下载缓存、依赖、测试配置和 VSIX 均由 `.gitignore` 排除。

测试默认总时限 180 秒；慢速网络可设置 `NOTE_WORKBENCH_TEST_TIMEOUT_MS`。本轮宿主测试受本机更新锁和测试版下载中断影响，尚未完成；详细验证状态见 `docs/status.md`。

源码仓库：[jiaque/note-workbench](https://github.com/jiaque/note-workbench)。构建命令只生成 VSIX，不自动推送 Git 或发布 Marketplace；商店上线状态以发布者管理页面为准。

## 文档与许可

- [需求范围](docs/requirements.md)
- [开发设计](docs/development.md)
- [开发状态和验证记录](docs/status.md)
- [官方格式兼容与验收清单](docs/obsidian-compatibility.md)
- [第三方依赖声明](THIRD_PARTY_NOTICES.md)

项目自有代码采用 [Apache License 2.0](LICENSE)，项目署名见 [NOTICE](NOTICE)。第三方依赖保留各自的许可证及声明，构建工具会生成依赖许可证清单并纳入 VSIX。当前未复制原 Obsidian Visualizer 的实现代码。此许可证不授予 Obsidian 等第三方商标的使用权。
