import { describe, expect, it } from 'vitest';
import { parseReminder } from '../src/systems/reminders';

describe('parseReminder', () => {
  it('无触发词时返回 null,交给普通聊天流程处理', () => {
    expect(parseReminder('今天天气怎么样')).toBeNull();
    expect(parseReminder('你好呀')).toBeNull();
  });

  it('识别 HH:MM 24 小时制', () => {
    const r = parseReminder('15:30 提醒我喝水');
    expect(r).not.toBeNull();
    const due = new Date(r!.dueAt);
    expect(due.getHours()).toBe(15);
    expect(due.getMinutes()).toBe(30);
    expect(r!.message).toContain('喝水');
  });

  it('识别中文时段 + N点(下午/晚上自动转 24 小时制)', () => {
    const r1 = parseReminder('下午3点提醒我开会');
    expect(r1).not.toBeNull();
    expect(new Date(r1!.dueAt).getHours()).toBe(15);
    expect(r1!.message).toContain('开会');

    const r2 = parseReminder('晚上8点半提醒我睡觉');
    expect(r2).not.toBeNull();
    expect(new Date(r2!.dueAt).getHours()).toBe(20);
    expect(new Date(r2!.dueAt).getMinutes()).toBe(30);

    const r3 = parseReminder('上午9点提醒我开会');
    expect(new Date(r3!.dueAt).getHours()).toBe(9);
  });

  it('识别相对时间:N 分钟后 / N 小时后', () => {
    const before = Date.now();
    const r = parseReminder('提醒我 30 分钟后休息');
    expect(r).not.toBeNull();
    expect(r!.dueAt).toBeGreaterThanOrEqual(before + 29 * 60_000);
    expect(r!.dueAt).toBeLessThanOrEqual(before + 31 * 60_000);
    expect(r!.message).toContain('休息');
  });

  it('已过去的时刻顺延到明天', () => {
    const past = new Date();
    past.setHours(past.getHours() - 2, 0, 0, 0);
    const hh = String(past.getHours()).padStart(2, '0');
    const r = parseReminder(`${hh}:00 提醒我复盘`);
    expect(r).not.toBeNull();
    expect(r!.dueAt).toBeGreaterThan(Date.now());
  });

  it('未识别到具体时间时返回 null', () => {
    expect(parseReminder('提醒我一下')).toBeNull();
  });

  it('清理后的 message 不包含触发词/时间短语', () => {
    const r = parseReminder('下午3点提醒我去开会');
    expect(r!.message).not.toMatch(/提醒|点|下午/);
  });
});
