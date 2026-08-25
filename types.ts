export interface LottoDraw {
  id: string; // 期号
  date: string; // 开奖日期
  front: number[]; // 前区 5个数字
  back: number[]; // 后区 2个数字
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
  WALKFORWARD = 'walkforward'
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
