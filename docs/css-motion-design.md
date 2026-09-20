# HTML/CSS 动效、动态 SVG 与折叠样式设计

日期：2026-09-20 · 状态：方案方向已确认，0.5.5 已实施；下文保留设计协议，实际验证与限制见实现记录。

更新：0.5.5 已实现本设计的动效与隔离 SVG。实际设置为默认启用的布尔项 `noteWorkbench.render.motion.enabled`，并尊重系统减少动态效果偏好；实现差异、验证及限制以[实现记录](motion-implementation.md)为准。下文保留原设计说明。

对应当前 0.5.4 源码；本文不改变已经确认的 Markdown 编辑、表格、浮层和阅读视图要求。本轮只写设计，不修改渲染代码，不打包、安装或发布。

## 1. 目标与兼容原则

继续使用标准 HTML 标签，通过 `data-nw-*` 属性选择插件提供的动效，用内联 `style` 指定外观和动效参数。用户不需要在 Markdown 顶部插入 `<style>`，也不需要写 JavaScript。

用户进一步确认：保留现有 CSS 预设范围，额外的动态图表、装饰和自动播放操作指引交给 SVG。SVG 可以手写在 Markdown 中，展示时经过过滤并转换成独立图片；不把 SVG 内部元素插入正文 DOM。具体要求见第 13 节。核心目标是同时保留源码编辑便利、动态展示效果和隔离边界。

```html
<div data-nw-effect="breathe"
     style="--nw-duration: 2s; --nw-intensity: 0.3;
            background-color: #2563eb; color: white; padding: 16px; border-radius: 8px;">
  原来的 HTML 内容可以保留，只增加动效属性。
</div>
```

以上为拟定语法，当前版本不会产生该动效。

- `div` 仍是原来的 HTML 容器，不引入新的文档块语法，不把普通 `div` 自动改成卡片。
- 未标记动效的 HTML 保持既有行为；原有图片、链接、表格、公式、嵌入、内联样式不能因增加动效失效。
- 原文属性和样式不因查看、播放、暂停或切换模式而改写；渲染时生成的装饰结构不保存进 Markdown。
- 不改变 HTML 内 Markdown 的现有解析边界。动效支持不意味着任意 `<div>` 内的 Markdown 都会自动解析；示例使用明确的 HTML 子元素。
- 其他编辑器是否显示 HTML/内联样式由其自身决定；支持 HTML 时通常仍能看到内容，但没有本插件的样式定义就没有这些动效。用户文档不能依赖动画才能读懂。
- CSS 动效不存在可穷举的“所有效果”清单。正文 CSS 覆盖以下常用机制和表现，不开放任意正文关键帧；第 13 节允许在隔离的 SVG 图片内定义经校验的关键帧，两者范围不同。

## 2. 当前实现核对

| 当前源码 | 已有行为 | 本次需要补充 |
| --- | --- | --- |
| `src/shared/render.ts` | 解析 HTML、保留允许的 style/class、过滤样式；支持 details/summary/open | 注册动效属性，校验参数，扩展 CSS 值解析 |
| `filterStyles` | 固定属性集合及受限值检查 | 目前不支持 `--nw-*`、动画、transform、阴影和渐变函数；不能仅增加一个 class 就认为功能完成 |
| `transformCallouts` | `[!type]+/-` 转为带类型色和图标的 details | 与普通 HTML details 共用折叠样式和行为 |
| `document.css` / `live-preview.css` | 文档样式、Callout 样式和部分模式覆盖 | 把折叠视觉参数集中管理，避免两处覆盖导致间距差异 |
| 编辑 / 浮层 / 阅读 / PDF | 已有共用渲染链路，PDF 独立导出入口 | 共用动效规则；PDF 明确输出可读的静态状态 |

## 3. 使用协议

### 3.1 属性

| 属性 | 值与用途 |
| --- | --- |
| `data-nw-effect` | 一个主体效果名，如 breathe、shine、progress |
| `data-nw-enter` | 一个入场效果名，如 fade、slide-up；默认首次进入可视区播放一次 |
| `data-nw-hover` | 一个交互效果名，如 lift；鼠标悬停或键盘焦点位于块内时生效 |
| `data-nw-trigger` | 主体效果触发方式：auto（默认）、hover、click、visible；不改变 enter/hover 自身的触发方式 |
| `data-nw-repeat` | 主体效果次数：正整数或 infinite；默认值由效果定义 |
| `data-nw-play` | running（默认）或 paused，设置当前块状态 |
| `data-nw-direction` | normal、reverse、alternate、alternate-reverse，控制主体时间轴；不用于替代入场方向名称 |

