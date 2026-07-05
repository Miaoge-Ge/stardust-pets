# 桌面宠物《星屑伙伴》(Stardust Pets)设计文档

> AI 驱动的桌面宠物:常驻屏幕、组件化随机形态、状态机动作、LLM 对话与记忆、
> 亲密度成长、星星币 + 抽卡 + 图鉴收集闭环。
>
> 版本:v0.1(设计稿) | 日期:2026-07-05

> **实现状态说明(截至 v0.4.1)**:本文档为立项设计稿,三期均已实现并在此基础上迭代扩充。
> 实际发布数值与本文档存在以下有意偏离,以 [README.md](./README.md) 为准:
> - 物种由 8 种扩展为 **20 种**(§2.1);稀有度由 N/R/SR/SSR 四档扩展为 **五档**,新增 **UR**(0.8%,200 抽保底),SSR 概率由 1.5% 上调至 4.2%(§3.1);
> - **渲染管线 v0.4.0 起整体重做**:§2.5 描述的像素 canvas 合成方案(含 v0.3.0 曾加过的 96px 精修层/Scale2x 平滑放大)已完全废弃,改为手绘贝塞尔曲线 **SVG 骨骼动画**(`engine/rig.ts` + `engine/species/*`),PixiJS 依赖已移除;配色也从 §2.3 的预设色板色相区间改为**真随机色相**(色板 id 仅保留作图鉴收集标签);
> - 特效体系从原定的"发光描边/粒子拖尾/星星环绕"等约 6 种扩充为 **22 种粒子 + 23 种光效**(`engine/particles.ts` / `engine/lightEffects.ts`);
> - 动作过渡新增交叉淡出、挤压回弹、速度缓动、转身停顿、重力弧线下落、持续呼吸等打磨(§4),在 SVG 系统下以关键帧插值实现;
> - 商店新增"亲密度道具"(§8/§9 未明确规划,属新增):小鱼干/逗猫棒/生日蛋糕/精美项圈,星星币直接换亲密度;金币获取门槛降低(挂机 60 分钟→20 分钟);
> - 新增"对话工具"(§13 LLM 集成之外的能力):天气(wttr.in)/新闻(Google News RSS)/本地定时提醒,均为关键词本地识别、不依赖 LLM、不经过对话记忆;
> - **v0.4.1 修复**:SVG 翻转(转向)时未设置 transform-origin,导致宠物绕 viewBox 左上角而非自身中心翻转,整只被甩出可视区域裁剪掉(=看起来"凭空消失")——每次转身都会触发,已修复(`engine/rig.ts`);
> - **v0.4.1 重新接回渲染**:耳/尾形状、头饰、颈饰、材质、体型这 6 个收藏维度此前在 SVG 系统里只是存档数据、不影响外观(§2 部件系统的核心承诺——"抽到的部件能在宠物身上看到"——一度失效),现已重新接回实际渲染;鹿角/龙角等物种专属解剖特征不受耳朵抽取结果影响。花纹/眼睛样式/嘴型三维度仍待后续一轮接入。
> 其余章节(记忆/亲密度/货币/抽卡机制/数据库设计等)与实现一致。

---

## 目录

