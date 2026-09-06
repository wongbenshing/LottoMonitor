export interface LottoDraw {
  id: string; // 期号
  date: string; // 开奖日期
  front: number[]; // 前区 5个数字
  back: number[]; // 后区 2个数字
  prize1?: number;  // 一等奖单注奖金(元),0=未提供/无人中奖(v1.2 爬虫新增列)
  prize2?: number;  // 二等奖单注奖金(元),0=未提供/无人中奖
  poolAfter?: number; // 开奖后奖池滚存(官方数据,v1.2.5)
  prize3?: number; prize4?: number; prize5?: number; prize6?: number; prize7?: number; // 固定奖单注金额(官方当期实际值,v1.2.5;受奖池≥8亿分档影响)
}

export interface PrizeResult {
  tier: string;
  name: string;
  count: number;
  dates: string[];
}

export enum TabType {
  HISTORY = 'history',
  ANALYZER = 'analyzer',
  STATS = 'stats',
  AI = 'ai',
  WALKFORWARD = 'walkforward',
  GUESS = 'guess'
}

export interface AnalysisSummary {
  hotNumbers: number[];
  coldNumbers: number[];
  recommendations: number[][]; // 修改为支持多组推荐，每组为 7 个数字 (5前+2后)
  explanation: string;
}

export enum ViewMode {
  PORTAL = 'portal',
  LOTTO = 'lotto'
}

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  logo: string;
  color: string;
  path?: string;
}

/**
 * 智能预测结果
 * 用于和值、极差等指标的预测
 */
export interface PredictionResult {
  predictedValue: number;  // 预测值（单一数值）
  confidence: number;      // 置信度 0-100
  confidenceLevel: 'high' | 'medium' | 'low';  // 置信等级
  suggestedRange: {        // 建议区间
    min: number;
    max: number;
  };
  trend: 'up' | 'down' | 'stable';  // 趋势方向
  trendDescription: string; // 趋势描述文本
}

// ============ 竞猜记录(v1.2) ============

// 竞猜序列/记录(每期为一条记录,targetDate 为唯一键)
export interface GuessPickResult {
  pickIndex: number;        // 第几组
  numbers: number[];        // 该组 7 数字(5前+2后)
  tier: string | null;      // 中奖奖级 '1'-'7' 或 null
  amount: number;           // 该组奖金(未中为 0)
}

export interface GuessParams {
  sumMin: number; sumMax: number;
  rangeMin: number; rangeMax: number;
  consecutive: number[]; frontRepeat: number[]; backRepeat: number[]; odd: number[];
}

export interface GuessRecord {
  targetDate: string;       // 目标开奖日 YYYY-MM-DD(唯一键)
  periodId: string;         // 期号(推算,展示用;验证以 targetDate 匹配为准)
  picks: number[][];        // AI 生成的选号组(默认 2 组)
  params: GuessParams;      // 生成时使用的参数(可追溯)
  createdAt: string;        // 生成时间 ISO
  status: 'pending' | 'verified' | 'failed';
  drawId?: string;          // 验证后回填开奖期号
  results?: GuessPickResult[]; // 验证后回填逐组结果
  totalPrize?: number;      // 该期总奖金
}

// 统计聚合结果
export interface GuessStats {
  totalPeriods: number;       // 已验证期数
  totalPicks: number;         // 总条目数(期数×每组)
  winningPicks: number;       // 中奖条目数
  pickSuccessRate: number;    // 条目成功率 = winningPicks/totalPicks
  winDays: number;            // 获胜天数(有≥1条中奖的期数)
  totalCost: number;          // 总投入 = totalPicks × 2
  totalPrize: number;         // 总奖金
  roi: number;                // (总奖金-总投入)/总投入
}