`auto` 在块可见时运行；离开视口暂停。`visible` 每次重新进入视口触发一次，循环类在此次可见期间按 repeat 播放。`click` 播放或重播，交互由插件提供；不执行文档内事件代码。click 效果仅用于非交互容器的空白区域，提供 Enter/Space 键盘操作；点击链接、表格、summary、媒体控件及其子元素不截获。

每个属性只接受一个名称，未知值按静态内容处理，不隐藏内容、不破坏编辑。新增效果名称保持向后兼容。

### 3.2 内联参数

参数按效果读取；没有对应意义的参数不生效。校验失败时只回退该参数，原文保留。嵌套的动效根重置为默认值，避免 CSS 变量隐式继承使子块一起改变。

| 参数 | 默认与范围 | 含义 |
| --- | --- | --- |
| `--nw-duration` | 循环 2s，入场 400ms，进度 600ms；100ms～60s | 主体或单独入场效果周期 |
| `--nw-delay` | 0s；0～30s | 主体播放延迟 |
| `--nw-easing` | ease-in-out；允许标准 easing、合法 cubic-bezier/steps | 时间曲线 |
| `--nw-intensity` | 0.2；0～1 | 呼吸亮度/装饰透明度的变化幅度；不让正文消失 |
| `--nw-distance` | 6px；0～64px | 浮动、平移、弹跳距离 |
| `--nw-scale` | 1.03；0.8～1.2 | 缩放幅度 |
| `--nw-angle` | 3deg；0～30deg | 摆动/倾斜角度；spin 固定一圈不使用该参数 |
| `--nw-color` | 当前主题强调色 | 动效主色，不自动覆盖正文颜色 |
| `--nw-color-end` | 与主色相邻的主题色 | 渐变终点色 |
| `--nw-glow-size` | 12px；0～32px | 光晕范围 |
| `--nw-progress` | 0%；0～100% | 有限进度；不从文案猜测值 |
| `--nw-track-color` | 主题浅底色 | 进度轨道色 |
| `--nw-track-size` | 8px；2～24px | 条形高度或环形线宽 |
| `--nw-ring-size` | 64px；24～200px | 环形进度尺寸 |
| `--nw-enter-duration` | 400ms；100ms～3s | 与主体效果组合时，单独设置入场时长 |
| `--nw-hover-duration` | 180ms；100ms～1s | 悬停/焦点过渡时长 |
| `--nw-fold-duration` | 180ms；100ms～500ms | 折叠展开时长 |

这些是本插件公开参数，不是 CSS 标准属性。普通 CSS 的 color、padding、border-radius 等继续控制静态外观。初版不开放任意名称的自定义变量，后续增加参数时扩展注册表。

## 4. 动效目录：本次拟支持范围

下表全部纳入本次设计的开发范围；实现可以分批验证，但不能把未完成效果写成已支持。复杂效果必须有静态降级。新预设不强迫普通文档启用任何动画。

### 4.1 持续装饰与强调（data-nw-effect）

| 名称 | 效果 | 默认周期/次数 | 参数与限制 |
| --- | --- | --- | --- |
| breathe | 呼吸光晕 | 2s / infinite | intensity、color、glow-size；默认不缩放正文 |
| pulse | 轻微缩放脉冲 | 2s / infinite | scale；占位大小不变 |
| glow | 光晕明暗渐变 | 2s / infinite | color、glow-size |
| shine | 斜向流光扫过背景 | 2.4s / infinite | color、intensity；装饰层不盖住文字 |
| gradient-flow | 多色背景缓慢流动 | 6s / infinite | color/color-end；原背景保留为底层 |
| border-flow | 边框流光 | 3s / infinite | color/color-end；不改变边框占位 |
| ripple | 外缘扩散波纹 | 2s / infinite | color、distance；默认只用于非正文容器 |
| float | 上下轻浮 | 3s / infinite | distance；保留布局位置 |
| spin | 匀速旋转 | 2s / infinite | direction；适合小型标记，需显式启用 |
| swing | 左右小角度摆动 | 2s / infinite | angle |
| bounce | 轻弹跳 | 800ms / 1 | distance |
| shake | 水平抖动提示 | 400ms / 1 | distance 默认 3px；不自动反复抖动 |
| highlight | 背景强调后恢复 | 1.2s / 1 | color、intensity |

