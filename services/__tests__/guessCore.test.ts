import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { checkPrize } from '../../utils';
import {
  nextOpenDate,
  nextPeriodId,
  verifyRecord,
  computeGuessStats,
  addPick,
  removePick,
  currentOpenDate,
  isDrawDay,
  resolveDailyTarget,
  isMarketClosed,
  isUpgradeWindow,
  upgradeGap,
  buildGate,
  buildCost,
  latestDraw,
  computePickFeatures,
  isParamsCompliant,
  expectedPrizePerPick,
  expectedReturnRate,
  periodCost,
  DRAW_CUTOFF_MINUTES,
} from '../guessCore';
import { parseCSV } from '../lottoService';
import { UPGRADE_POOL_THRESHOLD } from '../../constants';
import type { GuessRecord, LottoDraw } from '../../types';

const EMPTY_PARAMS = {
  sumMin: 71, sumMax: 110, rangeMin: 18, rangeMax: 28,
  consecutive: [1], frontRepeat: [1], backRepeat: [1], odd: [3],
};

function mkRec(targetDate: string, picks: number[][], status: GuessRecord['status'] = 'pending'): GuessRecord {
  return { targetDate, periodId: '26098', picks, params: EMPTY_PARAMS, createdAt: '', status };
}

describe('nextOpenDate', () => {
  it('周四→周六、周五→周六、周日→下周一、周一→周三(2026-08-26 为周三,与 history.csv 26097 期吻合)', () => {
    expect(nextOpenDate(new Date('2026-08-27T10:00:00'))).toBe('2026-08-29'); // 周四→周六
    expect(nextOpenDate(new Date('2026-08-28T10:00:00'))).toBe('2026-08-29'); // 周五→周六
    expect(nextOpenDate(new Date('2026-08-30T10:00:00'))).toBe('2026-08-31'); // 周日→周一
    expect(nextOpenDate(new Date('2026-08-31T10:00:00'))).toBe('2026-09-02'); // 周一→周三
  });
});

describe('currentOpenDate(开奖日当天手动加入的目标期)', () => {
  it('开奖日 21:25 前 → 今天(2026-08-31 周一下午 → 08-31)', () => {
    expect(currentOpenDate(new Date('2026-08-31T16:00:00'))).toBe('2026-08-31');
    expect(currentOpenDate(new Date('2026-08-29T20:00:00'))).toBe('2026-08-29'); // 周六
  });
  it('开奖日 21:25 及之后 → 下一开奖日(周一晚 22:00 → 周三)', () => {
    expect(currentOpenDate(new Date('2026-08-31T21:25:00'))).toBe('2026-09-02');
    expect(currentOpenDate(new Date('2026-08-31T22:00:00'))).toBe('2026-09-02');
  });
  it('非开奖日 → 下一开奖日(周二 → 周三)', () => {
    expect(currentOpenDate(new Date('2026-09-01T12:00:00'))).toBe('2026-09-02');
  });
  it('常量 21:25', () => {
    expect(DRAW_CUTOFF_MINUTES).toBe(21 * 60 + 25);
  });
});

