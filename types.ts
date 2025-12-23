
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
  AI = 'ai'
}

export interface AnalysisSummary {
  hotNumbers: number[];
  coldNumbers: number[];
  recommendation: number[];
  explanation: string;
}
