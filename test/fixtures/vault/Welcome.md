---
title: Note Workbench
tags: [notes, development]
---

# A quieter space for your notes

把文字、表格和想法放在一起。这个开发预览使用原生 `.md` 文件，**不需要额外服务**。

## 今天的工作

- [x] 创建独立扩展项目
- [ ] 验证完整笔记工作流

> 点击每段右侧的“编辑”修改源码片段；双击表格单元格编辑，拖动手柄调整顺序。

| 任务 | 状态 | 负责人 |
| :--- | :---: | ---: |
| 编辑器基础 | 开发中 | 小林 |
| 表格交互 | 待验收 | 小陈 |
| 图谱与嵌入 | 待开发 | 小周 |

## Markdown + HTML

<details><summary>一个 HTML 折叠块</summary><p>HTML 原文会保留，展示时会过滤可执行内容。</p></details>

<table class="original-table"><thead><tr><th>项目</th><th>数量</th></tr></thead><tbody><tr data-note="keep"><td>笔记</td><td>12</td></tr><tr><td>草稿</td><td>3</td></tr></tbody></table>

## 数学与图形

行内公式 $E=mc^2$，以及独立公式：

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

```mermaid
flowchart LR
  A[打开笔记] --> B[编辑内容]
  B --> C[保存原文件]
```

可以打开另一篇[示例笔记](Second.md)。
