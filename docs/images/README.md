# README screenshots

These are real captures of the extension's webview renderer using the fictional Atlas notebook in [example](../../example/README.md). No user reports or supplied screenshots are included. The captures show the local development preview, without VS Code window chrome.

| Image | Source and state |
| --- | --- |
| `live-preview.jpg` | `example/Welcome.md`; edit the “A small experiment” callout to show the floating preview |
| `tables.jpg` | `example/Tables.md`; click the “In progress” cell |
| `graph.jpg` | Graph of the linked Markdown files in `example/` |

## Reproduce

After installing development dependencies and running `npm run build`, run this from the repository root in PowerShell:

```powershell
$env:NOTE_WORKBENCH_PREVIEW_LANGUAGE = 'en'
$env:NOTE_WORKBENCH_PREVIEW_FILE = 'example/Welcome.md'
$env:NOTE_WORKBENCH_PREVIEW_PORT = '4331'
npm run preview
```

Open the printed local URL for the editor, or its `/graph` route for the graph. For tables, restart with `example/Tables.md`. Activate the state listed above and capture the browser viewport. These images were captured with the extension's current default styling; browser dimensions and theme can affect layout.

Preview edits stay in memory. This preview is intended for rendering and interaction development, and does not demonstrate VS Code file saving or all host integrations. To experience those, open the example folder in VS Code with the extension installed.

截图全部来自自建虚构样例。复现时使用英文界面，分别进入浮层预览、单元格编辑和连接图状态。浏览器预览中的修改不写入样例文件；实际保存与宿主行为应在 VS Code 中体验。