describe('isDrawDay / resolveDailyTarget(每日 10:00 生成规则:只有非开奖日才生成下一期)', () => {
  it('开奖日 = 周一(9/14)/周三(9/16)/周六(9/12);周二、周四、周五、周日不是', () => {
    for (const d of ['2026-09-14', '2026-09-16', '2026-09-12']) {
      expect(isDrawDay(new Date(`${d}T10:00:00`))).toBe(true);
    }
    for (const d of ['2026-09-13', '2026-09-15', '2026-09-17', '2026-09-18']) {
      expect(isDrawDay(new Date(`${d}T10:00:00`))).toBe(false);
    }
  });

  it('非开奖日 → 生成下一开奖日(周日→周一 / 周二→周三 / 周四→周六)', () => {
    expect(resolveDailyTarget(new Date('2026-09-13T10:00:00'), [])).toBe('2026-09-14');
    expect(resolveDailyTarget(new Date('2026-09-15T10:00:00'), [])).toBe('2026-09-16');
    expect(resolveDailyTarget(new Date('2026-09-17T10:00:00'), [])).toBe('2026-09-19');
  });

  it('开奖日 → 不生成(当天 10:00 生成的"下一期"必然漏掉当晚那一期)', () => {
    expect(resolveDailyTarget(new Date('2026-09-14T10:00:00'), [])).toBeNull();
    expect(resolveDailyTarget(new Date('2026-09-16T10:00:00'), [])).toBeNull();
    expect(resolveDailyTarget(new Date('2026-09-12T10:00:00'), [])).toBeNull();
  });

  it('下期已有序列 → 不生成(周五跳过只因周四已生成;周四漏跑时周五兜底)', () => {
    expect(resolveDailyTarget(new Date('2026-09-18T10:00:00'), ['2026-09-19'])).toBeNull();
    expect(resolveDailyTarget(new Date('2026-09-18T10:00:00'), [])).toBe('2026-09-19');
  });

  it('回归:输入必须覆盖目标期前最近一次开奖 —— 目标 9/16 只能在 9/15 生成(不能在 9/14 开奖日早上)', () => {
    expect(resolveDailyTarget(new Date('2026-09-12T10:00:00'), ['2026-09-12'])).toBeNull(); // 周六,漏 9/12 那期
    expect(resolveDailyTarget(new Date('2026-09-13T10:00:00'), ['2026-09-12'])).toBe('2026-09-14');
    expect(resolveDailyTarget(new Date('2026-09-14T10:00:00'), ['2026-09-14'])).toBeNull(); // 周一,漏 9/14 那期
    expect(resolveDailyTarget(new Date('2026-09-15T10:00:00'), ['2026-09-14'])).toBe('2026-09-16');
  });
});

describe('nextPeriodId', () => {
  it('26097→26098; 26156→27001(跨年进位); 9073→9074(4位兼容)', () => {
    expect(nextPeriodId('26097')).toBe('26098');
    expect(nextPeriodId('26156')).toBe('27001');
    expect(nextPeriodId('9073')).toBe('9074');
  });
});

