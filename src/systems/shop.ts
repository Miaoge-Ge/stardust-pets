/**
 * 商店道具:用星星币直接购买亲密度提升,给"聊天/摸头攒不够"的玩家一条补充路径。
 * 每日限购用 settings 表的日期戳存取,不需要新增数据库表。
 */
import { spendCoins } from './currency';
import { gainRaw, type IntimacyGain } from './intimacy';
import { getSetting, setSetting, today } from './db';

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  intimacy: number;
  dailyLimit: number;
  /** 购买后触发的宠物动作(需与 FSM 状态名一致),用于一点小小的仪式感 */
  triggerState?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'treat', name: '小鱼干', desc: '营养满分的小零食', cost: 50, intimacy: 5, dailyLimit: 5, triggerState: 'eat' },
  { id: 'toy', name: '逗猫棒', desc: '陪它玩一会儿', cost: 80, intimacy: 8, dailyLimit: 3, triggerState: 'play_yarn' },
  { id: 'cake', name: '生日蛋糕', desc: '附带庆祝特效', cost: 150, intimacy: 15, dailyLimit: 1, triggerState: 'click_happy' },
  { id: 'collar', name: '精美项圈', desc: '每只宠物限购一次的纪念礼物', cost: 300, intimacy: 20, dailyLimit: 1, triggerState: 'snuggle' },
];

async function purchaseCountToday(itemId: string): Promise<number> {
  const dateKey = `shop_${itemId}_date`;
  const countKey = `shop_${itemId}_count`;
  const savedDate = await getSetting(dateKey);
  if (savedDate !== today()) return 0;
  return Number((await getSetting(countKey)) ?? '0');
}

async function bumpPurchaseCount(itemId: string): Promise<void> {
  await setSetting(`shop_${itemId}_date`, today());
  const n = (await purchaseCountToday(itemId)) + 1;
  await setSetting(`shop_${itemId}_count`, String(n));
}

export interface PurchaseResult {
  ok: boolean;
  reason?: 'limit' | 'coins' | 'owned';
  gain?: IntimacyGain;
  triggerState?: string;
}

/** collar 类一次性道具按宠物 id 记录是否已拥有(而非按日期) */
async function ownsOneTime(itemId: string, petId: string): Promise<boolean> {
  return (await getSetting(`shop_owned_${itemId}_${petId}`)) === '1';
}

export async function getRemainingToday(itemId: string): Promise<number> {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return 0;
  const used = await purchaseCountToday(itemId);
  return Math.max(0, item.dailyLimit - used);
}

export async function buyShopItem(itemId: string, petId: string): Promise<PurchaseResult> {
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return { ok: false };

  if (item.id === 'collar' && (await ownsOneTime(item.id, petId))) {
    return { ok: false, reason: 'owned' };
  }
  const remaining = await getRemainingToday(itemId);
  if (remaining <= 0) return { ok: false, reason: 'limit' };
  if (!(await spendCoins(item.cost, `shop_${item.id}`))) return { ok: false, reason: 'coins' };

  await bumpPurchaseCount(item.id);
  if (item.id === 'collar') await setSetting(`shop_owned_${item.id}_${petId}`, '1');
  const gain = await gainRaw(petId, item.intimacy);
  return { ok: true, gain, triggerState: item.triggerState };
}
