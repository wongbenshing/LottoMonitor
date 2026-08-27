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

/** 下一开奖日:从 from(默认今天)起找最近的 周一(1)/周三(3)/周六(6) */
export function nextOpenDate(from: Date = new Date()): string {
  const d = new Date(from);
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() + 1); // 每日递增(不能基于 from 的日期+ i,跨月会错位)
    const day = d.getDay(); // 0=日
    if (day === 1 || day === 3 || day === 6) return fmtDate(d);
  }
  return fmtDate(d);
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
  const results: GuessPickResult[] = record.picks.map((nums, i) => {
    const tier = checkPrize(nums.slice(0, 5), nums.slice(5, 7), draw);
    const amount = tier === '1' ? (draw.prize1 ?? 0)
      : tier === '2' ? (draw.prize2 ?? 0)
      : tier ? (PRIZE_AMOUNTS[tier] ?? 0) : 0;
    return { pickIndex: i, numbers: nums, tier, amount };
  });
  return {
    ...record,
    status: 'verified',
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
