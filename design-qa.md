# Compact document menu — 2026-09-20

Reference: approved generated mock `exec-1832d2df-6d23-41bd-b2cc-8d130309c215.png`.
Implementation: local editor at http://127.0.0.1:4326/, menu and motion submenu expanded; browser screenshots captured during this change.

Scope: menu only. Reference document copy and enlarged raster scale are illustrative; production keeps the existing document and VS Code typography/theme. The actual menu is 280 CSS pixels wide and approximately 320 pixels high. Comparisons cover the same expanded menu state, not pixel identity of the surrounding document.

- Typography: 14px system menu text; 13px segmented view labels; muted shortcut text. No wrapping in action labels.
- Layout: three equal view segments, three divider-separated action groups, left-opening two-item motion submenu, trailing property state and shortcut.
- Colors: theme-aware surfaces and borders; subtle selected-view blue, restrained hover and shadow.
- Assets: existing Lucide library provides the outline icons; no raster imagery is required inside the menu.
- Content: approved labels retained; formatting section removed. Conflict recovery remains available when needed.
- Interaction checks: reading/source/live switching, property state, table dialog, pause/resume label, and Escape dismissal checked in the browser. Found and fixed Escape being captured after the submenu closed; recheck confirms the second Escape closes the main menu.
- Responsive behavior: narrow/short viewport CSS places the submenu inline and allows vertical scrolling; not separately browser-tested in this pass.

No remaining P0/P1/P2 menu findings. Intentional differences: native theme colors, compact production scale, and no decorative pointer on the popover.

final result: passed
