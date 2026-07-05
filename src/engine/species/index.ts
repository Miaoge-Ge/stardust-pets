/** 20 物种 rig 注册表:猫是手绘样板,其余 19 种由参数化生成器产出。 */
import type { RigAnim, SpeciesRig } from '../rig';
import { CAT_RIG } from './cat';
import { buildSpeciesRig, SPECIES_SHAPES } from './generate';
import { SHARED_ANIMS } from './sharedAnims';

const GENERATED: Record<string, SpeciesRig> = {};
for (const [id, spec] of Object.entries(SPECIES_SHAPES)) {
  GENERATED[id] = buildSpeciesRig(spec);
}

const REGISTRY: Record<string, SpeciesRig> = { sp_cat: CAT_RIG, ...GENERATED };

export function getSpeciesRig(speciesId: string): SpeciesRig {
  return REGISTRY[speciesId] ?? REGISTRY.sp_cat;
}

export function getAnim(speciesId: string, animKey: string): RigAnim | undefined {
  const rig = getSpeciesRig(speciesId);
  return rig.animations[animKey] ?? SHARED_ANIMS[animKey];
}

export { SHARED_ANIMS };
export const ALL_SPECIES_IDS = Object.keys(REGISTRY);
