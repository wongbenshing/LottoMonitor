import React from 'react';

// 大乐透奖级(2026 新规 7 档,第26014期起;旧规 26013 期止) - v1.2.5
export const PRIZE_TIERS = [
  { tier: '1', name: '一等奖', condition: '5+2' },
  { tier: '2', name: '二等奖', condition: '5+1' },
  { tier: '3', name: '三等奖', condition: '5+0/4+2' },
  { tier: '4', name: '四等奖', condition: '4+1' },
  { tier: '5', name: '五等奖', condition: '4+0/3+2' },
  { tier: '6', name: '六等奖', condition: '3+1/2+2' },
  { tier: '7', name: '七等奖', condition: '3+0/2+1/1+2/0+2' },
];

// v1.2.5 竞猜:固定奖默认金额表(新规低档兜底;实际金额以官方当期数据 draw.prize3..7 为准,随奖池≥8亿升档)
export const PRIZE_AMOUNTS: Record<string, number> = {
  '3': 5000, '4': 300, '5': 150, '6': 15, '7': 5,
};
export const PICK_COST = 2;   // 竞猜一条成本 2 元

// ============ v1.3 奖池闸门与期望值口径(官方规则 + 历史实测) ============

/** 追加投注每注加价(仅参与浮动奖:一/二等奖多得基本奖金的 80%) */
export const ADDITIONAL_COST = 1;

/** 奖池升档阈值:奖池 ≥8 亿 → **下期**三至七等奖单注奖金升档(财综〔2025〕51 号) */
export const UPGRADE_POOL_THRESHOLD = 800_000_000;

/** 升档期的三至七等奖单注奖金(与 PRIZE_AMOUNTS 对应:5000/300/150/15/5 → 升档档) */
export const PRIZE_AMOUNTS_UPGRADED: Record<string, number> = {
  '3': 6666, '4': 380, '5': 200, '6': 18, '7': 7,
};

/** 总组合数 C(35,5)×C(12,2) = 324632×66 */
export const TOTAL_COMBINATIONS = 21_425_712;

/** 单注各奖级中奖概率(13 个中奖条件合并为 7 奖级后的组合数比例) */
export const TIER_PROBABILITY: Record<string, number> = {
  '1': 1 / 21_425_712,
  '2': 20 / 21_425_712,
  '3': 195 / 21_425_712,
  '4': 3000 / 21_425_712,
  '5': 11_100 / 21_425_712,
  '6': 127_600 / 21_425_712,
  '7': 1_287_281 / 21_425_712,
};

/** 合计中奖率(约 6.67%) */
export const TOTAL_WIN_PROBABILITY = 1_429_197 / 21_425_712;

/**
 * 每元投入的期望返还率(用 history.csv 新规 121 期完整官方奖金实测:概率 × 当期单注奖金):
 *  - 非升档期 81 期 52.1% / 升档期 40 期 63.9% / 整体 56.0%
 * 升档窗口占新规期的 33%(40/121),窗口内每元期望相对提升 22.6%。
 * 制度上限约 51%~56%(销售额 51% 计提奖金),即长期期望为负,ROI 不可能转正。
 */
export const EXPECTED_RETURN_RATE = {
  nonUpgrade: 0.521,
  upgrade: 0.639,
  overall: 0.56,
};

/** 升档窗口在新规期中的占比(40/121),用于估算年度注数预算 */
export const UPGRADE_WINDOW_RATIO = 40 / 121;

/** 六/七等奖(5~18 元档)的理论返还率:非升档档位 19.5% / 升档档位 26.4% */
export const SMALL_TIER_THEORY_RETURN_RATE = 0.195;


// Mock initial data to ensure the app works immediately
export const INITIAL_DATA = [
  { id: "24025", date: "2024-03-04", front: [1, 5, 10, 20, 30], back: [2, 11] },
  { id: "24024", date: "2024-03-02", front: [3, 8, 15, 24, 33], back: [6, 7] },
  { id: "24023", date: "2024-02-28", front: [2, 11, 19, 26, 35], back: [3, 10] },
  { id: "24022", date: "2024-02-26", front: [7, 13, 22, 29, 31], back: [1, 8] },
  { id: "24021", date: "2024-02-24", front: [4, 9, 16, 25, 34], back: [5, 12] },
];