describe('verifyRecord', () => {
  const draw: LottoDraw = {
    id: '26098', date: '2026-08-29',
    front: [3, 11, 15, 22, 31], back: [5, 9],
    prize1: 6840926, prize2: 84016,
  };

  it('5+2 中一等奖(取真实 prize1)、未中 0', () => {
    const rec = mkRec('2026-08-29', [
      [3, 11, 15, 22, 31, 5, 9],   // 5+2 → 一等奖
      [1, 2, 3, 4, 5, 6, 7],       // 未中
      [8, 9, 10, 11, 12, 1, 2],    // 前区匹配 11 → 1个, 后区0 → 无奖
    ]);
    const v = verifyRecord(rec, draw);
    expect(v.status).toBe('verified');
    expect(v.drawId).toBe('26098');
    expect(v.results![0].tier).toBe('1');
    expect(v.results![0].amount).toBe(6840926); // 真实浮动奖
    expect(v.results![1].tier).toBeNull();
    expect(v.results![1].amount).toBe(0);
    expect(v.totalPrize).toBe(6840926);
  });

  it('5+0 中三等奖(2026新规默认 5000;旧规应为 10000)', () => {
    const rec = mkRec('2026-08-29', [[3, 11, 15, 22, 31, 1, 2]]); // 5前 + 0后
    const v = verifyRecord(rec, draw);
    expect(v.results![0].tier).toBe('3');
    expect(v.results![0].amount).toBe(5000); // 新规低档兜底(官方未提供 p3 时)
    expect(v.totalPrize).toBe(5000);
    // 旧规期(24001): 5+0 → 三等 10000
    const oldDraw: LottoDraw = { id: '24001', date: '2024-01-01', front: [3, 11, 15, 22, 31], back: [5, 9] };
    const v2 = verifyRecord(mkRec('2024-01-01', [[3, 11, 15, 22, 31, 1, 2]]), oldDraw);
    expect(v2.results![0].amount).toBe(10000);
  });

  it('v1.2.5 2026新规七奖级(26098期): 2+1=七等, 3+1/2+2=六等, 4+0/3+2=五等, 4+1=四等, 4+2/5+0=三等', () => {
    // 开奖 3,11,15,22,31 + 5,9 (新规期)
    expect(checkPrize([3, 11, 40, 41, 42], [5, 2], draw)).toBe('7');   // 2+1
    expect(checkPrize([3, 11, 15, 40, 41], [5, 2], draw)).toBe('6');   // 3+1
    expect(checkPrize([3, 11, 40, 41, 42], [5, 9], draw)).toBe('6');   // 2+2
    expect(checkPrize([3, 11, 15, 22, 40], [1, 2], draw)).toBe('5');   // 4+0
    expect(checkPrize([3, 11, 15, 40, 41], [5, 9], draw)).toBe('5');   // 3+2
    expect(checkPrize([3, 11, 15, 22, 40], [5, 2], draw)).toBe('4');   // 4+1
    expect(checkPrize([3, 11, 15, 22, 40], [5, 9], draw)).toBe('3');   // 4+2
    expect(checkPrize([3, 11, 15, 22, 31], [1, 2], draw)).toBe('3');   // 5+0
    // 旧规期(24001): 同样条件映射到 9 级
    const oldDraw: LottoDraw = { id: '24001', date: '2024-01-01', front: [3, 11, 15, 22, 31], back: [5, 9] };
    expect(checkPrize([3, 11, 40, 41, 42], [5, 2], oldDraw)).toBe('9');  // 2+1 旧=九等
    expect(checkPrize([3, 11, 15, 22, 40], [1, 2], oldDraw)).toBe('7');  // 4+0 旧=七等
    expect(checkPrize([3, 11, 15, 22, 40], [5, 9], oldDraw)).toBe('4');  // 4+2 旧=四等
  });

  it('官方当期固定奖金额优先(draw.prize3..7,奖池≥8亿高档期如 6666/380/200/18/7)', () => {
    const highDraw: LottoDraw = { ...draw, id: '26100', date: '2026-09-02', prize3: 6666, prize4: 380, prize5: 200, prize6: 18, prize7: 7 };
    const rec = mkRec('2026-09-02', [
      [3, 11, 15, 22, 31, 1, 2],  // 5+0 三等 → 6666
      [3, 11, 40, 41, 42, 5, 2],  // 2+1 七等 → 7
    ]);
    const v = verifyRecord(rec, highDraw);
    expect(v.results![0].tier).toBe('3');
    expect(v.results![0].amount).toBe(6666);
    expect(v.results![1].tier).toBe('7');
    expect(v.results![1].amount).toBe(7);
  });

  it('开奖无奖金数据(旧CSV)时一等奖按0计,不报错', () => {
    const oldDraw: LottoDraw = { id: '24001', date: '2024-01-01', front: [1, 2, 3, 4, 5], back: [6, 7] };
    const rec = mkRec('2024-01-01', [[1, 2, 3, 4, 5, 6, 7]]);
    const v = verifyRecord(rec, oldDraw);
    expect(v.results![0].tier).toBe('1');
    expect(v.results![0].amount).toBe(0); // 无 prize1 → 0
  });

  it('验证时 periodId 回填为真实开奖期号(draw.id)', () => {
    const rec = mkRec('2026-08-31', [[3, 11, 15, 22, 31, 5, 9]]); // periodId 占位 26098
    const v = verifyRecord(rec, { ...draw, id: '26099', date: '2026-08-31' });
    expect(v.periodId).toBe('26099');
  });
});

