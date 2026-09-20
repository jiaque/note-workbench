# Note Workbench — Obsidian-style Editor

<img src="media/icon.png" alt="Note Workbench icon" width="96" height="96">

**Read, edit and connect Markdown notes inside VS Code.**

[简体中文](README.zh-CN.md) · [Install](https://marketplace.visualstudio.com/items?itemName=jiaque.note-workbench) · [Examples](example/README.md) · [Issues](https://github.com/jiaque/note-workbench/issues)

Obsidian-style Live Preview, editable tables and a note graph in your existing workspace. Mix Markdown with supported HTML, preview the block you are editing, and keep your notes in ordinary `.md` files.

**Phase 1 feature development is complete under the agreed scope.** Follow-up improvements and remaining validation are tracked in [Phase 1 scope](docs/phase-one.md).

## See it in action

### Edit with a live block preview

Click into a block to edit its source while a floating preview shows the result. Other blocks keep their rendered appearance.

![Live Preview and floating block preview](docs/images/live-preview.jpg)

Try [example/Welcome.md](example/Welcome.md).

### Work directly in tables

Edit cells, add or remove rows and columns, and drag handles to reorder ordinary Markdown and HTML tables.

![Markdown and HTML table editing](docs/images/tables.jpg)

Try [example/Tables.md](example/Tables.md).

### Follow the connections

Explore global and local graphs, navigate notes, and find backlinks with source context.

![Graph of the fictional Atlas notebook](docs/images/graph.jpg)

Try the linked notes in [example/](example/README.md). These screenshots use purpose-written, fictional content in the extension's local webview preview. They contain no customer documents and do not show the VS Code window chrome.

## Install and get started

Requires **VS Code 1.100.0+**. Using the packaged extension does not require Node.js, npm, Obsidian or Obsidian Visualizer.

1. Open **Extensions** and search for `@id:jiaque.note-workbench`.
2. Install **Note Workbench — Obsidian-style Editor** by **jiaque**.
3. Open your notes folder, then open a `.md` file.
4. Click the **Note Workbench** activity-bar icon to open the graph.

You can also [open the Marketplace listing](https://marketplace.visualstudio.com/items?itemName=jiaque.note-workbench) or run:

```sh
code --install-extension jiaque.note-workbench
```

The extension registers as a default Markdown editor candidate. VS Code preserves an existing editor preference: right-click the file tab and choose **Reopen Editor With → Configure default editor → Note Workbench** to change it. Use **⋯ → Edit in VS Code** for the native source editor.

For a walkthrough, download or clone this repository, open the entire [example](example/README.md) folder in VS Code, and start with [Welcome.md](example/Welcome.md). Wiki links and embeds work in the extension, not GitHub's Markdown viewer.

## Core features

| Area | Included |
| --- | --- |
| Editing | Live Preview, reading/source views, optional floating block preview, save, Auto Save and native undo/redo |
| Markdown and HTML | CommonMark/GFM, supported HTML, callouts, highlighting, comments, footnotes, code highlighting and YAML properties |
| Equations and diagrams | Locally bundled MathJax and Mermaid, with source editing and rendering |
| Linked notes | Wiki links, aliases, heading/block links, completion, missing-note creation, whole-note/heading/block embeds |
| Graph | Global/local views, backlinks, filtering, zoom/pan, dragging and remembered layout controls |
| Tables | Cell editing, row/column insertion and deletion, drag reordering, keyboard navigation and new Markdown tables |
| Attachments | Local images, configurable HTTPS images, audio/video and embedded PDF navigation |
| PDF export | Supported styling, equations, diagrams, images and note embeds, using an installed Chrome or Edge |
| Presentation | Vault CSS, explicit CSS motion presets and isolated animated SVG images |
| Languages | English and Simplified Chinese; follows VS Code by default |

Reading and Live Preview share the document and table layout. Source remains the stored representation: table edits do not convert the whole note to another format.

## Everyday actions

The **⋯** menu contains view switching, table insertion, properties, PDF export, motion controls and saving. Formatting buttons are intentionally omitted.

| Action | Shortcut or control |
| --- | --- |
| Save | `Ctrl/Cmd+S`; also respects VS Code Auto Save |
| Switch editing/reading | `Ctrl/Cmd+E` |
| Find in the current note | `Ctrl/Cmd+F`; `Enter` / `Shift+Enter` or `F3` / `Shift+F3` for next/previous; `Esc` to close |
| Bold / italic | `Ctrl/Cmd+B` / `Ctrl/Cmd+I` |
| Link / strikethrough | `Ctrl/Cmd+K` / `Ctrl/Cmd+Shift+X` |
| Next / previous table cell | `Tab` / `Shift+Tab` |
| Finish cell edit / cell line break | `Enter` / `Shift+Enter` |
| Append a table row | `Tab` from the final cell, or the bottom `+` |
| Reorder rows or columns | Edge handles or the table menu |
| Complete a note / heading / block | `[[`, `[[Note#` or `[[Note#^` |

Leaving an edited block syncs changes to the VS Code document. Writing to disk follows Auto Save or explicit saving. External conflicts expose compare, draft recovery and external-version actions in the note menu.

Use ordinary Markdown syntax for headings, quotes, inline code and lists; more one-step formatting shortcuts are deferred. Missing-note links offer a creation choice before creating a file.

Find supports case matching, result counts and highlighting in all three views. Live Preview and Source search the full Markdown source, including syntax; Reading searches rendered text and unfolds matching content. Switching views retains the query but can change the result count. Search does not modify the note.

## Settings

Search for `noteWorkbench` in Settings. Options appear in this order:

| Setting (`noteWorkbench.` prefix) | Default | Purpose |
| --- | --- | --- |
| `language` | `auto` | Follow VS Code, or choose `zh-CN` / `en`; reload the window after changing |
| `editor.blockPreview.enabled` | `true` | Floating preview for non-table blocks |
| `render.motion.enabled` | `true` | Motion; respects reduced-motion preferences; applies immediately |
| `render.remoteImages` | `true` | Allow HTTPS images; reopen the note after changing |
| `styleSheets` | `[]` | Vault-relative CSS files, in order; reopen after changing |
| `notes.newLocation` | `current` | Current folder, vault `root`, or custom `folder` |
| `notes.newFolder` | Empty | Vault-relative folder for the `folder` option |
| `graph.include` | `[]` | Include globs; empty means all Markdown notes |
| `graph.exclude` | `**/{node_modules,.git,.npm-cache}/**` | Exclude globs |
| `pdf.browserPath` | Empty | Chrome/Edge executable; empty enables automatic detection |

Auto uses Simplified Chinese for Chinese VS Code locales and English for other locales. Settings descriptions, command names and the sidebar title always follow VS Code's language, independently of the extension override. Note content is never translated.

## CSS motion and SVG

Enable motion explicitly on a block:

```html
<div data-nw-effect="progress-striped"
     style="--nw-progress:60%;--nw-color:#2563eb;">
  Example plan: 60% complete
</div>
```

There are 34 presets across continuous, entrance and hover effects. Use **⋯ → Motion controls** to pause/resume or replay SVG. Disabling motion retains static content and progress values.

Write SVG directly in a note: supported CSS/SMIL animations play in an isolated image after filtering. SVG scripts and interactive controls inside the image are not supported. PDF uses the static base appearance.

Try [example/Motion.md](example/Motion.md). Full parameters and boundaries: [motion design](docs/css-motion-design.md) and [implementation notes](docs/motion-implementation.md) (Chinese).

## Scope and limitations

- **Tables:** merged, nested/irregular HTML tables and tables inside mixed HTML containers use source editing. Visual merge/split, cross-table paste and column-width dragging are not included.
- **HTML:** tags, styles and URLs are filtered for display. Arbitrary scripts do not run; Markdown is not recursively parsed inside every HTML container.
- **PDF:** needs local Chrome/Edge. Attached PDFs and audio/video become text notices, not merged pages or playable media. Check unusually wide tables and custom print layouts.
- **Workspace:** Windows desktop with a local folder is the primary target. Large-file optimization, multi-root/remote/web validation and query features are outside the completed phase.
- **Validation:** automated and host checks cover specific scenarios. Full real-IME, multi-window recovery, keyboard/accessibility, theme/zoom and performance validation remain open.

See [Phase 1 scope and follow-up work](docs/phase-one.md). This is not a promise of compatibility with every Obsidian plugin or theme.

## Develop locally

Development requires **Node.js 22+ and npm**.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Open the repository in VS Code and press **F5** to launch the development host. Its default workspace uses synthetic test fixtures; the public walkthrough is in [example/](example/README.md).

```sh
npm run test:extension
npm run package
```

Packaging creates `artifacts/note-workbench-<version>.vsix`. Install through **Extensions → ⋯ → Install from VSIX**. Packaging does not publish or push. The formal ID is `jiaque.note-workbench`; `local-development.note-workbench` is the separate maintenance identity. Avoid enabling both for the same workflow.

When the matching development version is already installed, run `npm run build`, then `npm run sync:dev`, and reload the VS Code window. Sync copies and verifies the **entire** build, including hashed chunks; copying only `editor.js` can produce a blank editor. Use `npm run sync:dev -- --check` to verify without copying. Manifest/version changes still require installing an updated development package.

Host tests use an isolated profile. Set `NOTE_WORKBENCH_VSCODE` to an existing VS Code executable to avoid the default runtime download. `npm run preview` is a development-only webview preview: edits stay in memory and do not save the example file. See [screenshot reproduction](docs/images/README.md).

## Feedback and license

[Report an issue](https://github.com/jiaque/note-workbench/issues) with the VS Code/extension versions, a small reproducible note, and expected versus actual behavior. Remove private information before sharing.

Project code uses [Apache-2.0](LICENSE). See [NOTICE](NOTICE) and [third-party notices](THIRD_PARTY_NOTICES.md). References: [development design](docs/development.md), [format compatibility](docs/obsidian-compatibility.md), [changelog](CHANGELOG.md).

Note Workbench is independent, not an official Obsidian product and not endorsed by Obsidian. Obsidian and other trademarks belong to their respective owners.
