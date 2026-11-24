// 竞猜核心纯函数(前后端共用:前端统计展示,后端 guess_agent 验证/选号)
import type { GuessParams, GuessRecord, GuessPickResult, GuessStats, LottoDraw, PickFeatures, GuessGate } from '../types';
import { checkPrize, calculateTransitionResult, calculateRangeTransitionResult, calculateConsecutiveTransitionResult, calculateFrontRepeatTransitionResult, calculateBackRepeatTransitionResult, calculateOddTransitionResult } from '../utils';
import {
  PRIZE_AMOUNTS, PICK_COST, PRIZE_AMOUNTS_UPGRADED, UPGRADE_POOL_THRESHOLD,
  TIER_PROBABILITY, ADDITIONAL_COST,
} from '../constants';

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
  // v1.3: 升档期(奖池≥8亿)固定奖默认档也要用升档值,避免"数据缺失时低估奖金"
  const upgraded = isUpgradeWindow([draw]);
  const fixedDefault = (tier: string): number => {
    if (upgraded && PRIZE_AMOUNTS_UPGRADED[tier] !== undefined) return PRIZE_AMOUNTS_UPGRADED[tier];
    return (isNewRule ? PRIZE_AMOUNTS[tier] : OLD_FIXED[tier]) ?? OLD_FIXED[tier] ?? PRIZE_AMOUNTS[tier] ?? 0;
  };
  /** 固定奖取值:官方当期值 > 默认档(并标注来源,不再静默兜底) */
  const fixedAmount = (tier: string, official?: number):
    { amount: number; source: 'official' | 'default' | 'upgraded-default' } => {
    if (official && official > 0) return { amount: official, source: 'official' };
    return { amount: fixedDefault(tier), source: upgraded ? 'upgraded-default' : 'default' };
  };

  const results: GuessPickResult[] = record.picks.map((nums, i) => {
    const tier = checkPrize(nums.slice(0, 5), nums.slice(5, 7), draw);
    if (!tier) return { pickIndex: i, numbers: nums, tier, amount: 0, amountSource: 'official' };
    if (tier === '1' || tier === '2') {
      // 浮动奖只有官方当期值可用;缺失时 amount=0 并标 missing(不编造)
      const official = (tier === '1' ? draw.prize1 : draw.prize2) ?? 0;
      return {
        pickIndex: i, numbers: nums, tier,
        amount: official,
        amountSource: official > 0 ? 'official' : 'missing',
      };
    }
    const { amount, source } = fixedAmount(tier, draw[`prize${tier}` as 'prize3'] as number | undefined);
    return { pickIndex: i, numbers: nums, tier, amount, amountSource: source };
  });

  // v1.3: 固定奖字段全缺 → 标记数据不完整(新规期三至七等奖每期必有人中,缺失即数据问题)
  const fixedMissing = isNewRule
    && ['3', '4', '5', '6', '7'].some(t => !((draw[`prize${t}` as 'prize3'] as number | undefined) ?? 0));
  const floatMissing = !(draw.prize1 ?? 0) || !(draw.prize2 ?? 0);

  return {
    ...record,
    status: 'verified',
    periodId: draw.id,   // v1.1.1: 回填真实期号(创建时按最新期+1推算可能落后一期)
    drawId: draw.id,
    results,
    totalPrize: results.reduce((s, r) => s + r.amount, 0),
    dataIncomplete: fixedMissing || floatMissing,
    drawSnapshot: {
      drawId: draw.id,
      poolAfter: draw.poolAfter,
      isUpgradeWindow: upgraded,
      prize1: draw.prize1, prize2: draw.prize2,
      prize3: draw.prize3, prize4: draw.prize4, prize5: draw.prize5,
      prize6: draw.prize6, prize7: draw.prize7,
      dataIncomplete: fixedMissing || floatMissing,
    },
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
  const totalCost = verified.reduce((s, r) => s + periodCost(r), 0);

  // v1.3 分层:小奖(六/七等) vs 长尾(一~五等),避免单个 ROI 被长尾单次事件支配
  let smallTierPrize = 0;
  let longTailPrize = 0;
  verified.forEach(r => (r.results ?? []).forEach(x => {
    if (!x.tier) return;
    if (x.tier === '6' || x.tier === '7') smallTierPrize += x.amount;
    else longTailPrize += x.amount;
  }));

  // v1.3 升档窗口内外分开统计
  const inWindow = verified.filter(r => r.gate?.upgradeWindow ?? r.drawSnapshot?.isUpgradeWindow ?? false);
  const outWindow = verified.filter(r => !(r.gate?.upgradeWindow ?? r.drawSnapshot?.isUpgradeWindow ?? false));
  const netOf = (rs: GuessRecord[]): number =>
    rs.reduce((s, r) => s + (r.totalPrize ?? 0) - periodCost(r), 0);

  return {
    totalPeriods: verified.length,
    totalPicks,
    winningPicks,
    pickSuccessRate: totalPicks > 0 ? winningPicks / totalPicks : 0,
    winDays,
    totalCost,
    totalPrize,
    roi: totalCost > 0 ? (totalPrize - totalCost) / totalCost : 0,
    smallTierPrize,
    smallTierReturnRate: totalCost > 0 ? smallTierPrize / totalCost : 0,
    longTailPrize,
    longTailReturnRate: totalCost > 0 ? longTailPrize / totalCost : 0,
    netWinPeriods: verified.filter(r => (r.totalPrize ?? 0) > periodCost(r)).length,
    upgradePeriods: inWindow.length,
    nonUpgradePeriods: outWindow.length,
    upgradeNet: netOf(inWindow),
    nonUpgradeNet: netOf(outWindow),
  };
}