describe('computeGuessStats', () => {
  it('2期×2条,其中1条中奖 → 成功率25%,winDays=1,成本=4×2=8,ROI=(200-8)/8', () => {
    const recA: GuessRecord = {
      ...mkRec('2026-08-29', [[1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 1, 2]]),
      status: 'verified', drawId: '26098',
      results: [
        { pickIndex: 0, numbers: [1, 2, 3, 4, 5, 6, 7], tier: '6', amount: 200 },
        { pickIndex: 1, numbers: [8, 9, 10, 11, 12, 1, 2], tier: null, amount: 0 },
      ],
      totalPrize: 200,
    };
    const recB: GuessRecord = {
      ...mkRec('2026-08-26', [[1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 1, 2]]),
      status: 'verified', drawId: '26097',
      results: [
        { pickIndex: 0, numbers: [1, 2, 3, 4, 5, 6, 7], tier: null, amount: 0 },
        { pickIndex: 1, numbers: [8, 9, 10, 11, 12, 1, 2], tier: null, amount: 0 },
      ],
      totalPrize: 0,
    };
    const stats = computeGuessStats([recA, recB]);
    expect(stats.totalPeriods).toBe(2);
    expect(stats.totalPicks).toBe(4);
    expect(stats.winningPicks).toBe(1);
    expect(stats.pickSuccessRate).toBe(0.25);
    expect(stats.winDays).toBe(1);
    expect(stats.totalCost).toBe(8);
    expect(stats.totalPrize).toBe(200);
    expect(stats.roi).toBe(24);
  });

  it('无已验证记录 → 全 0 不报错', () => {
    const stats = computeGuessStats([mkRec('2026-08-29', [[1, 2, 3, 4, 5, 6, 7]])]);
    expect(stats.totalPicks).toBe(0);
    expect(stats.roi).toBe(0);
  });
});

describe('addPick', () => {
  it('目标期无记录时创建新记录(pickIndex=0)', () => {
    const { records, pickIndex, alreadyExists } = addPick([], '2026-08-29', [1, 9, 22, 24, 27, 4, 8], EMPTY_PARAMS);
    expect(pickIndex).toBe(0);
    expect(alreadyExists).toBe(false);
    expect(records).toHaveLength(1);
    expect(records[0].targetDate).toBe('2026-08-29');
    expect(records[0].status).toBe('pending');
    expect(records[0].picks).toEqual([[1, 9, 22, 24, 27, 4, 8]]);
  });

  it('已有 2 条记录时追加第 3 条(pickIndex=2);重复组 alreadyExists=true 不写入', () => {
    const base = mkRec('2026-08-29', [[1, 9, 22, 24, 27, 4, 8], [1, 14, 21, 23, 28, 5, 11]]);
    const r1 = addPick([base], '2026-08-29', [3, 11, 15, 22, 31, 5, 9], EMPTY_PARAMS);
    expect(r1.pickIndex).toBe(2);
    expect(r1.alreadyExists).toBe(false);
    expect(r1.records[0].picks).toHaveLength(3);
    const r2 = addPick(r1.records, '2026-08-29', [1, 9, 22, 24, 27, 4, 8], EMPTY_PARAMS);
    expect(r2.alreadyExists).toBe(true);
    expect(r2.pickIndex).toBe(-1);
    expect(r2.records[0].picks).toHaveLength(3);
  });

  it('verified 期抛错(调用方映射 409)', () => {
    const verified = { ...mkRec('2026-08-26', [[1, 2, 3, 4, 5, 6, 7]]), status: 'verified' as const, drawId: '26097' };
    expect(() => addPick([verified], '2026-08-26', [3, 11, 15, 22, 31, 5, 9], EMPTY_PARAMS)).toThrow('已开奖');
  });
});

describe('removePick', () => {
  it('移除中间一组后索引重排;移空则删整条记录', () => {
    const base = mkRec('2026-08-29', [[1, 9, 22, 24, 27, 4, 8], [1, 14, 21, 23, 28, 5, 11], [3, 11, 15, 22, 31, 5, 9]]);
    const r1 = removePick([base], '2026-08-29', 1);
    expect(r1.removed).toBe(true);
    expect(r1.records[0].picks).toEqual([[1, 9, 22, 24, 27, 4, 8], [3, 11, 15, 22, 31, 5, 9]]);
    const r2 = removePick(r1.records, '2026-08-29', 0);
    const r3 = removePick(r2.records, '2026-08-29', 0);
    expect(r3.removed).toBe(true);
    expect(r3.records).toHaveLength(0); // 移空 → 整条删除
  });

  it('verified 期抛错;越界 pickIndex 返回 removed=false;不存在的期 removed=false', () => {
    const verified = { ...mkRec('2026-08-26', [[1, 2, 3, 4, 5, 6, 7]]), status: 'verified' as const };
    expect(() => removePick([verified], '2026-08-26', 0)).toThrow('已开奖');
    const base = mkRec('2026-08-29', [[1, 2, 3, 4, 5, 6, 7]]);
    expect(removePick([base], '2026-08-29', 5).removed).toBe(false);
    expect(removePick([base], '2026-09-01', 0).removed).toBe(false);
  });
});

