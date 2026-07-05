<div align="center">

# 🐾 Stardust Pets

**An AI-powered desktop pet that keeps you company, remembers you, and is worth collecting**

English | [简体中文](./README.md)

Procedurally generated pixel forms × Gacha collection × LLM chat with long-term memory × Bond progression

Built with Tauri 2 (Rust) + TypeScript + PixiJS · Local SQLite · Privacy-first

</div>

---

## ✨ Features

### 🎭 Alive on your desktop
- Transparent, frameless, always-on-top window; **only the pet itself captures the mouse** — clicks around it pass straight through to your desktop
- 22 FSM-driven actions: sit / lie / sleep / groom / chase tail / wander / **climb up and sit on the top edge of your active window** / struggle when dragged / sulk with its back turned…
- Pat it and it squints and blushes; triple-click and it jumps with joy; poke it while asleep and it startles awake first
- **Natural, elegant transitions**: cross-fade ghost between animations, squash-stretch rebound on state changes, eased acceleration/deceleration for walk/run, a brief pause before turning at screen edges, gravity-arc acceleration when dropping down from a climb, and continuous subtle breathing even at rest — nothing snaps instantly

### 🎨 Refined pixel art
- 48px base → an intermediate 96px pass redraws rounded eyes (dual highlights + iris color), whiskers, softened blush, and chest-fur texture → upscaled to 192px, then linearly downsampled to 88px on screen — no more mosaic edges
- 8-phase walk/run gait (with half-lift transition frames) and dual-tone body shading for more volume

### 🎰 Hundreds of millions of collectible forms
- **11 part dimensions**: **20 species** (cat / dog / rabbit / fox / hamster / bird / duck / hedgehog / panda / penguin / turtle / owl / deer / slime / octopus / bat / baby dragon / ghost / unicorn / phoenix) × body type × material (fur / translucent jelly / scales / stardust) × ears × tail × eyes × mouth × 13 coat patterns × procedural palettes × headwear × neckwear — 100M+ discrete combos, and palette jitter makes each pet practically unique
- **Five rarity tiers** (N 58% / R 27% / SR 10% / SSR 4.2% / **UR 0.8%**) with **triple pity** (guaranteed SR within 50 pulls, SSR within 100, UR within 200). Rates verified by Monte Carlo tests: 10,000 pulls × 10 rounds, deviation < 1%. UR-exclusive species (unicorn / phoenix), rainbow aura effect and animated rainbow cards
- Star-coin economy: idle earnings / daily check-in / daily tasks / health tasks; duplicates convert to shards, redeemable for wish-crafted pets of your chosen species
- **Two-layer codex**: every owned pet re-rendered from its seed; a parts codex with ??? silhouettes to light up; set-collection achievements with rewards

### 🧠 Memory, personality, affection
- 8 personalities (tsundere / clingy / aloof / energetic …), chat powered by any **OpenAI-compatible LLM** (configured in Settings)
- **Long-term memory**: daily interactions get compressed into memories ("owner has been crunching on a thesis, staying up late"), retrieved automatically in later chats
- **10 bond levels**: Lv3 unlocks snuggling → Lv5 it starts conversations on its own → Lv7 it gives you a personal nickname → Lv10 hidden visual effects; its tone shifts from polite to clingy as the bond grows
- Reminds you to drink water after an hour of continuous work (click the sign for rewards); nags you to sleep late at night
- **Fully playable without an API key** — chat falls back to personality-based preset lines; everything else is unaffected

## 🔒 Privacy

- Reads only the **title** of the active window for interactions — no screenshots, no content; disclosed on first launch and can be turned off
- All data (pets / currency / memories) lives in a local SQLite file; LLM calls send only your chat text and a locally-matched scene tag (e.g. "coding") — raw window titles never leave memory
- Your API key stays local; requests go directly to the endpoint you configure

## 📦 Install

Download `stardust-pets-windows-x64.zip` from [Releases](../../releases), unzip, and run `stardust-pets.exe` (Windows 10/11 with WebView2, which is usually preinstalled).

> macOS: the code paths are cross-platform (window sensing / idle detection), but builds haven't been verified on real hardware yet — PRs welcome.

## 🛠️ Development

```bash
# Requirements: Node.js ≥ 20, Rust stable (VS C++ Build Tools on Windows)
npm install
npm run tauri dev     # run in dev mode
npm test              # unit tests (pity / rates / generator constraints / bond)
npm run tauri build   # package
```

```
src/
  config/parts.json    part library, constraints, palettes, achievement sets (data-driven)
  gen/                 core generation: seeded PRNG / rarity & pity / constraint solver (pure)
  engine/              pixel renderer: silhouette compositing + auto outline + shading / Pixi FX
  fsm/                 action state machine (pure logic)
  systems/             currency / gacha / bond / memory / window sensing
  panel/               gacha · codex · shop · settings panel
  llm/                 prompt building + fallback lines
src-tauri/             Rust: click-through hit testing / window sensing / LLM proxy / SQLite
```

Design doc: [DESIGN.md](./DESIGN.md) (Chinese) · Manual test checklist: [TESTING.md](./TESTING.md)

## 📄 License

[MIT](./LICENSE)