/** 单期成本:优先用记录里的 cost(含追加/倍数),旧记录按 注数 × 2 元 */
export function periodCost(record: GuessRecord): number {
  if (record.cost && record.cost.total > 0) return record.cost.total;
  return record.picks.length * PICK_COST;
}

// ============ v1.3 奖池闸门(唯一能提升每元期望返还的机制) ============

/** 最新一期开奖(不依赖数组顺序:按 date 取最大,同 date 取期号最大) */
export function latestDraw(history: LottoDraw[]): LottoDraw | null {
  if (!history.length) return null;
  let best = history[0];
  for (const d of history) {
    if (d.date > best.date || (d.date === best.date && parseInt(d.id) > parseInt(best.id))) best = d;
  }
  return best;
}

/**
 * 升档窗口判定:**上一期开奖后奖池 ≥8 亿 → 本期三至七等奖升档**
 * 依据:财综〔2025〕51 号「奖池资金高于 8 亿元(含)时,三至七等奖单注奖金为 6666/380/200/18/7 元」;
 * 官方与媒体口径均为「奖池破 8 亿,下期固定奖提升 20%~40%」→ 用上期奖池预测本期是否升档。
 * history 为倒序(最新在前)或任意顺序均可,内部按 date 取最新一期。
 * 历史回放(新规 121 期)命中率 119/120 = 99.2%(唯一例外为 26072 期缺奖池数据)。
 */
export function isUpgradeWindow(history: LottoDraw[]): boolean {
  const latest = latestDraw(history);
  if (!latest) return false;
  return (latest.poolAfter ?? 0) >= UPGRADE_POOL_THRESHOLD;
}

/** 距升档阈值还差多少元(已升档 → 0;无奖池数据 → undefined) */
export function upgradeGap(history: LottoDraw[]): number | undefined {
  const latest = latestDraw(history);
  if (!latest || !latest.poolAfter) return undefined;
  return Math.max(0, UPGRADE_POOL_THRESHOLD - latest.poolAfter);
}

/**
 * 闸门建议(软建议,不硬拦):升档期建议 2 注,非升档期建议降到 1 注。
 * 理由:窗口内每元期望返还 63.9% vs 窗口外 52.1%(相对 +22.6%),按年 156 期估算,
 * 只在窗口下注可把年投入 624 元压到 204 元、净亏 -275 元压到 -74 元(约 1/4)。
 */
export function buildGate(
  history: LottoDraw[],
  opts: { windowPicks?: number; offWindowPicks?: number } = {},
): GuessGate {
  const latest = latestDraw(history);
  const upgradeWindow = isUpgradeWindow(history);
  const windowPicks = opts.windowPicks ?? 2;
  const offWindowPicks = opts.offWindowPicks ?? 1;
  return {
    upgradeWindow,
    poolAfter: latest?.poolAfter,
    gapToUpgrade: upgradeGap(history),
    suggestedPicks: upgradeWindow ? windowPicks : offWindowPicks,
    skipped: false,
  };
}

/** 该期的成本(基本/追加/倍数) */
export function buildCost(picks: number, additional = false, multiple = 1) {
  const perPick = PICK_COST + (additional ? ADDITIONAL_COST : 0);
  return { perPick, additional, multiple, total: picks * perPick * multiple };
}

// ============ v1.3 号码特征与拥挤度(归因基础,替代不可信的 params) ============

/**
 * 单组号码特征(纯函数,前后端共用)。
 * 只描述形态,不承诺提升中奖概率:任何一组号码对每个奖级的中奖概率完全相同。
 * 用途是(1)归因分析(2)拥挤度控制(降低中奖后与他人分摊的风险)。
 */
