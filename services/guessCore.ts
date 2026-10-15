// 竞猜核心纯函数(前后端共用:前端统计展示,后端 guess_agent 验证/选号)
import type { GuessParams, GuessRecord, GuessPickResult, GuessStats, LottoDraw } from '../types';
import { checkPrize, calculateTransitionResult, calculateRangeTransitionResult, calculateConsecutiveTransitionResult, calculateFrontRepeatTransitionResult, calculateBackRepeatTransitionResult, calculateOddTransitionResult } from '../utils';
import { PRIZE_AMOUNTS, PICK_COST } from '../constants';

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 彩票市场休市日(不开奖)。
 *
 * 休市期间大乐透**停止销售与开奖**,开奖日(周一/三/六)落在休市区间内则该期不存在。
 * 来源:财政部年度《彩票市场休市安排的公告》(春节 + 国庆两段),每年公告发布后必须补充,
 * 否则 dailyPick 会生成一个永远不会开奖的目标期(2026-10-03 就是这么卡住的:
 * 该条记录靠 history.csv 匹配开奖日,匹配不到就永远 pending,前端「目标开奖日」卡死在它上面)。
 *
 * 已录入:2026 国庆 10-01~10-04(财政部公告 2025 年第 14 号;10-05 恢复销售)。
 */
export const MARKET_CLOSED_DATES: ReadonlySet<string> = new Set([
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
]);

/** 该日期是否休市(非开奖日,历史上也不会有开奖数据) */
export function isMarketClosed(dateStr: string): boolean {
  return MARKET_CLOSED_DATES.has(dateStr);
}

/** 下一开奖日:从 from(默认今天)起找最近的 周一(1)/周三(3)/周六(6),跳过休市日 */
export function nextOpenDate(from: Date = new Date()): string {
  const d = new Date(from);
  for (let i = 1; i <= 14; i++) { // 上限 14 天:休市最长连续 4 天,留足余量
    d.setDate(d.getDate() + 1); // 每日递增(不能基于 from 的日期+ i,跨月会错位)
    const day = d.getDay(); // 0=日
    if ((day === 1 || day === 3 || day === 6) && !isMarketClosed(fmtDate(d))) return fmtDate(d);
  }
  return fmtDate(d);
}

/** 大乐透开奖时间 21:25(分钟制,>= 视为已开奖) */
export const DRAW_CUTOFF_MINUTES = 21 * 60 + 25;

/** 当前开放竞猜的开奖日:今天是开奖日(周一/三/六,非休市)且未到开奖时间 → 今天;否则下一开奖日 */
export function currentOpenDate(from: Date = new Date()): string {
  const day = from.getDay();
  if ((day === 1 || day === 3 || day === 6)
    && !isMarketClosed(fmtDate(from))
    && from.getHours() * 60 + from.getMinutes() < DRAW_CUTOFF_MINUTES) {
    return fmtDate(from);
  }
  return nextOpenDate(from);
}

/** 开奖日:周一(1)/周三(3)/周六(6) 且非休市 —— 非开奖日为 周二/周四/周五/周日 + 全部休市日 */
export function isDrawDay(d: Date): boolean {
  if (isMarketClosed(fmtDate(d))) return false;
  const day = d.getDay();
  return day === 1 || day === 3 || day === 6;
}

/**
 * 每日 10:00 自动选号该生成哪一期(纯函数)。返回 null = 本次不生成。
 *
 * 铁律:生成时的输入历史必须覆盖「目标期之前最近一次开奖」。
 * 开奖日(周一/三/六)当天 10:00,当晚那期还没开(21:25),此刻生成的"下一期"必然
 * 漏掉当晚这一期 → 因此规则是:**只有"今天不是开奖日"时才生成下一期**。
 * 非开奖日生成 → 目标期 = nextOpenDate,输入正好是紧邻的上一期,零漏期。
 *
 * @param existingTargets 已有记录的 targetDate 列表(已存在下期序列则跳过)
 */
export function resolveDailyTarget(now: Date, existingTargets: string[]): string | null {
  if (isDrawDay(now)) return null;                 // 开奖日:当晚那期未开,不生成下一期
  const next = nextOpenDate(now);
  if (existingTargets.includes(next)) return null;  // 下期已有序列(周四已生成 → 周五跳过)
  return next;
}

/** 期号推算:最新期号 +1,后三位 >156 进位到次年(大乐透每年约 156 期) */
export function nextPeriodId(latestId: string): string {
  const m = latestId.match(/^(\d{2})(\d{3})$/);
  if (!m) return String(parseInt(latestId) + 1);
  const year = parseInt(m[1]);
  const seq = parseInt(m[2]);
  if (seq >= 156) return `${String(year + 1).padStart(2, '0')}001`;
  return `${String(year).padStart(2, '0')}${String(seq + 1).padStart(3, '0')}`;
}

