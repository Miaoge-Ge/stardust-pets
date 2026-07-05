import { RigPlayer } from '../engine/rig';
import { CAT_RIG, SHARED_ANIMS } from '../engine/species/cat';
import { ParticleField } from '../engine/particles';
import { LightEffectField } from '../engine/lightEffects';
import { randomCreatureColors } from '../gen/colors';
import { mulberry32 } from '../gen/prng';

const stage = document.getElementById('stage')!;
const player = new RigPlayer(stage, CAT_RIG);
const svg = stage.querySelector('svg')!;

const rng = mulberry32(42);
const colors = randomCreatureColors(rng, false);
player.setColors({
  'c-body': colors.body,
  'c-shade': colors.shade,
  'c-light': colors.light,
  'c-belly': colors.belly,
  'c-outline': colors.outline,
  'c-pattern': colors.pattern,
  'c-accent': colors.accent,
});

const particles = new ParticleField(svg);
const lights = new LightEffectField(svg, svg.querySelector('[data-part]'));
lights.configure(['fx_breath', 'fx_orbit'], { cx: 50, cy: 55, radius: 22, accent: colors.accent });

player.play(SHARED_ANIMS.sit);

let last = performance.now();
function loop(now: number) {
  const dt = now - last;
  last = now;
  player.tick(dt);
  particles.tick(dt);
  lights.tick(now, { cx: 50, cy: 55, radius: 22, accent: colors.accent });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

setInterval(() => particles.spawn('heart', 50 + (Math.random() - 0.5) * 20, 40), 1200);

for (const btn of document.querySelectorAll('button[data-anim]')) {
  btn.addEventListener('click', () => {
    const key = (btn as HTMLElement).dataset.anim!;
    player.play(SHARED_ANIMS[key] ?? SHARED_ANIMS.sit);
  });
}