export function computePickFeatures(numbers: number[], prevDraw?: LottoDraw | null): PickFeatures {
  const front = [...numbers.slice(0, 5)].sort((a, b) => a - b);
  const back = numbers.slice(5, 7);
  const sum = front.reduce((a, b) => a + b, 0);
  const range = front[front.length - 1] - front[0];
  const oddCount = front.filter(n => n % 2 === 1).length;
  let consecutivePairs = 0;
  for (let i = 1; i < front.length; i++) if (front[i] - front[i - 1] === 1) consecutivePairs++;
  let tailRepeat = 0;
  for (let i = 0; i < front.length; i++)
    for (let j = i + 1; j < front.length; j++) if (front[i] % 10 === front[j] % 10) tailRepeat++;
  const birthdayCount = front.filter(n => n <= 31).length;
  const bigCount = front.filter(n => n >= 32).length;

  // 拥挤度 0~100:越高越像"人群会选的号"
  //   生日号(≤31)密集 +25 / 连号 +20 / 同尾 +15 / 和值落在 80~100 主流区 +25 / 全小号无大号 +15
  let crowding = 0;
  if (birthdayCount >= 5) crowding += 25;
  else if (birthdayCount === 4) crowding += 15;
  else if (birthdayCount === 3) crowding += 5;
  if (consecutivePairs >= 2) crowding += 20;
  else if (consecutivePairs === 1) crowding += 10;
  if (tailRepeat >= 2) crowding += 15;
  else if (tailRepeat === 1) crowding += 8;
  if (sum >= 80 && sum <= 100) crowding += 25;
  else if (sum >= 70 && sum < 80) crowding += 12;
  if (bigCount === 0) crowding += 15;
  // 与上期重号(很多人"杀掉上期号"或"复制上期号",两种都拥挤)
  if (prevDraw) {
    const repeat = front.filter(n => prevDraw.front.includes(n)).length;
    if (repeat >= 2) crowding += 10;
  }
  const backOdd = back.filter(n => n % 2 === 1).length;
  if (backOdd === 1) crowding += 2; // 后区 1 奇 1 偶是最主流形态
  return {
    sum, range, oddCount, consecutivePairs,
    birthdayCount, bigCount, tailRepeat,
    crowdingScore: Math.min(100, crowding),
  };
}

/** 号码是否符合"建议参数"(v1.3:params 只是建议,这里显式判定,避免记录口径与实际号码不一致) */
export function isParamsCompliant(numbers: number[], params: GuessParams): boolean {
  const f = computePickFeatures(numbers);
  if (params.sumMin || params.sumMax) {
    if (f.sum < params.sumMin || f.sum > params.sumMax) return false;
  }
  if (params.rangeMin || params.rangeMax) {
    if (f.range < params.rangeMin || f.range > params.rangeMax) return false;
  }
  if (params.odd.length && !params.odd.includes(f.oddCount)) return false;
  if (params.consecutive.length && !params.consecutive.includes(f.consecutivePairs)) return false;
  return true;
}

// ============ v1.3 期望值模型(前端展示"理论 vs 实测",全部为可复算口径) ============

/**
 * 单注期望奖金(元):概率 × 当期官方单注奖金;固定奖缺失时按升档/默认档兜底。
 * 缺一/二等奖官方值时用默认档估(500万 / 8.7万 量级)并保持保守。
 */
export function expectedPrizePerPick(draw?: LottoDraw | null, opts: { additional?: boolean } = {}): number {
  const upgraded = !!draw && ((draw.poolAfter ?? 0) >= UPGRADE_POOL_THRESHOLD || (draw.prize7 ?? 0) >= PRIZE_AMOUNTS_UPGRADED['7']);
  const fixed = (tier: string): number => {
    const official = draw ? (draw[`prize${tier}` as 'prize3'] as number | undefined) : undefined;
    if (official && official > 0) return official;
    return upgraded ? PRIZE_AMOUNTS_UPGRADED[tier] : PRIZE_AMOUNTS[tier];
  };
  let ev = 0;
  // 浮动奖:默认按 500 万 / 8.7 万估(无官方值时)
  const p1 = (draw?.prize1 ?? 0) > 0 ? (draw!.prize1 as number) : 5_000_000;
  const p2 = (draw?.prize2 ?? 0) > 0 ? (draw!.prize2 as number) : 87_000;
  ev += TIER_PROBABILITY['1'] * p1 + TIER_PROBABILITY['2'] * p2;
  for (const t of ['3', '4', '5', '6', '7']) ev += TIER_PROBABILITY[t] * fixed(t);
  if (opts.additional) {
    // 追加投注仅参与浮动奖,单注奖金为基本投注的 80%
    ev += 0.8 * (TIER_PROBABILITY['1'] * p1 + TIER_PROBABILITY['2'] * p2);
  }
  return ev;
}

/** 每元投入的期望返还率(0~1):期望奖金 / 单注成本 */
export function expectedReturnRate(draw?: LottoDraw | null, opts: { additional?: boolean } = {}): number {
  const perPick = PICK_COST + (opts.additional ? ADDITIONAL_COST : 0);
  return expectedPrizePerPick(draw, opts) / perPick;
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
