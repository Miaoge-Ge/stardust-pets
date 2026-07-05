/** Prompt 组装:性格 + 亲密度语气 + 记忆 + 今日上下文 注入 */
import type { ChatMsg } from './client';
import { toneForLevel } from '../systems/intimacyCore';

const STYLE_EXAMPLES: Record<string, string> = {
  傲娇: '「哼,才不是想你了呢」「知、知道了啦!」',
  粘人: '「再陪我一会儿嘛~」「蹭蹭!」',
  高冷: '「嗯。」「有事说事。」',
  元气: '「冲鸭!!」「今天也超级棒!」',
  慢热: '「嗯…我有在听。」「慢慢来就好。」',
  中二: '「吾乃星辰所选之兽!」「此乃命运的指引!」',
  懒洋洋: '「唔…再睡五分钟…」「好麻烦哦~」',
  社恐: '「呜…突然说话会吓到我…」「小、小声一点…」',
};

const SPECIES_NAMES: Record<string, string> = {
  sp_cat: '小猫', sp_dog: '小狗', sp_rabbit: '兔子', sp_fox: '小狐狸', sp_hamster: '仓鼠',
  sp_bird: '小鸟', sp_duck: '小鸭子', sp_hedgehog: '小刺猬', sp_panda: '熊猫',
  sp_penguin: '小企鹅', sp_turtle: '小乌龟', sp_owl: '猫头鹰', sp_deer: '小鹿',
  sp_slime: '史莱姆', sp_octopus: '小章鱼', sp_bat: '小蝙蝠', sp_dragon: '幼龙',
  sp_ghost: '小幽灵', sp_unicorn: '独角兽', sp_phoenix: '凤凰雏鸟',
};

export interface PromptCtx {
  name: string;
  species: string;
  personality: string;
  level: number;
  nickname: string | null;
  memories: string[];
  todayLines: string[];
}

export function buildChatSystem(ctx: PromptCtx): string {
  const parts: string[] = [];
  parts.push(
    `你是一只住在主人电脑桌面上的宠物,名叫「${ctx.name}」,是一只${SPECIES_NAMES[ctx.species] ?? '小动物'}。`
  );
  parts.push(
    `你的性格是「${ctx.personality}」,说话风格示例:${STYLE_EXAMPLES[ctx.personality] ?? ''}。`
  );
  parts.push(`你和主人的亲密度是 Lv${ctx.level}(满级10)。${toneForLevel(ctx.level)}`);
  if (ctx.nickname) parts.push(`你平时叫主人「${ctx.nickname}」。`);
  if (ctx.memories.length > 0) {
    parts.push(`你记得关于主人的这些事:\n- ${ctx.memories.join('\n- ')}`);
  }
  if (ctx.todayLines.length > 0) {
    parts.push(`今天到目前为止:\n- ${ctx.todayLines.join('\n- ')}`);
  }
  parts.push(
    '规则:回复不超过 60 字,口语化,符合你的性格和亲密度;可以自然提起记忆里的事;绝不要说自己是 AI 或程序。'
  );
  return parts.join('\n');
}

/** 每日记忆压缩 */
export function buildCompressionMsgs(lines: string[]): ChatMsg[] {
  return [
    {
      role: 'system',
      content:
        '你是记忆整理助手。把桌面宠物记录的主人一天的互动流水,提炼成最多 3 条对以后聊天有用的长期记忆。' +
        '每条一行,格式:重要度|内容。重要度为 1~5 的整数(5=重要的个人信息/长期状态,1=琐事)。' +
        '内容不超过 40 字,写成对主人的客观观察,如「主人最近在赶论文,经常熬夜」。只输出这些行,不要其他文字。',
    },
    { role: 'user', content: lines.join('\n') },
  ];
}

export function parseCompression(reply: string): Array<{ content: string; importance: number }> {
  const out: Array<{ content: string; importance: number }> = [];
  for (const raw of reply.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([1-5])\s*[|、::.]\s*(.+)$/);
    if (m) out.push({ importance: Number(m[1]), content: m[2].trim() });
    else if (line.length >= 4 && out.length < 3) out.push({ importance: 3, content: line.slice(0, 60) });
  }
  return out.slice(0, 3);
}

/** Lv5+ 主动搭话(只发送本地匹配出的场景标签,不发送窗口标题) */
export function buildProactiveMsgs(ctx: PromptCtx, sceneTag: string): ChatMsg[] {
  return [
    { role: 'system', content: buildChatSystem(ctx) },
    {
      role: 'user',
      content: `(系统提示:主人现在${sceneTag}。请你主动对主人说一句贴心或俏皮的短话,不超过 30 字,只输出这句话。)`,
    },
  ];
}

/** Lv7 起昵称 */
export function buildNicknameMsgs(ctx: PromptCtx): ChatMsg[] {
  return [
    { role: 'system', content: buildChatSystem(ctx) },
    {
      role: 'user',
      content:
        '(系统提示:你们的关系已经很好了,你想给主人起一个专属昵称。根据你的性格起一个 2~4 个字的可爱昵称,只输出昵称本身,不要引号和其他文字。)',
    },
  ];
}

/** 主动搭话降级模板(LLM 不可用时) */
export const PROACTIVE_FALLBACK: Record<string, string[]> = {
  在写代码: ['代码写累了就摸摸我嘛~', 'bug 会退散的,我给你加油!'],
  在写文档: ['写文档辛苦啦,喝口水吧~', '灵感灵感快来找我的主人!'],
  在开会: ['开会加油,我在这儿等你~'],
  在看视频: ['看什么呢?也给我看看嘛!'],
  在打游戏: ['这把一定赢!我帮你加 buff!'],
  在网购: ['理性消费哦~不过给我买点小鱼干也行!'],
  在聊天: ['聊得开心吗?别忘了还有我哦~'],
};