### 4.2 入场（data-nw-enter）

fade（淡入）、slide-up / slide-down / slide-left / slide-right（四向轻移）、zoom（轻缩放）、reveal（遮罩揭示）、blur-in（模糊转清晰）。共 8 种；默认进入视口一次，不因每次渲染回执重复播放。

所有效果结束后完整显示内容。加载失败、减少动态效果、关闭动效和 PDF 中直接显示最终状态。模糊仅存在于短暂入场，正文静态态不模糊。

### 4.3 悬停与键盘焦点（data-nw-hover）

| 名称 | 效果 |
| --- | --- |
| lift | 上浮并增加轻阴影 |
| zoom | 轻放大 |
| glow | 边缘高亮 |
| tint | 背景色平滑变化 |
| underline | 链接/短文本下划线展开 |
| tilt | 固定小角度倾斜；不是跟随鼠标位置的 3D 效果 |

键盘 focus-within 使用相同视觉反馈；移出后恢复。不会为了悬停效果给普通正文增加 Tab 停靠点。点击时原有链接/折叠/编辑操作优先。

### 4.4 进度与等待（data-nw-effect）

| 名称 | 表现与语义 |
| --- | --- |
| progress | 从 0 平滑填充至指定百分比，结束保持目标值 |
| progress-striped | 保持指定进度并显示移动条纹；减少动态效果时条纹静止 |
| progress-ring | 环形进度；文字保留，0%/100% 均准确 |
| loading-bar | 不确定进度往复条；不显示虚假的百分比 |
| loading-dots | 三点等待提示，原文保留为说明 |
| spinner | 装饰环旋转；与旋转整个内容的 spin 区分 |
| skeleton | 背景骨架流光，不擦除或遮住已有文字 |

共 34 个命名效果（13 + 8 + 6 + 7），另含统一折叠过渡。进度值来自文档参数，修改参数可以平滑更新；本次不自动读取任务清单、接口、计时器或业务数据。确定进度提供 progressbar 语义和 0～100 的可访问值；等待动画不生成密集的屏幕阅读器播报。

## 5. 效果组合与已有 CSS 的关系

支持主体、入场、悬停各一种，例如：

```html
<div data-nw-effect="breathe" data-nw-enter="fade" data-nw-hover="lift"
     style="--nw-duration: 3s; --nw-color: #38bdf8;
            padding: 16px; background-color: #132033; color: #edf6ff;">
  <strong>阶段进展</strong><p>内容、链接和原有 HTML 样式照常保留。</p>
</div>
```

CSS 的不同动画可能同时修改 transform 等属性，需要明确合成；不能简单叠加多个 animation 声明就假定互不影响。[MDN 动画合成说明](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-composition)

设计规则：

1. 入场先完成，再启动会移动/缩放内容的主体效果；入场时悬停仍可改变颜色或阴影。
2. 呼吸、流光、光晕优先使用插件生成的装饰层；装饰层不接收指针事件，不修改文档文本。
3. 悬停和主体都需要位移/缩放时，进入悬停先冻结主体到静态态，离开后恢复，避免两个时间轴争抢属性。
4. 文档自身设置 transform、opacity、background 等静态值时，优先保留基线，在独立层实现装饰；无法隔离时停用冲突效果并提供诊断，不偷偷覆盖原样式。
5. 在 div、section、article、aside、figure 等容器和 span 短文本上启用。span 需要变换时生成仅用于显示的内部承载层，并验证换行不退化。
6. 不直接改造 table/tr/td/th、SVG、公式或代码编辑器的 DOM 结构。可给它们的外层容器添加非侵入装饰；表格正在编辑或拖动时，所属容器的位置动效暂停。
7. 内联样式通常优先于普通样式表声明，但不是“绝对最高优先级”；CSS 动画和过渡有自己的级联规则。公开接口优先用上述参数，初版不允许任意 animation-name 或 !important 抢占内置规则。

