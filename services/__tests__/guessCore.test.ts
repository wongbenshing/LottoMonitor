import { describe, it, expect } from 'vitest';
import { checkPrize } from '../../utils';
import {
  nextOpenDate,
  nextPeriodId,
  verifyRecord,
  computeGuessStats,
  addPick,
  removePick,
  currentOpenDate,
  DRAW_CUTOFF_MINUTES,
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

  it('v1.2.4 奖级修正: 2+1=九等奖5元(曾误判七等奖100), 3+1=八等奖15, 4+0=七等奖100, 4+1=五等奖300', () => {
    // 开奖 3,11,15,22,31 + 5,9
    // 2+1 → 九等奖 5 元(用户报告案例: 前区中2 后区中1)
    expect(checkPrize([3, 11, 40, 41, 42], [5, 2], draw)).toBe('9');
    // 3+1 → 八等奖 15 元
    expect(checkPrize([3, 11, 15, 40, 41], [5, 2], draw)).toBe('8');
    // 2+2 → 八等奖 15 元
    expect(checkPrize([3, 11, 40, 41, 42], [5, 9], draw)).toBe('8');
    // 4+0 → 七等奖 100 元
    expect(checkPrize([3, 11, 15, 22, 40], [1, 2], draw)).toBe('7');
    // 3+2 → 六等奖 200 元
    expect(checkPrize([3, 11, 15, 40, 41], [5, 9], draw)).toBe('6');
    // 4+1 → 五等奖 300 元
    expect(checkPrize([3, 11, 15, 22, 40], [5, 2], draw)).toBe('5');
    // 4+2 → 四等奖 3000 元
    expect(checkPrize([3, 11, 15, 22, 40], [5, 9], draw)).toBe('4');
    // 5+0 → 三等奖 10000 元
    expect(checkPrize([3, 11, 15, 22, 31], [1, 2], draw)).toBe('3');
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