1. [总体架构](#1-总体架构)
2. [形态系统(核心扩充:多样化)](#2-形态系统)
3. [稀有度与生成算法](#3-稀有度与生成算法)
4. [动作系统(状态机)](#4-动作系统)
5. [交互系统](#5-交互系统)
6. [记忆系统](#6-记忆系统)
7. [亲密度系统](#7-亲密度系统)
8. [货币系统(星星币)](#8-货币系统)
9. [抽卡系统](#9-抽卡系统)
10. [图鉴系统(应对组合爆炸的双层设计)](#10-图鉴系统)
11. [数据库设计(SQLite DDL)](#11-数据库设计)
12. [模块划分与目录结构](#12-模块划分与目录结构)
13. [LLM 集成设计](#13-llm-集成设计)
14. [性能与隐私](#14-性能与隐私)
15. [分期交付计划](#15-分期交付计划)
16. [验收标准与测试](#16-验收标准与测试)

---

## 1. 总体架构

### 1.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 外壳 | **Tauri 2.x**(Rust) | 透明/无边框/置顶/点击穿透窗口;内存远低于 Electron,满足 <200MB 约束 |
| 渲染 | **TypeScript + PixiJS 8** | WebGL 精灵批渲染;像素风用 `NEAREST` 采样;失焦降帧省 CPU |
| 数据 | **SQLite**(tauri-plugin-sql)| 本地单文件,事务保证货币/保底一致性 |
| LLM | 任意 OpenAI 兼容 API(设置页配置 URL/Key/模型) | 仅对话、主动搭话、每日记忆压缩时调用 |
| 系统感知 | Rust 侧:`active-win-pos-rs`(窗口标题)+ 全局空闲检测(Win32 `GetLastInputInfo` / macOS `CGEventSourceSecondsSinceLastEventType`) | 不截屏、不上传 |

### 1.2 窗口结构(多窗口)

| 窗口 | 属性 | 内容 |
|---|---|---|
| `pet` | 透明、无边框、置顶、可切换点击穿透、可拖拽 | 宠物本体 + 气泡/牌子 + 星星飘出动画 |
| `panel` | 普通窗口,按需创建 | 抽卡 / 图鉴 / 设置 / 兑换商店(单窗口多路由) |
| `chat` | 小型无边框,吸附在宠物旁 | 对话气泡输入框 |

`pet` 窗口默认**点击穿透开启、仅宠物 Sprite 的包围盒区域接收鼠标**:前端每帧把宠物包围盒同步给 Rust,Rust 用 `set_ignore_cursor_events` + 命中测试实现"只有摸到宠物才拦截鼠标",桌面其余区域完全不受影响。

### 1.3 进程分工

- **Rust 后端**:窗口管理、SQLite、活跃窗口标题轮询(5s 一次)、空闲检测、挂机计时、每日结算定时器、LLM HTTP 代理(Key 不进前端)。
- **前端**:渲染、状态机、部件合成、UI、动画。
- 通信:Tauri command(前端→后端)+ event(后端→前端,如 `idle-paused`、`hourly-coin`、`active-window-changed`)。

---

## 2. 形态系统

> 本节是相对原始需求的**重点扩充**:从 6 个维度扩到 **12 个维度 + 物种基底 + 程序化色板**,
> 组合空间从 ~2.9 万种扩大到 **千万级**,同时用"组合约束规则"保证不出丑图。

### 2.1 部件维度总览

生成一只宠物 = 选 1 个**物种基底** + 在每个维度上按稀有度池随机。

| # | 维度 | 数量(初期) | 说明 | 稀有度参与 |
|---|---|---|---|---|
| 0 | **物种基底 species** | 8 | 猫 / 狗 / 兔 / 狐 / 仓鼠 / 小鸟 / **史莱姆(SR+)** / **幼龙(SSR)** | 决定骨架轮廓与专属动作变体 |
| 1 | 体型 body | 4 | 圆润 / 修长 / 矮胖 / **迷你**(肩高减半,R+) | 影响碰撞盒与动画锚点 |
| 2 | 耳朵 ears | 8 | 立耳 / 垂耳 / 折耳 / 长耳 / 圆耳 / 尖耳 / **无耳(史莱姆专属)** / **龙角(龙专属)** | 部分绑定物种 |
| 3 | 尾巴 tail | 7 | 短尾 / 长直尾 / 卷尾 / 蓬松大尾 / 双尾(SR+)/ 星光尾(SSR)/ 无尾 | 有独立摇摆动画层 |
| 4 | 眼睛 eyes | 8 | 圆眼 / 杏眼 / 眯眯眼 / 星星眼 / **异瞳(SR+)** / 困倦眼 / 猫瞳 / **漩涡眼(史莱姆)** | 眨眼帧独立 |
| 5 | 嘴/表情基线 mouth | 4 | 微笑 / ω 嘴 / 面无表情 / 小虎牙 | 影响表情动画帧 |
| 6 | 花色图案 pattern | 12 | 纯色 / 双色 / 奶牛斑 / 虎斑 / 玳瑁 / 星点 / 渐变(R+)/ 极光纹(SR+)/ 星云纹(SSR)/ 锦鲤纹(SR+)/ 布丁色块 / 袜子爪 | 以遮罩层叠加在主色上 |
| 7 | **配色方案 palette** | 程序化(见 2.3) | 主色 + 副色 + 描边色 + 图案色,由色板系统生成 | 稀有色板(极光/星云/黄昏)锁 SR+ |
| 8 | **材质 material** | 5 | 绒毛(默认)/ 光滑短毛 / **果冻半透明(史莱姆默认,他族 SR+)** / **鳞片微光(SR+)** / **星尘颗粒(SSR)** | 用 shader/滤镜实现,不加帧数 |
| 9 | 头部配饰 headwear | 8 | 无 / 小帽子 / 蝴蝶结 / 花朵 / 眼镜 / 单片镜(R+)/ 小皇冠(SR+)/ 光环(SSR) | |
| 10 | 颈部配饰 neckwear | 6 | 无 / 围巾 / 铃铛 / 领结 / 项链(R+)/ 星星披风(SSR) | |
| 11 | 特效 effect(可叠加) | 6 | 无 / 发光描边(SR+)/ 粒子拖尾(SR+)/ 星星环绕(SSR)/ 脚下小云朵(SSR)/ 呼吸光晕(SR+) | SSR 可持有 2~3 个 |

另有**隐藏维度**(不参与抽取概率,仅增加个体差异):
- **体格微调 scale**:0.92~1.08 随机缩放;
- **叫声音色 voice**:5 种提示音色之一;
- **性格 personality**:傲娇 / 粘人 / 高冷 / 元气 / 慢热 / 中二 / 懒洋洋 / 社恐(8 种,均等随机,影响对话与待机动作权重,详见 §6/§13)。

### 2.2 数据驱动:parts.json 结构

所有部件、约束、稀有度池全部由 JSON 配置,新增部件零代码:

```jsonc
// assets/config/parts.json(节选)
{
  "schemaVersion": 1,
  "dimensions": ["species","body","ears","tail","eyes","mouth","pattern",
                  "palette","material","headwear","neckwear","effect"],
  "parts": [
    {
      "id": "ears_dragon_horn",
      "dimension": "ears",
      "name": "龙角",
      "minRarity": "SSR",
      "requires": { "species": ["species_dragon"] },   // 绑定物种
      "sprite": "parts/ears/dragon_horn.png",
      "anchor": { "x": 0.5, "y": 1.0 },
      "zOffset": 3
    },
    {
      "id": "pattern_nebula",
      "dimension": "pattern",
      "name": "星云纹",
      "minRarity": "SSR",
      "excludes": { "material": ["mat_jelly"] },       // 排斥:果冻材质不叠星云
      "maskSprite": "parts/pattern/nebula_mask.png"
    }
  ],
  "palettes": { "...": "见 2.3" },
  "seriesTags": {                                       // 图鉴"系列成就"用
    "series_bakery": ["pattern_pudding", "headwear_beret", "palette_cream"],
    "series_night":  ["pattern_nebula", "effect_star_orbit", "palette_nebula"]
  }
}
```

**约束规则**只有两种,足够表达且易校验:
- `requires`:该部件仅当另一维度命中指定值时可入池(如龙角只配龙);
- `excludes`:互斥(如"无耳"排斥所有头部配饰中的"猫耳帽"类)。

生成器实现为**约束过滤 → 池内均匀随机**,若某维度过滤后池为空则回退到该维度的 N 池兜底(单元测试覆盖"任意物种在任意稀有度下每个维度池非空")。

### 2.3 程序化配色(多样性的主要来源)

不枚举 8 种固定花色,而是**色板模板 + HSV 抖动**:

```jsonc
"palettes": {
  "templates": [
    { "id": "palette_warm",   "rarity": "N",   "baseHueRange": [15, 45],  "scheme": "analogous" },
    { "id": "palette_cool",   "rarity": "N",   "baseHueRange": [180, 240],"scheme": "analogous" },
    { "id": "palette_candy",  "rarity": "R",   "baseHueRange": [290, 340],"scheme": "complementary" },
    { "id": "palette_aurora", "rarity": "SR",  "fixedStops": ["#7ef0c3","#6ab7ff","#c58cff"], "animated": false },
    { "id": "palette_nebula", "rarity": "SSR", "fixedStops": ["#2b1055","#7597de","#ff9ff3"], "animated": true }
  ],
  "jitter": { "h": 8, "s": 10, "l": 6 }   // 同模板每次生成 ±抖动,保证个体唯一
}
```

- 渲染时用**灰度基底图 + 调色 LUT**(PixiJS ColorMatrix / 小型 shader)上色,美术只画一套灰度部件;
- `animated: true` 的 SSR 色板做缓慢 hue 漂移(呼吸感);
- 最终色值存进宠物存档(`parts_json.palette.resolved`),保证图鉴复现一致。

### 2.4 组合空间估算

`8 物种 × 4 体型 × ~6 耳 × ~6 尾 × ~7 眼 × 4 嘴 × ~10 图案 × 色板(模板 5 + 连续抖动) × 5 材质 × 8 头饰 × 6 颈饰 × 特效组合`
≈ 离散组合 **>4000 万**,叠加色板抖动后每只几乎必然唯一。
→ 因此图鉴**不能**按"枚举全部组合"设计,见 §10 的双层图鉴方案。

### 2.5 渲染合成方案

- 每个部件是独立 Sprite 图层,按 `zOffset` 排序挂在骨架锚点上(锚点由物种基底定义:`head`、`neck`、`tailRoot`、`body`);
- **动作与形态解耦**:动画只驱动骨架锚点的位移/旋转/缩放曲线(JSON 定义),所有部件跟随锚点,故 15+ 动作自动适配全部组合;
- 帧动画:基底身体为 4~8 帧序列帧,部件为单帧 + 程序动画(尾巴正弦摇摆、耳朵抖动),把美术工作量压到最低;
- 占位美术:第一期用**程序化像素生成器**(矩形/圆形拼合 + 1px 深色描边 + 抖动色)出全套灰度部件,接口与正式 Sprite Sheet 一致,后期直接替换 PNG。

---

## 3. 稀有度与生成算法

### 3.1 概率与保底(与需求一致)

| 稀有度 | 概率 | 特征 | 图鉴边框 |
|---|---|---|---|
| N | 65% | 基础池 | 灰 |
| R | 25% | 稀有花色/配饰,解锁迷你体型、双色渐变 | 蓝 |
| SR | 8.5% | 特殊配色(极光等)+ 1 个特效 + 史莱姆物种入池 | 紫 |
| SSR | 1.5% | 专属物种(幼龙)/ 专属造型 + 2~3 特效 + 动态色板 | 金 + 出货特殊动画 |

- **SR 保底**:50 抽未出 SR **或以上** → 第 50 抽必得 ≥SR;计数在出 SR 或 SSR 时重置。
- **SSR 保底**:100 抽未出 SSR → 第 100 抽必得 SSR;仅出 SSR 时重置(出 SR 不重置 SSR 计数)。
- 两个计数独立持久化在 `gacha_state` 表,**先判保底、后掷概率**,同一抽两保底同时触发时取高者(SSR)。
- 十连:逐抽结算(保底计数连续推进),第 10 抽时若前 9 抽全 N 则强制 ≥R。

### 3.2 生成流水线

```
rollRarity(pityState)                      // 保底优先 → 概率表
  → pickSpecies(rarity)                    // SSR 有 30% 概率命中专属物种
  → for dim in dimensions:
       pool = parts[dim] 满足 (minRarity ≤ rarity) ∧ requires ∧ excludes
       // 高稀有度加权:SR/SSR 抽取时,恰好 minRarity == rarity 的部件权重 ×3,
       // 保证 SSR 看起来"像 SSR",而不是一身 N 部件 + 一个特效
       pick weighted-random from pool
  → resolvePalette(template, jitter, seed)
  → assignEffects(rarity)                  // SR 恰 1 个;SSR 2~3 个
  → personality = uniform(8)
  → petId = ulid();写库(与扣币、保底更新同一事务)
```

- 全程使用**带种子的 PRNG**(seed 存档),同一 seed 可复现整只宠物 → 图鉴立绘按需重建,不必存图片;
- 概率与保底逻辑放在**纯函数模块**(无 IO),供单元测试与 10000 次蒙特卡洛验收测试直接调用。

---

## 4. 动作系统

### 4.1 动作清单(19 种,超出 15+ 要求)

| 类别 | 动作 | 触发 |
|---|---|---|
| 待机池(权重随机) | 坐、趴、睡觉、发呆、打哈欠、舔毛整理、追自己尾巴、伸懒腰 | 待机计时器,权重受性格调制(懒洋洋:睡觉×2;元气:追尾巴×2) |
| 移动 | 走、跑、**爬到当前活动窗口顶边坐着**、被拖拽挣扎 | 随机漫步 / 定时 / 拖拽事件 |
| 交互反应 | 被点击开心跳、被摸头眯眼、举牌子说话、被冷落生气背对、吃东西、玩线团、朝鼠标方向好奇张望 | 对应输入/定时事件 |
| 解锁类 | 撒娇蹭手(Lv3)、专属待机(Lv10) | 亲密度 |

"窗口顶边坐着":Rust 每 5s 上报活动窗口的标题 + 矩形,宠物以 30% 概率(冷却 10 分钟)走到该窗口上边缘坐下;窗口移动/关闭则跳下并回到待机。

### 4.2 有限状态机

```
                    ┌───────────── 全局中断(任意状态可进入) ─────────────┐
                    │  DRAG(拖拽挣扎)   CLICKED(开心跳)   PETTED(眯眼) │
                    └──────────────────────┬───────────────────────────────┘
                                           │ 结束后回 IDLE
   IDLE ──权重随机──▶ {SIT, LIE, SLEEP, DAZE, YAWN, GROOM, TAIL_CHASE, STRETCH}
    │  ▲
    │  └── 完成/被打断(带过渡)
    ├─ 随机漫步 ──▶ WALK / RUN ──▶ IDLE
    ├─ 定时+概率 ─▶ CLIMB_WINDOW ─▶ SIT_ON_WINDOW ─▶ JUMP_DOWN ─▶ IDLE
    ├─ 事件:喂食 ─▶ EAT;玩具 ─▶ PLAY_YARN;冷落>2h ─▶ SULK(背对)
    ├─ 事件:健康提醒/主动搭话 ─▶ HOLD_SIGN(举牌)
    └─ 鼠标靠近且速度快 ─▶ CURIOUS_LOOK(朝向鼠标)
```

**过渡规则**(避免撕裂/卡死):
- 每个状态声明 `interruptible`(睡觉=true 但要经 `WAKE_STARTLED` 惊醒过渡)与 `minDuration`;
- 状态切换必须走 transition 表,不存在的转移一律 `→ IDLE` 兜底;
- 看门狗:任一状态超过 `maxDuration ×2` 未退出,强制回 IDLE 并上报日志(防卡死验收项)。

动作全部数据驱动(`animations.json`:帧序列、锚点曲线、时长、可打断性、权重),状态机代码只认 id。

---

## 5. 交互系统

| 输入 | 行为 |
|---|---|
| 左键单击 | 摸头:`PETTED` 动画 + 亲密度 +2(每日前 10 次) |
| 左键长按 250ms + 移动 | 拖拽宠物(挣扎动画,落地有小弹跳);位置持久化 |
| 双击 | 打开对话气泡输入框(§13) |
| 右键 | 菜单:喂食 / 抽卡 / 图鉴 / 切换宠物 / 商店 / 设置 / 退出 |
| 鼠标快速掠过 | `CURIOUS_LOOK` 张望 |

**窗口上下文感知**(可在设置关闭,首启弹隐私说明):
- 连续活跃使用 ≥60 分钟(空闲重置)→ 举牌:"喝口水休息一下吧!" → 用户点击牌子 = 完成健康任务(+5 亲密度、+20 星星币,每日 3 次上限);
- 23:00 后仍在使用 → 困倦动作 + 低频举牌"该睡了…";
- Lv5+ 主动搭话:窗口标题变化触发关键词规则(本地词表:论文/代码/游戏名…),以 30 分钟冷却调用 LLM 生成一句搭话(§13.3)。

---

## 6. 记忆系统

- **归属**:记忆属于主人,所有宠物共享;**性格与说话风格**属于每只宠物(生成时随机,见 §2.1 隐藏维度)。
- **短期记忆**:内存中的当前会话上下文(最近 10 轮)+ 今日互动流水(`daily_log` 表:摸头次数、喂食、聊天摘要、健康任务、使用时段)。
- **长期记忆**:`owner_memory` 表,字段含 `importance(1~5)`、`last_referenced_at`。
- **每日压缩**(当日首次启动时补跑昨日):把昨日 `daily_log` + 会话记录交给 LLM,产出 ≤3 条摘要(带重要度),写入长期记忆;超过 200 条时按 `importance × 时间衰减` 淘汰。
- **检索**:对话时用关键词 + 最近性 + 重要度打分取 Top5 注入 prompt(本地打分,不用向量库,零成本;接口留出以便日后换 embedding)。

---

## 7. 亲密度系统

每只宠物独立:10 级 × 每级 0~100 点。

| 来源 | 点数 | 每日上限 |
|---|---|---|
| 摸头 | +2 | 前 10 次 |
| 喂食 | +5 | 3 次 |
| 聊天 | +3 | 5 次 |
| 每日启动 | +5 | 1 次 |
| 健康任务 | +5 | 3 次 |

- **衰减**:连续 3 天未互动起,每日 -10;只扣点不降级(最低到本级 0 点)。启动时按离线天数补算。
- **解锁**:Lv3 撒娇动作 / Lv5 主动搭话 / Lv7 专属称呼(LLM 起昵称,存长期记忆,此后 prompt 固定注入)/ Lv10 隐藏特效外观。
- **语气注入**:亲密度等级映射为 prompt 中的关系描述(Lv1-2 "初次见面的客气"→ Lv9-10 "无话不谈,可以撒娇拌嘴"),验收要求同一问题在不同等级下语气可感知不同。

---

## 8. 货币系统

**星星币** ⭐:

| 来源 | 数额 | 防刷 |
|---|---|---|
| 挂机 | +10/小时 | 键鼠空闲 ≥30 分钟暂停计时(Rust 侧检测);进度持久化,崩溃不丢 |
| 每日签到 | +30;连续第 7 天 +100 | 本地日期,断签重置连击 |
| 每日任务:摸头×5 / 喂食×1 / 聊天×1 | 各 +10 | 每日一次 |
| 健康任务 | +20 | 每日 3 次 |

- 余额显示在右键菜单、图鉴页、抽卡页;
- 入账时宠物头顶冒星星粒子 + 计数飘字;
- 所有变动写 `currency_log`(来源、数额、时间),便于排查与防回档作弊(余额 = SUM 校验)。

---

## 9. 抽卡系统

- 单抽 **100**,十连 **900**(十连必出 ≥R);
- 动画:星星汇聚 → 蛋(按稀有度变色:灰/蓝/紫/金)→ 摇晃 → 破壳;SSR 额外全屏金色流光 + 屏幕轻震;**可点击跳过**;
- **重复判定**:因组合空间巨大,"重复" = **12 维离散部件全同**(忽略色板抖动与 scale)才算重复,自动转碎片:N=10 / R=30 / SR=100 / SSR=300;
- **碎片商店**:兑换"心愿宠物"——用户从**部件库**中自选物种+关键部件定制一只(R 300 / SR 1000 / SSR 3000 碎片),或 1 碎片 = 1 星星币回兑;
- 抽卡记录页:时间、结果缩略图、稀有度筛选;保底进度条:"距 SR 保底 23 抽 / 距 SSR 保底 71 抽";
- 扣币、写宠物、写记录、更新保底 **同一事务**,中途失败全回滚。

---

## 10. 图鉴系统

组合空间千万级,"全组合剪影"不可行 → **双层图鉴**:

### 第 1 层:我的宠物(档案馆)
- 网格展示**已获得**的每一只(彩色立绘,按 seed 复现渲染);
- 详情页:立绘、名字(可改)、稀有度、性格、部件清单、获得日期、亲密度等级、累计互动次数、"设为出场"按钮(同屏仅一只);
- 放生:可放生重复度高的宠物换碎片(二次确认,出场中/Lv5+ 的宠物不可放生)。

### 第 2 层:部件图鉴(收集目标,承担"???剪影"角色)
- 按 12 个维度分页,每格一个部件:已解锁(任意宠物携带过)= 彩色图标;未解锁 = 剪影 + "???";
- 顶部进度:总收集率 + 按稀有度分类(N 32/40 · R 12/20 · SR 3/12 · SSR 0/8);
- **系列成就**(由 parts.json 的 `seriesTags` 驱动):如"烘焙屋系列 3 件套 +200⭐"、"集齐全部 SR 部件 +1000⭐"、"图鉴 100% +5000⭐ + 隐藏色板"。

这样既保留"剪影 → 点亮"的收集爽感,又让千万级组合成为特色(每只都独一无二)而非负担。

---

## 11. 数据库设计

```sql
CREATE TABLE pets (
  id TEXT PRIMARY KEY,              -- ULID
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('N','R','SR','SSR')),
  species TEXT NOT NULL,
  parts_json TEXT NOT NULL,         -- 12 维部件 + resolved palette + seed + scale
  personality TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  intimacy_level INTEGER NOT NULL DEFAULT 1,
  intimacy_points INTEGER NOT NULL DEFAULT 0,
  interact_count INTEGER NOT NULL DEFAULT 0,
  nickname_for_owner TEXT,          -- Lv7 解锁
  released INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE owner_memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('short','long')),
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 3,
  created_at INTEGER NOT NULL,
  last_referenced_at INTEGER
);

CREATE TABLE currency (              -- 单行表
  id INTEGER PRIMARY KEY CHECK (id = 1),
  balance INTEGER NOT NULL DEFAULT 0,
  shards INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE currency_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delta INTEGER NOT NULL, source TEXT NOT NULL, created_at INTEGER NOT NULL
);

CREATE TABLE gacha_state (           -- 单行:保底计数
  id INTEGER PRIMARY KEY CHECK (id = 1),
  pity_sr INTEGER NOT NULL DEFAULT 0,
  pity_ssr INTEGER NOT NULL DEFAULT 0,
  total_pulls INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE gacha_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL, result_pet_id TEXT, rarity TEXT NOT NULL,
  was_duplicate INTEGER NOT NULL DEFAULT 0,
  pity_sr_after INTEGER NOT NULL, pity_ssr_after INTEGER NOT NULL
);

CREATE TABLE daily_stats (
  date TEXT PRIMARY KEY,             -- 'YYYY-MM-DD'
  pet_count INTEGER DEFAULT 0, feed_count INTEGER DEFAULT 0,
  chat_count INTEGER DEFAULT 0, health_count INTEGER DEFAULT 0,
  checkin_done INTEGER DEFAULT 0, checkin_streak INTEGER DEFAULT 0,
  idle_minutes INTEGER DEFAULT 0
);

CREATE TABLE unlocked_parts (        -- 部件图鉴
  part_id TEXT PRIMARY KEY, first_pet_id TEXT, unlocked_at INTEGER
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY, value TEXT   -- llm_api_url / llm_api_key(DPAPI/Keychain 加密)
);                                    -- active_pet_id / window_sense_enabled / ...
```

---

## 12. 模块划分与目录结构

```
Pets/
├── src-tauri/                    # Rust
│   ├── src/
│   │   ├── window.rs             # 透明窗口、点击穿透命中测试
│   │   ├── system_sense.rs       # 活动窗口标题、空闲检测(win/mac 双实现)
│   │   ├── db.rs                 # SQLite 迁移与事务封装
│   │   ├── llm_proxy.rs          # LLM 请求代理(Key 加密存取)
│   │   └── scheduler.rs          # 挂机计时、每日结算、衰减补算
├── src/                          # 前端 TS
│   ├── engine/                   # 渲染:部件合成、调色、粒子(不含业务)
│   ├── fsm/                      # 状态机:纯逻辑,动作数据驱动
│   ├── gen/                      # 形态生成:稀有度/保底/约束求解(纯函数)
│   ├── systems/                  # intimacy / currency / gacha / memory / codex
│   ├── ui/                       # panel 窗口:抽卡、图鉴、设置、商店
│   └── llm/                      # prompt 组装、降级台词库
├── assets/
│   ├── config/                   # parts.json / animations.json / rewards.json
│   └── sprites/                  # 灰度部件图(一期为程序化生成)
└── tests/                        # gen/fsm/intimacy 单元测试 + 蒙特卡洛
```

依赖方向:`ui → systems → gen/fsm → engine`,LLM 与渲染互不感知;抽卡概率、保底、亲密度计算全部纯函数,直接可测。

---

## 13. LLM 集成设计

### 13.1 调用点(仅 3 处,控成本)
1. 用户双击发起的对话;
2. Lv5+ 主动搭话(30 分钟冷却,每日 ≤5 次);
3. 每日记忆压缩(1 次)。

### 13.2 对话 Prompt 模板

```
[system]
你是一只桌面宠物,名叫{name},是{species}。性格:{personality}(说话风格示例:{style_examples})。
你和主人的亲密度是 Lv{level}:{relationship_tone_desc}。
{if nickname}你叫主人"{nickname}"。{endif}
你记得关于主人的事:{top5_memories}
今天的互动:{today_summary}
规则:回复不超过 60 字,口语化,符合性格;不要提到你是 AI。

[messages] 最近 10 轮对话…
```

### 13.3 降级策略(验收硬指标)
- 无 Key / 断网 / 超时 3s:对话降级为**性格台词库**(每性格 ×每亲密度段 ×20 条,本地 JSON);
- 主动搭话降级为规则模板("还在写论文呀,加油!");
- 记忆压缩降级为跳过(次日补跑);
- 应用其余功能与 LLM 零耦合,完全可用。

---

## 14. 性能与隐私

**性能**(目标:空闲 CPU <3%、内存 <200MB):
- 空闲(无动画关键变化)时渲染降到 10fps,窗口被全屏应用遮挡时暂停渲染;
- 粒子上限 200,对象池复用;panel 窗口关闭即销毁 WebView;
- 活动窗口轮询 5s 一次,空闲检测 30s 一次。

**隐私**:
- 仅读窗口**标题**,不截屏、不读内容、不上传;标题只在内存中用于规则匹配,主动搭话调 LLM 时仅发送匹配出的**场景标签**(如"在写文档"),不发送原始标题;
- 首次启动弹窗说明 + 可一键关闭窗口感知(settings.window_sense_enabled);
- LLM Key 用 Windows DPAPI / macOS Keychain 加密存储,请求仅发往用户配置的 URL。

---

## 15. 分期交付计划

| 期 | 内容 | 交付物 |
|---|---|---|
| **一期(核心可玩)** | Tauri 透明窗口 + 点击穿透命中测试;程序化占位美术;默认宠物 1 只;FSM 19 动作;点击/拖拽/右键菜单;SQLite 基础表;位置/宠物持久化 | 可运行构建(Win/mac)、动作触发测试清单、README |
| **二期(收集闭环)** | parts.json 全量部件 + 约束生成器;稀有度/保底;星星币全来源 + 防刷;抽卡动画 + 碎片 + 记录;双层图鉴 + 切换出场;系列成就 | 构建、蒙特卡洛报告(10000 抽偏差 <1%)、保底单测、测试清单、README |
| **三期(灵魂注入)** | LLM 设置页 + 对话气泡;短期/长期记忆 + 每日压缩;亲密度全套(获取/衰减/解锁/语气注入);窗口感知 + 健康提醒 + 主动搭话;降级台词库 | 构建、断网降级测试清单、不同亲密度语气对照样例、README |

---

## 16. 验收标准与测试

1. **动作**:19 动作全部可触发;看门狗日志中无强制复位记录(= 无卡死);切换过渡帧完整(录屏抽查)。
2. **概率**:`tests/gacha_montecarlo.test.ts` 连抽 10000 次 ×10 轮,各稀有度偏差 <1%;保底边界单测:第 49/50 抽、第 99/100 抽、SR 保底与 SSR 保底同抽触发、十连跨保底。
3. **持久化**:E2E:造数据 → 杀进程 → 重启,校验宠物/货币/亲密度/图鉴/记忆/保底计数全部一致;挂机进度断电不丢(每分钟落盘)。
4. **降级**:拔网线/清 Key 后:对话出台词库、其余功能全通。
5. **性能**:空闲 30 分钟采样 CPU <3%、内存 <200MB(任务管理器 + 脚本采样)。
6. **语气**:同一问题("你在干嘛?")在 Lv1 / Lv5 / Lv10 下的回复对照,人为可感知差异(附样例进测试清单)。
7. **生成器**:属性测试——随机 10 万次生成,断言:无 requires/excludes 冲突、每维度必有值、SR 恰 1 特效、SSR 2~3 特效、专属部件不越级出现。
```