describe('休市日(2026 国庆 10-01~10-04 大乐透不开奖)', () => {
  it('isMarketClosed 识别休市区间;10-05(周一)恢复开奖', () => {
    expect(isMarketClosed('2026-10-01')).toBe(true);
    expect(isMarketClosed('2026-10-03')).toBe(true);  // 周六却是休市日 → 2026-10-03 那期不存在
    expect(isMarketClosed('2026-10-04')).toBe(true);
    expect(isMarketClosed('2026-10-05')).toBe(false);
    expect(isMarketClosed('2026-10-07')).toBe(false);
  });

  it('isDrawDay:休市日即使是周六也不算开奖日', () => {
    expect(isDrawDay(new Date('2026-10-03T10:00:00'))).toBe(false); // 周六 + 休市
    expect(isDrawDay(new Date('2026-10-05T10:00:00'))).toBe(true);  // 周一,恢复开奖
    expect(isDrawDay(new Date('2026-10-01T10:00:00'))).toBe(false); // 周四本就非开奖日
  });

  it('nextOpenDate 跳过休市日:10-02 → 10-05(而不是 10-03)', () => {
    expect(nextOpenDate(new Date('2026-10-02T10:00:00'))).toBe('2026-10-05');
    expect(nextOpenDate(new Date('2026-10-01T10:00:00'))).toBe('2026-10-05');
    expect(nextOpenDate(new Date('2026-10-04T10:00:00'))).toBe('2026-10-05');
  });

  it('currentOpenDate:休市当天不返回今天(10-03 16:00 → 10-05)', () => {
    expect(currentOpenDate(new Date('2026-10-03T16:00:00'))).toBe('2026-10-05');
  });

  it('resolveDailyTarget:休市日(10-02 周五)生成 10-05 那期 —— 不会再生成不存在的 10-03', () => {
    expect(resolveDailyTarget(new Date('2026-10-02T10:00:00'), [])).toBe('2026-10-05');
    expect(resolveDailyTarget(new Date('2026-10-02T10:00:00'), ['2026-10-05'])).toBeNull(); // 已有则跳过
  });

  it('休市记录只能被作废(status=failed),绝不能被当成已开奖(它永远等不到 history 数据)', () => {
    // 该期在 history.csv 中不存在 → verifyPending 走 isMarketClosed 分支标记 failed;
    // 作废记录不计入 computeGuessStats(只统计 verified)
    const closed = { ...mkRec('2026-10-03', [[7, 17, 21, 30, 32, 6, 12]]), status: 'failed' as const };
    const stats = computeGuessStats([closed]);
    expect(stats.totalPicks).toBe(0);
    expect(stats.totalCost).toBe(0);
    // failed 期不阻挡「最早 pending」选取(前端目标开奖日据此选取)
    const pending = mkRec('2026-10-17', [[1, 2, 3, 4, 5, 6, 7]]);
    const nextRec = [closed, pending].filter(r => r.status === 'pending')
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
    expect(nextRec.targetDate).toBe('2026-10-17');
  });
});

// ============ v1.3 奖池升档闸门 ============

const mkDraw = (date: string, poolAfter?: number, extra: Partial<LottoDraw> = {}): LottoDraw => ({
  id: '26134', date, front: [4, 15, 17, 24, 31], back: [6, 9], poolAfter, ...extra,
});