不提供多主体效果字符串和任意组合数量，以保证嵌套内容、表格测量与编辑命中可控。可以显式嵌套普通容器，但参数不自动传给子动效块。

## 6. 折叠块统一

保留现有 Markdown Callout 语法和原生 HTML，不发明第二套展开/折叠标记：

```markdown
> [!note]+ 默认展开
> 内容

> [!quote]- 默认折叠
> 内容
```

```html
<details open style="--nw-fold-duration: 180ms;">
  <summary>默认展开</summary>
  <p>HTML 正文。</p>
</details>
```

| 项目 | 统一行为 |
| --- | --- |
| 外观 | 相同的箭头尺寸/位置、圆角、标题行高、内容区 padding 和块间距；从现有紧凑文档样式抽取共用值 |
| 配色 | 普通 details 使用中性色；Callout 保留类型颜色/图标；用户内联颜色与间距仍可覆盖 |
| 折叠态 | 不留下正文 margin 或空白壳；只显示标题行 |
| 展开态 | 正文首尾 margin 收敛，表格宽度与折叠前一致 |
| 过渡 | 箭头转动及内容淡入/高度过渡；180ms；不支持平滑高度的宿主退化为即时展开，不丢内容 |
| 操作 | 点击 summary 或键盘 Enter/Space 切换，不进入源码编辑；点击正文仍按原实时预览编辑规则 |
| 初始状态 | Callout 的 + / -、details 的 open 决定；无标记的普通 Callout 仍不可折叠 |
| 状态保留 | 当前笔记面板内切换实时预览/阅读、收到内容回执时保持开合；重新打开从源码初始值开始 |
| 源码修改 | 临时开合不写盘；直接改 + / - 或 open 时按新源码重置 |
| 嵌套/嵌入 | 状态按来源、嵌入实例和块身份隔离；改动一个实例不影响另一个 |
| 浮层 | 与原块使用相同样式和初始状态；浮层内临时切换不改正文开合状态 |
| PDF | 全部展开并停止过渡，沿用现有导出行为 |

原生 details 提供 open、summary 和 toggle 行为；平滑展开需要额外处理，不能把浏览器原生展开等同于自带动画。[MDN details](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details)

`interpolate-size` 等高度插值能力须在实际 VS Code Webview 中检测；支持时增强，不作为内容可展开的前提。[MDN interpolate-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size)

## 7. CSS 支持边界与渲染实现

### 7.1 样式解析

保留现有静态样式，增加受控的 transform/translate/rotate/scale、transform-origin、box-shadow、text-shadow、filter、background-size/position、渐变、过渡属性，以及本设计的 `--nw-*` 参数。用声明解析器和值校验替代简单的分号拆分及字符正则；不能仅凭函数名字匹配就放行整段值。

- 允许经校验的数值/单位、颜色、linear/radial/conic-gradient、受限 transform、blur/brightness 等局部滤镜。
- `var()` 仅引用公开动效参数及明确允许的主题变量，并校验 fallback；不允许任意变量间接绕过值检查。
- transition-property 限于已批准的可插值属性，不支持 all；animation 系列由内置预设管理，用户用参数控制。
- 正文不开放任意 `<style>`、`@import`、远程 CSS、CSS URL 资源、事件属性或文档脚本；CSS 动效不新增网络请求。SVG 内部样式按第 13 节单独校验，在图片隔离中使用，不能作为正文样式注入入口。
- 无效声明只影响对应样式，文档可见、可编辑，原文保留；诊断置于操作菜单，不在正文常驻一排提示。

不同属性有不同插值能力，自定义变量也并非天然平滑插值。插件优先动画实际的 transform/opacity 等属性；环形进度等需要连续数值时由已注册类型的变量或插件控制，不依赖任意变量自动插值。[MDN 可动画属性](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Animations/Animatable_properties)

### 7.2 模块划分

