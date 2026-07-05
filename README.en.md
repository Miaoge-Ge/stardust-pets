<div align="center">

# 🐾 Stardust Pets

**An AI-powered desktop pet that keeps you company, remembers you, and is worth collecting**

English | [简体中文](./README.md)

Procedurally generated vector forms × Gacha collection × LLM chat with long-term memory × Bond progression

Built with Tauri 2 (Rust) + TypeScript + hand-drawn SVG skeletal animation · Local SQLite · Privacy-first

</div>

---

## ✨ Features

### 🎭 Alive on your desktop
- Transparent, frameless, always-on-top window; **only the pet itself captures the mouse** — clicks around it pass straight through to your desktop
- 22 FSM-driven actions: sit / lie / sleep / groom / chase tail / wander / **climb up and sit on the top edge of your active window** / struggle when dragged / sulk with its back turned…
- Pat it and it squints and blushes; triple-click and it jumps with joy; poke it while asleep and it startles awake first
- **Natural, elegant transitions**: cross-fade ghost between animations, squash-stretch rebound on state changes, eased acceleration/deceleration for walk/run, a brief pause before turning at screen edges, gravity-arc acceleration when dropping down from a climb, and continuous subtle breathing even at rest — nothing snaps instantly

### 🎨 Hand-drawn vector art (fully reworked in v0.4)
- Dropped the earlier pixel-grid compositing approach entirely in favor of **hand-drawn bezier-curve SVG skeletal animation**: each species is a set of named groups (body/head/ears/tail/legs), naturally anti-aliased and infinitely scalable, recolored for free via CSS variables
- **All 20 species have genuinely distinct anatomy**, not one shared skeleton resized: the turtle is a real flat wide shell shape, hamster/owl are fused round-headed blobs, the bat is dominated by an oversized wing, deer/unicorn stand tall on long legs, slime/octopus/ghost are soft-bodied — recognizable at a glance
- **22 vector particle types** (hearts/stars/bubbles/snowflakes/embers/confetti/coins/gems/fireflies/…) + **23 light-effect presets** (breathing halo/holy ring/aurora ribbon/prism rays/thunder flash/chromatic pulse/…), wired into the rarity drop pool
- **Fully random coloring**: hue is genuinely randomized 0–360° instead of drawn from fixed palette hue-ranges; animated gradient palettes remain as a high-rarity bonus layer
- Dropping the PixiJS/WebGL dependency took the build from 283KB to 55KB gzipped with no WebGL context overhead at runtime

### 🎰 Hundreds of millions of collectible forms
- **11 part dimensions**: **20 species** (cat / dog / rabbit / fox / hamster / bird / duck / hedgehog / panda / penguin / turtle / owl / deer / slime / octopus / bat / baby dragon / ghost / unicorn / phoenix) × body type × material (fur / translucent jelly / scales / stardust) × ears × tail × eyes × mouth × 13 coat patterns × fully random hue × headwear × neckwear — an enormous combinatorial space where each pet is practically unique
- **Five rarity tiers** (N 58% / R 27% / SR 10% / SSR 4.2% / **UR 0.8%**) with **triple pity** (guaranteed SR within 50 pulls, SSR within 100, UR within 200). Rates verified by Monte Carlo tests: 10,000 pulls × 10 rounds, deviation < 1%. UR-exclusive species (unicorn / phoenix), rainbow aura effect and animated rainbow cards
- Star-coin economy: idle earnings (+15 every 20 min) / daily check-in / daily tasks (+15 each) / health tasks; duplicates convert to shards, redeemable for wish-crafted pets of your chosen species
- **Shop intimacy items**: treats / toys / birthday cake / a keepsake collar — spend star coins directly on bond points instead of grinding daily interaction caps
- **Two-layer codex**: every owned pet re-rendered from its seed; a parts codex with ??? silhouettes to light up; set-collection achievements with rewards

### 🧠 Memory, personality, affection
- 8 personalities (tsundere / clingy / aloof / energetic …), chat powered by any **OpenAI-compatible LLM** (configured in Settings)
- **Long-term memory**: daily interactions get compressed into memories ("owner has been crunching on a thesis, staying up late"), retrieved automatically in later chats
- **10 bond levels**: Lv3 unlocks snuggling → Lv5 it starts conversations on its own → Lv7 it gives you a personal nickname → Lv10 hidden visual effects; its tone shifts from polite to clingy as the bond grows
- Reminds you to drink water after an hour of continuous work (click the sign for rewards); nags you to sleep late at night
- **Conversational tools**: double-click to chat and just ask "what's the weather in Tokyo", "any news today", or "remind me to drink water at 3pm" — all three are locally detected and hit free public endpoints (wttr.in for weather, Google News RSS), **no LLM required**, and a due reminder fires a real desktop notification
- **Fully playable without an API key** — chat falls back to personality-based preset lines; everything else (including the three tools above) is unaffected

## 🔒 Privacy

- Reads only the **title** of the active window for interactions — no screenshots, no content; disclosed on first launch and can be turned off
- All data (pets / currency / memories) lives in a local SQLite file; LLM calls send only your chat text and a locally-matched scene tag (e.g. "coding") — raw window titles never leave memory
- Your API key stays local; requests go directly to the endpoint you configure
- Weather/news tools only send the city name or keyword you explicitly ask about to their respective public endpoint (wttr.in / Google News RSS) — never routed through the LLM, nothing else uploaded; reminders are stored and fired entirely locally

## 📦 Install

Download `stardust-pets-windows-x64.zip` from [Releases](../../releases), unzip, and run `stardust-pets.exe` (Windows 10/11 with WebView2, which is usually preinstalled).

> macOS: the code paths are cross-platform (window sensing / idle detection), but builds haven't been verified on real hardware yet — PRs welcome.

## 🛠️ Development

```bash
# Requirements: Node.js ≥ 20, Rust stable (VS C++ Build Tools on Windows)
npm install
npm run tauri dev     # run in dev mode
npm test              # unit tests (pity / rates / generator constraints / bond / reminder parsing)
npm run tauri build   # package
```

```
src/
  config/parts.json    part library, constraints, palettes, achievement sets (data-driven)
  gen/                 core generation: seeded PRNG / rarity & pity / constraint solver / random color (pure)
  engine/
    rig.ts              SVG skeletal animation player (keyframe interpolation)
    species/            20 vector species models (cat.ts hand-drawn; generate.ts parametrically builds the other 19)
    particles.ts          22 vector particle types
    lightEffects.ts        23 light-effect presets
    renderer.ts            mounts rig + particle layer + light layer into the window
  fsm/                 action state machine (pure logic)
  systems/             currency / gacha / bond / memory / window sensing / shop / reminders
  panel/               gacha · codex · shop · settings panel
  llm/                 prompt building + fallback lines + weather/news/reminder tool detection
src-tauri/             Rust: click-through hit testing / window sensing / LLM proxy / weather & news fetch / desktop notifications / SQLite
```

Design doc: [DESIGN.md](./DESIGN.md) (Chinese) · Manual test checklist: [TESTING.md](./TESTING.md)

## 📄 License

[MIT](./LICENSE)