describe('v1.3 奖池升档闸门(上期奖池 ≥8 亿 → 本期三至七等奖升档)', () => {
  it('真实数据:26106 期 8.27 亿 → 窗口;26134 期 7.583 亿 → 非窗口', () => {
    expect(isUpgradeWindow([mkDraw('2026-09-16', 827_000_000)])).toBe(true);
    expect(isUpgradeWindow([mkDraw('2026-11-23', 758_257_386)])).toBe(false);
    // 无奖池数据 → 保守判为非窗口
    expect(isUpgradeWindow([mkDraw('2026-11-23')])).toBe(false);
    expect(isUpgradeWindow([])).toBe(false);
  });

  it('latestDraw 不依赖数组顺序(倒序/正序都取最新)', () => {
    const desc = [mkDraw('2026-11-23', 7.58e8), mkDraw('2026-11-21', 7.67e8)];
    const asc = [...desc].reverse();
    expect(latestDraw(desc)!.date).toBe('2026-11-23');
    expect(latestDraw(asc)!.date).toBe('2026-11-23');
  });

  it('upgradeGap:7.583 亿 → 差 4174 万;已升档 → 0', () => {
    expect(upgradeGap([mkDraw('2026-11-23', 758_257_386)])).toBe(41_742_614);
    expect(upgradeGap([mkDraw('2026-09-16', 827_000_000)])).toBe(0);
    expect(upgradeGap([mkDraw('2026-11-23')])).toBeUndefined();
  });

  it('buildGate:窗口期建议 2 组,非窗口期建议 1 组(软建议,skipped=false 不硬拦)', () => {
    const inWindow = buildGate([mkDraw('2026-09-16', 827_000_000)]);
    expect(inWindow.upgradeWindow).toBe(true);
    expect(inWindow.suggestedPicks).toBe(2);
    expect(inWindow.skipped).toBe(false);

    const off = buildGate([mkDraw('2026-11-23', 758_257_386)], { offWindowPicks: 1 });
    expect(off.upgradeWindow).toBe(false);
    expect(off.suggestedPicks).toBe(1);
    expect(off.poolAfter).toBe(758_257_386);
    expect(off.gapToUpgrade).toBe(41_742_614);
  });

  it('历史回放(history.csv 新规期):用上期奖池 ≥8 亿 预测本期升档,命中率 ≥98%', () => {
    if (!existsSync('history.csv')) return; // 无数据文件时跳过(CI/部署环境)
    const draws = parseCSV(readFileSync('history.csv', 'utf8'))
      .filter(d => parseInt(d.id) >= 26014 || d.date >= '2026-02-02')
      .sort((a, b) => a.date.localeCompare(b.date));
    expect(draws.length).toBeGreaterThan(100);
    let ok = 0, total = 0;
    for (let i = 1; i < draws.length; i++) {
      const prev = draws[i - 1], cur = draws[i];
      if (!prev.poolAfter || !cur.prize7) continue; // 缺数据期不参与统计
      const upgradeNow = cur.prize7 >= 7; // 升档期七等奖 7 元
      const predicted = prev.poolAfter >= UPGRADE_POOL_THRESHOLD;
      total++;
      if (predicted === upgradeNow) ok++;
    }
    expect(total).toBeGreaterThan(100);
    expect(ok / total).toBeGreaterThan(0.98);
  });
});

// ============ v1.3 号码特征 / 拥挤度 / 建议参数合规 ============

describe('v1.3 号码特征与拥挤度', () => {
  it('computePickFeatures:和值/极差/奇偶/连号/同尾/生日号/大号', () => {
    const f = computePickFeatures([7, 10, 14, 19, 35, 2, 10]);
    expect(f.sum).toBe(85);
    expect(f.range).toBe(28);
    expect(f.oddCount).toBe(3);
    expect(f.consecutivePairs).toBe(0);
    expect(f.birthdayCount).toBe(4);   // 7,10,14,19 ≤31
    expect(f.bigCount).toBe(1);        // 35
    expect(f.tailRepeat).toBe(0);

    const g = computePickFeatures([12, 22, 23, 32, 33, 5, 7]);
    expect(g.consecutivePairs).toBe(2); // 22-23, 32-33
    expect(g.tailRepeat).toBe(4);       // 尾数2:12/22/32 三对 + 尾数3:23/33 一对 = 4
    expect(g.bigCount).toBe(2);
  });

  it('拥挤度:生日号密集 + 连号 + 中位和值 明显高于 冷门形态', () => {
    const crowded = computePickFeatures([1, 2, 3, 20, 25, 3, 7]);   // 全生日号 + 两对连号 + 和值 51
    const cold = computePickFeatures([8, 16, 24, 32, 35, 4, 11]);   // 含大号、无连号、和值 115
    expect(crowded.crowdingScore).toBeGreaterThan(cold.crowdingScore);
    expect(cold.crowdingScore).toBeLessThanOrEqual(100);
  });

  it('isParamsCompliant:和值/极差越界 → false;全空参数 → true(手动加入的组不受限)', () => {
    const params = { ...EMPTY_PARAMS, sumMin: 83, sumMax: 90, rangeMin: 26, rangeMax: 28, odd: [3], consecutive: [0] };
    expect(isParamsCompliant([7, 10, 14, 19, 35, 2, 10], params)).toBe(true);  // 和值85 极差28 奇3 无连号
    expect(isParamsCompliant([1, 2, 3, 20, 25, 3, 7], params)).toBe(false);    // 和值51 越界
    const empty = { sumMin: 0, sumMax: 0, rangeMin: 0, rangeMax: 0, consecutive: [], frontRepeat: [], backRepeat: [], odd: [] };
    expect(isParamsCompliant([1, 2, 3, 20, 25, 3, 7], empty)).toBe(true);
  });

  it('buildCost:基本 2 元/追加 3 元,倍数可乘', () => {
    expect(buildCost(2)).toEqual({ perPick: 2, additional: false, multiple: 1, total: 4 });
    expect(buildCost(2, true)).toEqual({ perPick: 3, additional: true, multiple: 1, total: 6 });
    expect(buildCost(2, false, 3).total).toBe(12);
  });
});