- `shared/effects.ts`：效果注册表、属性/参数校验、静态降级规则；编辑与 PDF 共用。
- `shared/css-styles.ts`：静态 CSS 与参数解析，接入 render.ts；补齐声明解析测试。
- `webview/effects.css`：命名空间 `nw-*` 的关键帧和外观，加载一次，作用于文档区域内的显式动效根。
- `webview/effects.ts`：可见性、暂停、触发、装饰层、释放监听和实例状态；使用插件代码，不运行笔记脚本。
- `webview/disclosure.ts` 与共用折叠 CSS：统一 details/Callout 的开合状态与测量。
- editor/block-preview/export：接入同一机制；导出明确使用 static 模式。

生成内部结构不能破坏 HTML 原有选择器/子元素关系；优先装饰覆盖层，不任意包裹现有子元素。确需包装时保留语义、可访问结构和原尺寸，并按案例验收；不满足则退化为静态。

### 7.3 编辑与测量

正文块进入源码编辑时，原块停止位移、缩放和透明度变化，避免光标命中错位；源码不显示动画，浮层显示对应渲染效果。失焦保存沿用现有规则，不能因动画结束、进入视口或折叠操作产生保存。

动态装饰不改变占位，不逐帧让 CodeMirror 重排。折叠改变高度时进行必要的布局测量，保持光标、滚动锚点和后续块坐标正确；不要引入之前修复过的块选中失效问题。

## 8. 实时预览、阅读、浮层和导出

- 实时预览和阅读共用 DOM 增强规则、参数、字体与布局；同一触发状态、同一动画时间点应得到相同画面。不能以切换模式为由改变表格列宽、行高和正文间距。
- 当前面板切换模式时保存可识别块的播放位置、播放次数和折叠状态；一次性入场不重放。源码实质变化使块身份失效时重新初始化该块。
- 浮层是独立实例，使用相同参数；允许独立时间轴，不承诺其循环相位与正文逐帧同步。输入回执不反复初始化没变的效果。
- PDF 关闭循环、阴影移动和入场隐藏；正文完全可见，确定进度显示真实目标值，等待动画显示静态标记。不能只设置 animation:none 导致初始 opacity:0 的内容消失。
- 现有自动保存、撤销、冲突恢复及 HTML 原文保真不改变。

## 9. 偏好与运行行为

拟增加 `noteWorkbench.render.motion`：system（默认，跟随系统减少动态效果偏好）、on、off。on 仍保留插件的暂停入口；不在每个块旁边添加常驻控制按钮。

system 且系统要求减少动态效果、或用户选择 off 时：去掉循环、旋转、平移、模糊和高度过渡，保留颜色提示、完整正文与正确进度。笔记操作菜单提供“暂停/恢复当前笔记动效”；手动暂停保留当前装饰帧，入场内容立即完成显示。

后台面板与离开视口的动画暂停，隐藏浮层销毁监听；优先 transform/opacity，持续光影限制面积，不给所有元素永久设置 will-change。大量动效需单独测量，不借此扩大到已经暂缓的大文件专项。

减少动态效果偏好可通过 prefers-reduced-motion 检测；本设计的默认策略采用该机制。[MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)

## 10. 示例

### 流光提示

```html
<div data-nw-effect="shine" data-nw-hover="glow"
     style="--nw-duration: 2.5s; --nw-color: #67e8f9;
            background-color: #172554; color: white; padding: 16px; border-radius: 8px;">
  <strong>上线进展</strong><p>保留原 HTML 内容和内联样式。</p>
</div>
```

### 有确定数值的进度

```html
<div data-nw-effect="progress-striped"
     style="--nw-progress: 65%; --nw-color: #22c55e; --nw-track-size: 8px;">
  已完成 65%
</div>
```

插件生成文字下方的进度装饰；原文始终保留。若文字写 65% 而参数写 40%，条形以参数为准，不擅自改正文。

### 折叠内容内含进度

```html
<details open>
  <summary>项目进度</summary>
  <div data-nw-effect="progress" style="--nw-progress: 65%; --nw-color: #22c55e;">
    已完成 65%
  </div>
</details>
```

关闭折叠块时暂停内部效果；重新打开不重复执行已完成的 progress 入场填充，数值修改后从旧值过渡至新值。

## 11. 验收清单

