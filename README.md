# Note Workbench

VS Code 独立笔记扩展，使用 TypeScript 开发。当前为 **0.2.0 开发预览，不是需求文档中的完整首版**。

## 本地运行

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

在 VS Code 中打开本项目文件夹，按 F5 运行“运行 Note Workbench”。新窗口默认打开合成样本笔记库 `test/fixtures/vault`。右键 `.md` 文件，选择 **Note Workbench: 打开笔记编辑器**，或通过“重新打开编辑器的方式”选择 Note Workbench。

用户使用打包后的扩展不需要 Node.js/npm，不需要额外服务。`npm run preview` 仅供开发者在浏览器验证界面；它使用内存样本，不会保存笔记文件，也不代表完整 VS Code 宿主行为。

## 这个开发预览包含什么

- 独立自定义 Markdown 编辑器与活动栏笔记列表。
- Markdown/GFM、HTML 样式和静态 SVG；完整 Callout 类型、Wiki 链接、标题/块嵌入、高亮、注释、脚注、代码高亮、公式和 Mermaid。
- 图片尺寸、音视频、离线 PDF 翻页和 Canvas 形状；YAML 属性显隐、cssclasses 与库内 CSS。
- 阅读模式、片段/全文源码编辑、应用修改与 Ctrl+S 保存。
- 普通矩形 Markdown/HTML 表格的富文本展示、片段编辑、边缘增行列、右键菜单及拖动手柄。
- 源码范围检查、文档版本冲突拒绝，保护未被编辑的正文。
- 合成笔记样本、核心测试、VS Code 宿主集成测试和本地打包脚本。

当前编辑是**渲染视图 + 显式应用的源码片段编辑**。尚未实现设计中的连续可视化正文输入；单元格展示富文本，编辑时使用源码片段。已实现范围和验证证据见 [官方格式兼容清单](docs/obsidian-compatibility.md)，没有用单篇报告代替全语法验收。

## 当前限制

- 图谱、反向链接、Wiki 补全、语义查询和 query 嵌入仍待实现；跨篇导航和来源变化刷新已有实现，真实宿主验收未完成。
- 合并单元格、嵌套表格、`colgroup`、省略闭合标签的 HTML 表格使用源码编辑；普通表格嵌在其他 HTML 块内时暂不提供结构控件。
- 行移动不跨 Markdown 表头或 HTML 分区；列移动同步保留原始单元格内容和 Markdown 对齐标记。
- 草稿需要点击“应用修改”或 Ctrl+S 才进入 VS Code 文档。尚未应用的片段不会计入宿主的未保存标记；已在 Webview 状态中保留的草稿仍需应用。使用样本或笔记副本试用。
- 撤销/重做通过稳定文本编辑器路径调用，可能发生短暂的源码视图切换；快捷键和菜单的完整交互还需完善。
- 不宣称已通过完整首版验收，详见 [开发状态](docs/status.md)。

## 打包与测试

```powershell
npm run package
# 输出 artifacts/note-workbench-0.2.0.vsix
```

在 VS Code 扩展面板的“…”菜单中选择“从 VSIX 安装”。打包使用临时 publisher `local-development`，未注册商店身份。不要以该身份公开发布；正式命名前需确定迁移策略。

```powershell
npm run test:extension
```

宿主测试默认下载官方 VS Code 1.100.3 至项目内的 `.vscode-test`，使用独立配置与合成笔记。可设置 `NOTE_WORKBENCH_VSCODE` 指向已有 VS Code 可执行文件，或用 `NOTE_WORKBENCH_VSCODE_VERSION` 选择其他测试版本。下载缓存、依赖、测试配置和 VSIX 均由 `.gitignore` 排除。

测试默认总时限 180 秒；慢速网络可设置 `NOTE_WORKBENCH_TEST_TIMEOUT_MS`。本轮宿主测试受本机更新锁和测试版下载中断影响，尚未完成；详细验证状态见 `docs/status.md`。

Git 已按用户授权在本目录初始化，作者沿用指定现有仓库的姓名和邮箱，仅写入本仓库配置。没有远端地址，不自动推送；GitHub 上传由用户管理，Marketplace 发布延期。

## 文档与许可

- [需求范围](docs/requirements.md)
- [开发设计](docs/development.md)
- [开发状态和验证记录](docs/status.md)
- [官方格式兼容与验收清单](docs/obsidian-compatibility.md)
- [第三方依赖声明](THIRD_PARTY_NOTICES.md)

项目自有代码的公开许可证尚待所有者确定，目前 `UNLICENSED`，仅作本地开发交付。第三方依赖按各自许可证使用，构建工具会生成依赖许可证清单并纳入 VSIX。当前未复制原 Obsidian Visualizer 的实现代码。