// ============ v1.3 验证记录的数据快照 / 缺字段告警 / 分层统计 ============

describe('v1.3 verifyRecord 数据完整性与金额来源', () => {
  const normalDraw = mkDraw('2026-11-23', 758_257_386, {
    prize1: 6_208_303, prize2: 24_835,
    prize3: 5000, prize4: 300, prize5: 150, prize6: 15, prize7: 5,
  });

  it('七等奖走官方当期值,amountSource=official,数据完整', () => {
    const rec = verifyRecord(mkRec('2026-11-23', [[4, 15, 40, 41, 42, 6, 3]]), normalDraw);
    expect(rec.results![0].tier).toBe('7');
    expect(rec.results![0].amount).toBe(5);
    expect(rec.results![0].amountSource).toBe('official');
    expect(rec.dataIncomplete).toBe(false);
    expect(rec.drawSnapshot!.isUpgradeWindow).toBe(false);
    expect(rec.drawSnapshot!.poolAfter).toBe(758_257_386);
  });

  it('固定奖字段缺失 → 标 dataIncomplete,升档期按升档默认档 7 元(不是 5 元)', () => {
    const upgradedNoPrize = mkDraw('2026-09-16', 827_000_000, { prize1: 9_000_000, prize2: 180_000 });
    const rec = verifyRecord(mkRec('2026-09-16', [[4, 15, 40, 41, 42, 6, 3]]), upgradedNoPrize);
    expect(rec.results![0].amount).toBe(7);                  // 升档默认档
    expect(rec.results![0].amountSource).toBe('upgraded-default');
    expect(rec.dataIncomplete).toBe(true);
    expect(rec.drawSnapshot!.dataIncomplete).toBe(true);
  });

  it('浮动奖缺官方值 → amountSource=missing(不编造金额),并标数据不完整', () => {
    const noFloat = mkDraw('2026-11-23', 758_257_386, {
      prize3: 5000, prize4: 300, prize5: 150, prize6: 15, prize7: 5,
    });
    const rec = verifyRecord(mkRec('2026-11-23', [[4, 15, 17, 24, 31, 6, 9]]), noFloat); // 5+2 一等奖
    expect(rec.results![0].tier).toBe('1');
    expect(rec.results![0].amount).toBe(0);
    expect(rec.results![0].amountSource).toBe('missing');
    expect(rec.dataIncomplete).toBe(true);
  });
});

