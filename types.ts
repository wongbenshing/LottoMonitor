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
  amountSource?: 'official' | 'default' | 'upgraded-default' | 'missing'; // v1.3: 金额来源,missing = 官方浮动奖字段缺失
}

export interface GuessParams {
  sumMin: number; sumMax: number;
  rangeMin: number; rangeMax: number;
  consecutive: number[]; frontRepeat: number[]; backRepeat: number[]; odd: number[];
}

// ============ v1.3 数据项扩展(为 ROI 归因/闸门决策补齐口径) ============

/** 单组号码的可复算特征(归因分析基础,替代不可信的 params) */
export interface PickFeatures {
  sum: number;              // 前区和值
  range: number;            // 前区极差
  oddCount: number;         // 前区奇数个数
  consecutivePairs: number; // 前区连号对数
  birthdayCount: number;    // 前区 <=31(生日号)个数
  bigCount: number;         // 前区 >=32 个数
  tailRepeat: number;       // 前区同尾号对数
  crowdingScore: number;    // 拥挤度 0~100(越高越像人群选号 → 中奖分摊风险越大)
}

/** 开奖数据快照(验证时存档,避免后续 history.csv 变动导致 ROI 无法复算) */
export interface DrawSnapshot {
  drawId: string;
  poolAfter?: number;        // 开奖后奖池滚存
  isUpgradeWindow: boolean;  // 本期是否为奖池升档期(三至七等奖升档)
  prize3?: number; prize4?: number; prize5?: number; prize6?: number; prize7?: number;
  prize1?: number; prize2?: number;
  dataIncomplete: boolean;   // 官方奖金字段缺失(不再静默按默认档结算)
}

/** 成本口径:基本投注 2 元/注,追加 +1 元(仅参与浮动奖),倍数可乘 */
export interface GuessCost {
  perPick: number;      // 单注成本(基本 2 / 追加 3)
  additional: boolean;  // 是否追加投注
  multiple: number;     // 投注倍数
  total: number;        // 该期总成本
}

/** 奖池闸门决策(唯一能提升每元期望返还的机制:奖池>=8亿 → 下期三至七等奖升档) */
export interface GuessGate {
  upgradeWindow: boolean;   // 本期是否升档窗口
  poolAfter?: number;       // 上一期开奖后奖池
  gapToUpgrade?: number;    // 距 8 亿阈值差额(元)
  suggestedPicks: number;   // 建议注数(非窗口期降注)
  skipped: boolean;         // 是否建议跳过(预算/非窗口策略) —— 仅建议,不硬拦
}

export type GuessStrategy = 'ai' | 'balanced' | 'hot' | 'cold' | 'interval' | 'random' | 'manual' | 'hold';

export interface GuessRecord {
  targetDate: string;       // 目标开奖日 YYYY-MM-DD(唯一键)
  periodId: string;         // 期号(推算,展示用;验证以 targetDate 匹配为准)
  picks: number[][];        // AI 生成的选号组(默认 2 组)
  params: GuessParams;      // 生成时的**建议**参数(AI 只作参考,不保证遵守;v1.3 起请用 pickFeatures 归因)
  createdAt: string;        // 生成时间 ISO
  status: 'pending' | 'verified' | 'failed';
  drawId?: string;          // 验证后回填开奖期号
  results?: GuessPickResult[]; // 验证后回填逐组结果
  totalPrize?: number;      // 该期总奖金
  // ===== v1.3 新增(全部可选,旧记录缺省不影响解析) =====
  cost?: GuessCost;
  pickFeatures?: PickFeatures[];
  paramsCompliance?: boolean[];  // 逐组:号码是否落在建议参数区间
  gate?: GuessGate;
  strategy?: GuessStrategy;
  drawSnapshot?: DrawSnapshot;
  dataIncomplete?: boolean;      // 开奖奖金字段缺失(金额可能不完整)
}

/** 统计聚合结果 */
export interface GuessStats {
  totalPeriods: number;       // 已验证期数
  totalPicks: number;         // 总条目数(期数×每组)
  winningPicks: number;       // 中奖条目数
  pickSuccessRate: number;    // 条目成功率 = winningPicks/totalPicks(注:含 5~7 元小奖,不代表实质中奖)
  winDays: number;            // 获胜天数(有≥1条中奖的期数)
  totalCost: number;          // 总投入 = totalPicks × 2
  totalPrize: number;         // 总奖金
  roi: number;                // (总奖金-总投入)/总投入
  // ===== v1.3 分层指标(避免单个 ROI 被长尾单次事件支配) =====
  smallTierPrize: number;     // 六/七等奖(5~18 元档)回收
  smallTierReturnRate: number;   // 小奖返还率 = smallTierPrize/totalCost(理论约 20.9%)
  longTailPrize: number;      // 一~五等奖(长尾)回收
  longTailReturnRate: number;    // 长尾返还率
  netWinPeriods: number;      // 净回本期数(该期回收 > 该期投入)
  upgradePeriods: number;     // 升档窗口期数
  nonUpgradePeriods: number;  // 非升档窗口期数
  upgradeNet: number;         // 升档窗口净盈亏
  nonUpgradeNet: number;      // 非升档窗口净盈亏
}