/** 验证一期:对每组选号用 checkPrize 判定,返回逐组结果 + 总奖金(1/2 等取开奖真实奖金) */
export function verifyRecord(record: GuessRecord, draw: LottoDraw): GuessRecord {
  // v1.2.5: 旧规(≤26013)固定奖默认表 10000/3000/300/200/100/15/5
  const isNewRule = (parseInt(draw.id) >= 26014) || (draw.date >= '2026-02-02');
  const OLD_FIXED: Record<string, number> = { '3': 10000, '4': 3000, '5': 300, '6': 200, '7': 100, '8': 15, '9': 5 };
  const results: GuessPickResult[] = record.picks.map((nums, i) => {
    const tier = checkPrize(nums.slice(0, 5), nums.slice(5, 7), draw);
    // v1.2.5: 固定奖金额优先用官方当期实际值(draw.prize3..7,随奖池分档),缺省按规则版本默认表
    const amount = tier === '1' ? (draw.prize1 ?? 0)
      : tier === '2' ? (draw.prize2 ?? 0)
      : tier === '3' ? (draw.prize3 ?? (isNewRule ? PRIZE_AMOUNTS['3'] : OLD_FIXED['3']) ?? 0)
      : tier === '4' ? (draw.prize4 ?? (isNewRule ? PRIZE_AMOUNTS['4'] : OLD_FIXED['4']) ?? 0)
      : tier === '5' ? (draw.prize5 ?? (isNewRule ? PRIZE_AMOUNTS['5'] : OLD_FIXED['5']) ?? 0)
      : tier === '6' ? (draw.prize6 ?? (isNewRule ? PRIZE_AMOUNTS['6'] : OLD_FIXED['6']) ?? 0)
      : tier === '7' ? (draw.prize7 ?? (isNewRule ? PRIZE_AMOUNTS['7'] : OLD_FIXED['7']) ?? 0)
      : tier ? (isNewRule ? PRIZE_AMOUNTS[tier] ?? OLD_FIXED[tier] ?? 0 : OLD_FIXED[tier] ?? PRIZE_AMOUNTS[tier] ?? 0) : 0;
    return { pickIndex: i, numbers: nums, tier, amount };
  });
  return {
    ...record,
    status: 'verified',
    periodId: draw.id,   // v1.1.1: 回填真实期号(创建时按最新期+1推算可能落后一期)
    drawId: draw.id,
    results,
    totalPrize: results.reduce((s, r) => s + r.amount, 0),
  };
}

/** 统计聚合(只统计已 verified 记录) */
export function computeGuessStats(records: GuessRecord[]): GuessStats {
  const verified = records.filter(r => r.status === 'verified');
  const totalPicks = verified.reduce((s, r) => s + r.picks.length, 0);
  const winningPicks = verified.reduce((s, r) =>
    s + (r.results?.filter(x => x.tier).length ?? 0), 0);
  const winDays = verified.filter(r => (r.totalPrize ?? 0) > 0).length;
  const totalPrize = verified.reduce((s, r) => s + (r.totalPrize ?? 0), 0);
  const totalCost = totalPicks * PICK_COST;
  return {
    totalPeriods: verified.length,
    totalPicks,
    winningPicks,
    pickSuccessRate: totalPicks > 0 ? winningPicks / totalPicks : 0,
    winDays,
    totalCost,
    totalPrize,
    roi: totalCost > 0 ? (totalPrize - totalCost) / totalCost : 0,
  };
}

/** 容错解析 guess_records.json(异常返回 []) */
export function parseGuessJson(text: string): GuessRecord[] {
  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data as GuessRecord[] : [];
  } catch {
    return [];
  }
}

/** 选号参数自动计算(与 AIView 一致,复用 6 个转移矩阵的最佳区间/选项) */
export function computeBestParams(history: LottoDraw[]): GuessParams {
  const sum = calculateTransitionResult(history).bestInterval;
  const range = calculateRangeTransitionResult(history).bestInterval;
  const consecutive = [calculateConsecutiveTransitionResult(history).bestInterval.index];
  const frontRepeat = [calculateFrontRepeatTransitionResult(history).bestInterval.index];
  const backRepeat = [calculateBackRepeatTransitionResult(history).bestInterval.index];
  const odd = [calculateOddTransitionResult(history).bestInterval.index];
  return {
    sumMin: sum.min, sumMax: sum.max,
    rangeMin: range.min, rangeMax: range.max,
    consecutive, frontRepeat, backRepeat, odd,
  };
}

/** 加入一组到下期竞猜(目标期已开奖则抛错)。返回 {records, pickIndex, alreadyExists} */
export function addPick(
  records: GuessRecord[], targetDate: string, numbers: number[],
  params: GuessParams, now: Date = new Date()
): { records: GuessRecord[]; pickIndex: number; alreadyExists: boolean } {
  const existing = records.find(r => r.targetDate === targetDate);
  if (existing?.status === 'verified') {
    throw new Error('该期已开奖,不能修改');
  }
  if (existing) {
    const dup = existing.picks.findIndex(p => JSON.stringify(p) === JSON.stringify(numbers));
    if (dup >= 0) return { records, pickIndex: -1, alreadyExists: true };
    return {
      records: records.map(r => r.targetDate === targetDate
        ? { ...r, picks: [...r.picks, numbers] } : r),
      pickIndex: existing.picks.length,
      alreadyExists: false,
    };
  }
  const rec: GuessRecord = {
    targetDate, periodId: '', picks: [numbers], params,
    createdAt: now.toISOString(), status: 'pending',
  };
  return { records: [...records, rec], pickIndex: 0, alreadyExists: false };
}

/** 移除一组并重排索引;移空则删除整条记录。返回 {records, removed} */
export function removePick(
  records: GuessRecord[], targetDate: string, pickIndex: number
): { records: GuessRecord[]; removed: boolean } {
  const idx = records.findIndex(r => r.targetDate === targetDate);
  if (idx < 0) return { records, removed: false };
  const rec = records[idx];
  if (rec.status === 'verified') throw new Error('该期已开奖,不能修改');
  if (pickIndex < 0 || pickIndex >= rec.picks.length) return { records, removed: false };
  const picks = rec.picks.filter((_, i) => i !== pickIndex);
  const updated = picks.length === 0
    ? records.filter((_, i) => i !== idx)          // 移空 → 删整条
    : records.map((r, i) => i === idx ? { ...r, picks } : r);
  return { records: updated, removed: true };
}