describe('v1.3 computeGuessStats 分层口径', () => {
  const drawA = mkDraw('2026-11-23', 758_257_386, {
    prize1: 6_208_303, prize2: 24_835, prize3: 5000, prize4: 300, prize5: 150, prize6: 15, prize7: 5,
  });

  it('小奖(六/七等)与长尾(一~五等)分开统计,小奖返还率可对照理论 20.9%', () => {
    const small = verifyRecord(mkRec('2026-11-23', [[4, 15, 40, 41, 42, 6, 3]]), drawA);  // 七等 5 元
    const tail = verifyRecord(mkRec('2026-11-23', [[4, 15, 17, 24, 31, 1, 2]]), drawA);   // 5+0 三等 5000
    const miss = verifyRecord(mkRec('2026-11-23', [[1, 2, 3, 4, 5, 1, 2]]), drawA);        // 未中
    const stats = computeGuessStats([small, tail, miss]);
    expect(stats.totalPicks).toBe(3);
    expect(stats.smallTierPrize).toBe(5);
    expect(stats.longTailPrize).toBe(5000);
    expect(stats.totalPrize).toBe(5005);
    expect(stats.totalCost).toBe(6);              // 3 注 × 2 元
    expect(stats.smallTierReturnRate).toBeCloseTo(5 / 6, 5);
    expect(stats.longTailReturnRate).toBeCloseTo(5000 / 6, 5);
    expect(stats.netWinPeriods).toBe(2);          // 2 期回收 > 投入
  });

  it('cost 字段优先于 注数×2(追加/倍数口径),periodCost 同步', () => {
    const rec: GuessRecord = {
      ...verifyRecord(mkRec('2026-11-23', [[4, 15, 40, 41, 42, 6, 3]]), drawA),
      cost: buildCost(1, true, 2),  // 追加 + 2 倍 = 6 元
    };
    expect(periodCost(rec)).toBe(6);
    expect(computeGuessStats([rec]).totalCost).toBe(6);
  });

  it('升档窗口内外分别统计净盈亏(gate.upgradeWindow 优先,其次 drawSnapshot)', () => {
    const inWin = { ...verifyRecord(mkRec('2026-11-23', [[1, 2, 3, 4, 5, 1, 2]]), drawA),
      gate: buildGate([mkDraw('2026-09-16', 827_000_000)]) };
    const outWin = verifyRecord(mkRec('2026-11-23', [[4, 15, 40, 41, 42, 6, 3]]), drawA);
    const stats = computeGuessStats([inWin, outWin]);
    expect(stats.upgradePeriods).toBe(1);
    expect(stats.nonUpgradePeriods).toBe(1);
    expect(stats.upgradeNet).toBe(-2);      // 未中:0 - 2
    expect(stats.nonUpgradeNet).toBe(3);    // 中 5 元:5 - 2
  });
});

// ============ v1.3 期望值模型(理论口径,用于前端对照实测) ============

describe('v1.3 期望值模型', () => {
  // 参数取新规 121 期的分档官方均值(非升档 81 期 / 升档 40 期),用于复现实测返还率
  const normalDraw = mkDraw('2026-11-23', 758_257_386, {
    prize1: 7_715_712, prize2: 135_134, prize3: 5000, prize4: 300, prize5: 150, prize6: 15, prize7: 5,
  });
  const upgradeDraw = mkDraw('2026-09-16', 827_000_000, {
    prize1: 8_152_414, prize2: 162_955, prize3: 6666, prize4: 380, prize5: 200, prize6: 18, prize7: 7,
  });

  it('每元期望返还率:非升档约 52%、升档约 65%(与实测口径一致)', () => {
    // 实测(新规 121 期官方奖金):非升档 52.1%、升档 63.9%
    expect(expectedReturnRate(normalDraw)).toBeCloseTo(0.521, 2);
    expect(expectedReturnRate(upgradeDraw)).toBeCloseTo(0.639, 2);
    expect(expectedReturnRate(upgradeDraw)).toBeGreaterThan(expectedReturnRate(normalDraw));
  });

  it('追加投注(仅浮动奖加 80%)的每元返还率低于基本投注', () => {
    const additional = expectedReturnRate(normalDraw, { additional: true });
    expect(additional).toBeLessThan(expectedReturnRate(normalDraw));
    // 基本 2 元 vs 追加 3 元:期望奖金只多 80% 的浮动奖部分
    expect(expectedPrizePerPick(normalDraw, { additional: true }))
      .toBeGreaterThan(expectedPrizePerPick(normalDraw));
  });

  it('无开奖数据时用保守默认档仍给出合理量级(0.4~0.7)', () => {
    const rate = expectedReturnRate(null);
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.7);
  });
});
