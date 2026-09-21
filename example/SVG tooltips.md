---
tags: [examples/charts, svg]
---

# SVG hover tips / SVG 数据提示

Hover over a point, bar or sector. Data is authored as plain text; the extension does not calculate values.

将鼠标移到圆点、柱子或扇区上查看数据。提示由作者填写，不自动计算。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240">
  <title>Chart regions with hover tips</title>
  <path d="M30 180 L100 130 L170 155 L240 60" fill="none" stroke="#1685ef" stroke-width="3"/>
  <circle cx="30" cy="180" r="8" fill="#1685ef" data-nw-tip="June&#10;New customers: 33.0k"/>
  <circle cx="100" cy="130" r="8" fill="#1685ef" data-nw-tip="July&#10;New customers: 53.5k"/>
  <circle cx="170" cy="155" r="8" fill="#1685ef" data-nw-tip="August&#10;New customers: 41.7k"/>
  <circle cx="240" cy="60" r="8" fill="#1685ef" data-nw-tip="September&#10;New customers: 73.8k"/>
  <rect x="310" y="120" width="48" height="70" fill="#23b6aa" data-nw-tip="Team A: 70"/>
  <rect x="310" y="70" width="48" height="50" fill="#8f6ce8" data-nw-tip="Team B: 50"/>
  <path d="M480 125 L480 55 A70 70 0 1 1 410 125 Z" fill="#23b6aa" data-nw-tip="Completed: 75%"/>
  <path d="M480 125 L410 125 A70 70 0 0 1 480 55 Z" fill="#8f6ce8" data-nw-tip="Remaining: 25%"/>
  <text x="85" y="222" fill="currentColor">Line / 折线</text>
  <text x="290" y="222" fill="currentColor">Stack / 堆积</text>
  <text x="438" y="222" fill="currentColor">Pie / 饼图</text>
</svg>

```html
<circle cx="100" cy="130" r="8"
        fill="#1685ef" data-nw-tip="July&#10;New customers: 53.5k"/>
```

For a larger hover target, add a transparent shape in the same SVG:

```html
<rect x="80" y="40" width="40" height="150"
      fill="transparent" data-nw-tip="July&#10;New customers: 53.5k&#10;Existing customers: 200k"/>
```

`&#10;` separates lines. Overlapping regions use the last declared matching shape. Ordinary SVG images without annotations are unchanged.

## Axis bands / 分类区间提示

Move anywhere above or below a point within its month. The card lists authored values; no totals are calculated.

鼠标进入某月份对应的竖向区间即可查看所有系列，不必对准圆点。提示值由作者填写，不自动计算合计。

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240">
  <title>Monthly axis-band tooltips</title>
  <path d="M40 30 H560 M40 110 H560 M40 200 H560" fill="none" stroke="#e5e7eb"/>
  <path d="M100 85 L300 60 L500 75" fill="none" stroke="#20b6b0" stroke-width="3"/>
  <path d="M100 155 L300 140 L500 150" fill="none" stroke="#3987ff" stroke-width="3"/>
  <path d="M100 193 L300 190 L500 192" fill="none" stroke="#9260eb" stroke-width="3"/>
  <circle cx="100" cy="85" r="4" fill="#20b6b0"/>
  <circle cx="300" cy="60" r="4" fill="#20b6b0"/>
  <circle cx="500" cy="75" r="4" fill="#20b6b0"/>
  <text x="80" y="224" fill="currentColor">2025-08</text>
  <text x="280" y="224" fill="currentColor">2025-09</text>
  <text x="480" y="224" fill="currentColor">2025-10</text>
  <rect x="40" y="30" width="160" height="170" fill="transparent"
        data-nw-tip-title="2025-08"
        data-nw-tip-rows='[{"label":"老客户","value":"210.0万","color":"#20b6b0"},{"label":"新客户","value":"41.7万","color":"#3987ff"},{"label":"试用客户","value":"0.8万","color":"#9260eb"}]'/>
  <rect x="200" y="30" width="200" height="170" fill="transparent"
        data-nw-tip-title="2025-09"
        data-nw-tip-rows='[{"label":"老客户","value":"240.2万","color":"#20b6b0"},{"label":"新客户","value":"53.8万","color":"#3987ff"},{"label":"试用客户","value":"1.1万","color":"#9260eb"}]'/>
  <rect x="400" y="30" width="160" height="170" fill="transparent"
        data-nw-tip-title="2025-10"
        data-nw-tip-rows='[{"label":"老客户","value":"220.0万","color":"#20b6b0"},{"label":"新客户","value":"46.1万","color":"#3987ff"},{"label":"试用客户","value":"0.9万","color":"#9260eb"}]'/>
</svg>

```html
<rect x="200" y="30" width="200" height="170" fill="transparent"
      data-nw-tip-title="2025-09"
      data-nw-tip-rows='[{"label":"老客户","value":"240.2万","color":"#20b6b0"},{"label":"新客户","value":"53.8万","color":"#3987ff"}]'/>
```

For horizontal bars, use horizontal category bands across the full plot width. For grouped/stacked columns, use one vertical band per category and list its series in chart order. Keep the overlay inside the plot, after the chart shapes. Pie/Sankey/funnel charts can keep their actual shape regions and use the same card attributes.
