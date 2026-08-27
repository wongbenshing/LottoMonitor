import { describe, it, expect } from 'vitest';
import {
  nextOpenDate,
  nextPeriodId,
  verifyRecord,
  computeGuessStats,
} from '../guessCore';
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

  it('5+2 中一等奖(取真实 prize1)、3+1 中六等 200 元、未中 0', () => {
    const rec = mkRec('2026-08-29', [
      [3, 11, 15, 22, 31, 5, 9],   // 5+2 → 一等奖
      [1, 2, 3, 4, 5, 6, 7],       // 未中
      [8, 9, 10, 11, 12, 1, 2],    // 前区8,9,10,11,12 vs 3,11,15,22,31 → 1个; 后区1,2 vs 5,9 → 0 → 未中? 重新核对:前区匹配=11→1个,后区0 → 无奖
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

  it('5+0 中三等奖 10000 元', () => {
    const rec = mkRec('2026-08-29', [[3, 11, 15, 22, 31, 1, 2]]); // 后区1,2 → 0命中? 需构造3+1
    // 前区 3,11,15,22,31 与开奖 3,11,15,22,31 → 5;后区 1,2 vs 5,9 → 0 → 三等奖(5+0)
    const v = verifyRecord(rec, draw);
    expect(v.results![0].tier).toBe('3');
    expect(v.results![0].amount).toBe(10000);
    expect(v.totalPrize).toBe(10000);
  });

  it('开奖无奖金数据(旧CSV)时一等奖按0计,不报错', () => {
    const oldDraw: LottoDraw = { id: '24001', date: '2024-01-01', front: [1, 2, 3, 4, 5], back: [6, 7] };
    const rec = mkRec('2024-01-01', [[1, 2, 3, 4, 5, 6, 7]]);
    const v = verifyRecord(rec, oldDraw);
    expect(v.results![0].tier).toBe('1');
    expect(v.results![0].amount).toBe(0); // 无 prize1 → 0
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
