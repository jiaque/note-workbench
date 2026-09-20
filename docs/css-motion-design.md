# HTML/CSS 动效与折叠样式设计

日期：2026-09-20 · 状态：待用户确认的设计，尚未实现。

对应当前 0.5.4 源码；本文不改变已经确认的 Markdown 编辑、表格、浮层和阅读视图要求。本轮只写设计，不修改渲染代码，不打包、安装或发布。

## 1. 目标与兼容原则

继续使用标准 HTML 标签，通过 `data-nw-*` 属性选择插件提供的动效，用内联 `style` 指定外观和动效参数。用户不需要在 Markdown 顶部插入 `<style>`，也不需要写 JavaScript。

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
- CSS 动效不存在可穷举的“所有效果”清单。以下覆盖常用机制和表现，并通过参数扩展；不宣称支持浏览器的每个 CSS 特性或任意用户自定义关键帧。

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
- 不开放任意 `<style>`、`@import`、远程 CSS、CSS URL 资源、事件属性或文档脚本；CSS 动效不新增网络请求。
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

任意用户自定义关键帧/全局样式块、外部 CSS/JavaScript、滚动绑定时间轴、鼠标跟随 3D、粒子系统、Canvas/WebGL、自动业务进度和页面转场不属于上述预设协议。滚动“进入可视区触发”已包含，但不是将滚动位置连续映射到动画时间。后者有独立的 CSS 时间轴机制。[MDN 滚动动画时间轴](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines)

本设计推荐将“广泛支持”落实为完整覆盖上面的效果、参数、折叠和降级矩阵；新增复杂效果以后通过注册表扩展，不破坏文档语法。
