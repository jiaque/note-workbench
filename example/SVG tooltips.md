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