1. 旧文档无动效属性时，原 HTML、表格、内联 CSS、链接、公式与 Markdown 的渲染及源码保持一致。
2. 34 个预设逐一有最小样例、参数变化、暂停、静态输出和失败降级测试；默认及边界参数均覆盖。
3. 组合、嵌套和已有 transform/background 样例不互相覆盖；子动效参数不被父块隐式污染。
4. 用户现有报告的 5 张表格在实时预览和阅读中保持相同尺寸；启用外围动效后点击定位、上下方向键、表格编辑/拖动仍正确。
5. 流光、渐变、阴影及 CSS 变量通过过滤器后有效；不支持的声明不吞掉同一 style 中其他合法声明。
6. Markdown + / - 和 HTML details 的展开、折叠、嵌套、主题、键盘操作及样式覆盖一致；切换模式不重置开合，不产生未修改文件标记。
7. 编辑回执、跨块编辑、外部修改、撤销、重新打开后，动画和折叠状态按本设计恢复，不能改写原文。
8. 进度的 0%、65%、100%、越界/无效值均有确定行为；PDF 与可访问数值一致，未知进度不伪造百分比。
9. 系统减少动态效果、全局关闭、当前笔记暂停、失焦和离屏各自生效；无内容永久隐藏、快速闪烁或反复播报。
10. 测试最低支持 VS Code 的 Webview 与当前版本；新 CSS 能力不足时静态降级。截图在固定动画时间点对比，不能把不同相位误判成样式差异。

## 12. 明确不在本次范围

正文中的任意用户自定义关键帧/全局样式块、外部 CSS/JavaScript、滚动绑定时间轴、鼠标跟随 3D、粒子系统、Canvas/WebGL、自动业务进度和页面转场不属于上述预设协议。隔离 SVG 内自带的 CSS 关键帧及声明式动画属于第 13 节新增范围。滚动“进入可视区触发”已包含，但不是将滚动位置连续映射到动画时间。后者有独立的 CSS 时间轴机制。[MDN 滚动动画时间轴](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines)

本设计推荐将“广泛支持”落实为完整覆盖上面的效果、参数、折叠和降级矩阵；新增复杂效果以后通过注册表扩展，不破坏文档语法。

## 13. 动态 SVG：源码可编辑，展示采用图片隔离

### 13.1 用户确认的用途与取舍

提供类似插入动态图的能力：流光进度条、动态图表、图内文字逐步出现、模拟光标移动、点击高亮、菜单展开和输入过程等自动播放的应用操作指引。画面中的按钮、菜单和光标是绘制出来的演示，不真实操作应用。

保留 SVG 标准表达能力，允许作者编写自己的图形、CSS 关键帧与声明式动画，不要求全部映射到插件预设。仅承诺通过本节校验且被宿主图片渲染器支持的内容，不承诺任意 SVG 文件完整播放。

| 需求 | 决定 |
| --- | --- |
| 编辑便利 | 可直接在 Markdown 中手写 `<svg>…</svg>`，不要求另存文件 |
| 预览便利 | 点击 SVG 块进入源码编辑，浮层实时展示过滤后的结果；离开按现有同步/保存规则处理 |
| 源码保真 | Markdown 保留原始 SVG；不保存为 base64 文本，不替换成文件路径，不把过滤结果覆盖原文 |
| 展示效果 | 实时预览、浮层、阅读均按独立图片显示；支持经过校验的自动播放动画与循环 |
| 图内交互 | 不支持图内悬停、按钮点击、拖动节点、点击推进步骤或脚本响应 |
| 整图交互 | 插件可提供整图源码编辑、放大、重新播放等入口，与图内交互区分；不增加常驻工具栏 |
| 安全边界 | 不执行文档脚本，不加载 SVG 自带的外部资源，不连接插件消息接口 |

本节不再扩大正文 CSS 预设数量；Windows 风格流光、自动打字等更自由的视觉演示可以由 SVG 内容实现。

### 13.2 当前行为与目标行为

当前 0.5.4：Markdown 内联 SVG 被静态白名单过滤后直接进入正文 DOM；`![](文件.svg)` 按图片显示。当前内联 SVG 不支持 style、关键帧和动画标签。

目标：笔记作者提供的内联 SVG 走独立 SVG 渲染链路。流程为：

```text
Markdown 内的原始 SVG（保留源码范围）
  → 不执行代码的 SVG/XML 解析
  → 图形、CSS、动画属性与内部引用校验
  → 序列化为独立 SVG 图片数据
  → <img> 显示
```

