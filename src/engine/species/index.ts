/**
 * 20 物种 rig 注册表:猫是手绘样板,其余 19 种由参数化生成器产出。
 * rig 现在按每只宠物实际的耳/尾/头饰/颈饰/体型现场构建(不再是纯物种维度的静态表),
 * 这样图鉴里点亮的部件才会真正体现在外观上。
 */
import type { Look } from '../look';
import type { RigAnim, SpeciesRig } from '../rig';
import { buildCatRig, SHARED_ANIMS } from './cat';
import { buildSpeciesRig, SPECIES_SHAPES } from './generate';

export function buildLookRig(look: Look): SpeciesRig {
  if (look.species === 'sp_cat' || !SPECIES_SHAPES[look.species]) {
    return buildCatRig(look);
  }
  return buildSpeciesRig(SPECIES_SHAPES[look.species], look);
}

export function getAnim(speciesId: string, animKey: string): RigAnim | undefined {
  return SHARED_ANIMS[animKey];
}

export { SHARED_ANIMS };
export const ALL_SPECIES_IDS = ['sp_cat', ...Object.keys(SPECIES_SHAPES)];
