# CSS 动效与动态 SVG

普通正文保持原样。下面的块显式启用了动效。

<div data-nw-effect="breathe" data-nw-hover="lift" style="--nw-duration:2s;--nw-color:#2563eb;padding:16px;border-radius:8px;background-color:#edf5ff;">呼吸光晕 · 悬停上浮</div>

<div data-nw-effect="shine" style="--nw-duration:2s;--nw-color:#67e8f9;padding:16px;border-radius:8px;background-color:#172554;color:white;">流光提示卡片</div>

<div data-nw-effect="progress-striped" style="--nw-progress:65%;--nw-color:#22c55e;">项目完成 65%</div>

<div data-nw-effect="progress-ring" style="--nw-progress:65%;--nw-color:#2563eb;">环形进度 65%</div>

> [!note]+ Markdown 折叠块
> 标题仍可点击折叠，正文仍可点击编辑。

<details open><summary>HTML 折叠块</summary><p>与 Markdown 折叠块保持一致的标题操作和间距。</p></details>

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80"><title>移动圆点</title><rect x="20" y="30" width="200" height="8" rx="4" fill="#e2e8f0"/><circle cx="24" cy="34" r="10" fill="#2563eb"><animate attributeName="cx" values="24;216;24" dur="3s" repeatCount="indefinite"/></circle><text x="20" y="66" font-size="14" fill="#334155">流程执行中</text></svg>

| 表格 | 内容 |
| --- | --- |
| 保持样式 | 可以编辑 |

末尾正文用于验证光标与滚动位置。