图片元素属于正文 DOM，但 SVG 内部的节点、style 和关键帧不属于正文 DOM。禁止把作者 SVG 经 innerHTML 注入页面，不使用 object/embed/iframe 或顶层 SVG 文档作为备用显示方式。

编辑器显示的是原始 SVG 源码，浮层使用上述图片链路。语法暂时不完整时保留草稿并显示简短预览错误，不能因为解析失败丢掉源码或偷偷退回不隔离的方式。

建议使用内部生成的 SVG data URL；若实现改用 Blob URL，须仅开放必需的图片 CSP 能力并回收 URL。它们都是临时渲染产物，不写入文档。

这条规则针对笔记作者提供的 SVG。MathJax、Mermaid 和插件图标有自己的生成链路，不把它们的运行时生成节点误识别为用户内联 SVG，再次转换后破坏其已有功能。

### 13.3 SVG 支持范围

| 内容 | 设计范围 |
| --- | --- |
| 图形和文字 | svg/g/path/rect/circle/ellipse/line/polyline/polygon/text/tspan 等，保留 viewBox、尺寸、变换与可访问说明 |
| 图形定义 | defs、渐变、裁剪、遮罩、符号和同图引用；只允许当前图片内可解析的 ID 引用 |
| 内部 CSS | style、选择器、@keyframes、经校验的动画/过渡及图形外观属性；与正文 CSS 白名单分别管理 |
| 声明式动画 | animate、animateTransform、animateMotion、set 及必要的内部路径引用；只允许修改批准的数值、颜色、几何及显示属性 |
| 时间编排 | 合法的时长、延迟、重复和同图动画时间关系；不开放点击等事件触发式动画 |
| 滤镜 | 按批准集合和面积/复杂度限制支持；不开放外部图像滤镜输入 |
| 脚本及嵌套内容 | 不允许 script、事件处理属性、foreignObject、嵌套网页或可执行文档 |
| 资源及跳转 | 不允许外部 CSS/字体/图片、任意 URL、脚本协议及跳转；图片内的链接不作为可交互导航 |

允许的 `url(#id)` 仅指向同一 SVG 内已批准对象。`href` / `xlink:href` 按元素用途校验，只允许必要的本图引用；不能一律放行。动画不得通过 attributeName、values、from/to 或 set 在播放后重新写入链接、事件或其他禁止属性。

CSS 必须按语法解析，检查转义、嵌套规则、变量与 URL，不能仅删除出现 script 的文本。SVG 解析禁用 DTD/外部实体；嵌套的 data 资源也不能作为绕过过滤的通道。本版不支持 SVG 内嵌位图，避免递归加载复杂度。

### 13.4 安全保证的准确表述

采用“内容过滤 + 浏览器图片上下文 + Webview CSP”多层约束。严格的图片上下文不执行 SVG 内脚本；过滤仍删除脚本和事件属性，避免未来渲染路径变化导致意外执行。图片本身也不能调用 acquireVsCodeApi 或发送宿主操作消息。

这不是“任何 SVG 都绝对安全”的承诺。超多节点、巨大尺寸、复杂路径、重型滤镜和大量循环动画仍可能导致卡顿或资源消耗；需要对输入字节数、节点/路径复杂度、画布尺寸、滤镜范围、动画数量设置限额。具体默认值由样本测量确定，并在实现验收记录中固定，超限显示可理解的错误和源码入口，不丢原文。

浏览器图片上下文的限制见 [MDN SVG as an image](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)。SVG 原生支持脚本的背景见 [MDN SVG script](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/script)。因此不能把“图片隔离”替换为“任意 SVG 都可以直接打开”。

放大也保持图片模式，不自动打开一个可执行的 SVG 网页。打开源码使用 VS Code 文本编辑器，不通过系统浏览器运行原始 SVG。

### 13.5 文件引用与模式一致性

- 支持工作区内 `![](图表.svg)`；本地 SVG 也进入同一过滤及图片隔离链路，遵守现有工作区资源边界。
- 远程 SVG 不作为本次动态 SVG 功能入口；既有远程图片路径继续受远程图片设置控制，并保持 img 上下文，不声称已对未读取的远程文件做内容过滤，也不因本功能主动下载远程资源。
- 同一源码、尺寸和动画时刻，实时预览、浮层、阅读得到同样的图形。浮层可以有独立时间轴，切换视图允许重新开始 SVG 图片动画；不能以此改变占位尺寸或表格布局。这是对第 8 节 CSS 实例时间轴恢复要求的明确区分。
- 不依赖正文 CSS 为 SVG 提供字体或颜色，图片内部样式需要自包含。纯静态旧 SVG 若原来继承正文颜色，转换时补入确定的展示基线，主题切换后更新图片，不改原文。
- 编辑回执中 SVG 内容未变时复用图片，避免每次同步都重新播放。内容变化后重新生成图片，旧资源及时释放。

### 13.6 自动播放、减少动态效果和 PDF

默认按 SVG 自己的时序播放；支持自动操作演示和作者定义的循环，但不把图内行为解释为应用操作。

图片中的 SVG 时间轴不能由父页面按内联 SVG 的方式直接操控。因此不承诺“仅设置外层 animation-play-state 就能暂停 SVG”，也不把精确暂停当前帧、任意拖动时间轴作为本次必需功能。

需要实现整图“重新播放”以及“停止动画/显示静态图”：前者重新创建图片实例；后者使用明确的静态表示。系统减少动态效果、全局关闭动画和 PDF 同样走静态表示。静态生成必须同时处理 CSS 和 SVG 声明式动画，不能仅移除 CSS animation。

默认静态表示取过滤后的图形基础态，作者应让基础态能说明内容；无法得到可读图形时显示 title/desc 或明确说明，不能导出空白。任意时间点截图、自动识别最佳结束帧不在本次范围；不能声称对所有自定义操作演示都能自动选到合适的最终画面。开发时应以“基础态可读”的示例指导作者。

### 13.7 手写示例

以下代码应能直接保存在 Markdown，点击后仍可编辑原文。图片在基础态展示圆点和文字，播放时圆点往返移动：

```html
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80">
  <title>流程执行中</title>
  <desc>蓝色圆点沿水平方向往返移动。</desc>
  <rect x="20" y="30" width="200" height="8" rx="4" fill="#e2e8f0"/>
  <circle cx="24" cy="34" r="10" fill="#2563eb">
    <animate attributeName="cx" values="24;216;24" dur="3s" repeatCount="indefinite"/>
  </circle>
  <text x="20" y="66" font-size="14" fill="#334155">流程执行中</text>
</svg>
```

SVG 内自带 style/@keyframes 也属于支持目标；完整用例需同时覆盖 CSS 动画与上述声明式动画，不把某一种通过当作另一种也通过。

### 13.8 新增验收清单

1. 手写 SVG、修改源码、浮层预览、离开同步、自动保存和撤销均保留原文；不自动产生附件或 base64 文档内容。
2. 实际正文和浮层 DOM 中只有作者 SVG 的图片载体，没有其内部 style、脚本或图形节点；不影响插件生成的公式/图表。
3. CSS 关键帧、属性动画、变换动画、路径动画、延迟、循环和操作指引代表样本实际播放；宽高与 viewBox 一致。
4. 图内 hover/click/拖动不工作；整图编辑、放大和重播由插件提供，不能触发作者脚本或外部跳转。
5. 包含脚本、事件、foreignObject、远程资源、CSS URL/转义绕过、动画修改链接及外部实体的样本不能执行代码、访问外部资源或触达宿主消息接口。通过浏览器网络与执行探针验证，不只检查字符串。
6. 同名 ID/关键帧的多张 SVG 不互相影响，也不改变 Markdown 正文及编辑器样式。
7. 畸形与超限内容有可恢复提示；快速连续修改不积累图片资源或使旧预览覆盖新预览。
8. 系统减少动态效果、停止动画、PDF 静态表示覆盖 CSS 与 SVG 两类动画；基础态内容可读，失败时明确说明。
9. 旧静态 SVG、本地 SVG 引用、主题切换、嵌入笔记中的 SVG，以及最低支持的 VS Code Webview 做回归验证。

本节是新增需求与实现约束，不表示当前安装的 0.5.4 已提供动态 SVG 支持。
