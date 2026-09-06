import { LottoDraw, PrizeResult, PredictionResult } from './types';

// ========== P2 新增：数据可视化统计类型 ==========

export interface OmitStats {
  num: number;        // 号码
  omit: number;       // 遗漏期数
  lastDrawId: string; // 最近出现期号
  lastDrawDate: string; // 最近出现日期
}

export interface ConsecutiveStats {
  totalDraws: number;           // 总期数
  consecutiveDraws: number;     // 有连号的期数
  consecutiveRate: string;      // 连号出现率
  lengthDistribution: {         // 连号长度分布
    length: number;
    count: number;
    percentage: string;
  }[];
  zoneDistribution: {           // 连号位置分布
    zone: string;
    range: string;
    count: number;
  }[];
}

export interface RepeatStats {
  frontDistribution: {          // 前区重号分布
    count: number;
    frequency: number;
    percentage: string;
  }[];
  backDistribution: {           // 后区重号分布
    count: number;
    frequency: number;
    percentage: string;
  }[];
  recentTrend: {                // 最近重号走势
    drawId: string;
    frontRepeat: number;
    backRepeat: number;
  }[];
}

// ========== 概率转移矩阵相关类型 ==========

export interface SumInterval {
  index: number;           // 区间索引 0-14
  min: number;            // 区间最小值
  max: number;            // 区间最大值
  label: string;          // 区间标签
}

export interface TransitionMatrix {
  intervals: SumInterval[];  // 区间定义
  firstOrder: number[][];    // 1阶转移矩阵 [当前区间][下一区间] = 概率
  secondOrder: number[][];   // 2阶转移矩阵 [前两区间组合][下一区间] = 概率
  thirdOrder: number[][];    // 3阶转移矩阵 [前三区间组合][下一区间] = 概率
  fourthOrder: number[][];   // 4阶转移矩阵 [前四区间组合][下一区间] = 概率
}

export interface TransitionResult {
  intervals: SumInterval[];
  firstOrderProbs: number[];   // 当前1阶概率
  secondOrderProbs: number[];  // 当前2阶概率
  thirdOrderProbs: number[];   // 当前3阶概率
  fourthOrderProbs: number[];  // 当前4阶概率
  bestInterval: SumInterval;   // 加权平均分最高的区间
  maxScore: number;            // 最高加权平均分
}

// ===== 大乐透奖级(2026-02-02 第26014期起新规) =====
// v1.2.5: 官方2026新规 9奖级合并为7奖级(13个中奖条件不变):
//   三等=5+0|4+2(原三/四等), 五等=4+0|3+2(原六/七等)
//   固定奖金额随奖池分档: <8亿 → 5000/300/150/15/5; ≥8亿 → 6666/380/200/18/7
//   26013期及以前为旧规(2019-2026.01): 9奖级 10000/3000/300/200/100/15/5
export const checkPrize = (userFront: number[], userBack: number[], draw: LottoDraw): string | null => {
  const frontMatch = userFront.filter(n => draw.front.includes(n)).length;
  const backMatch = userBack.filter(n => draw.back.includes(n)).length;

  // 是否新规期: 期号 ≥ 26014(或日期 ≥ 2026-02-02)
  const drawNum = parseInt(draw.id);
  const isNewRule = (drawNum >= 26014) || (draw.date >= '2026-02-02');

  if (frontMatch === 5 && backMatch === 2) return '1';
  if (frontMatch === 5 && backMatch === 1) return '2';
  if (frontMatch === 5 && backMatch === 0) return '3';               // 两版均三等
  if (frontMatch === 4 && backMatch === 2) return isNewRule ? '3' : '4';
  if (frontMatch === 4 && backMatch === 1) return isNewRule ? '4' : '5';
  if (frontMatch === 3 && backMatch === 2) return isNewRule ? '5' : '6';
  if (frontMatch === 4 && backMatch === 0) return isNewRule ? '5' : '7';
  if ((frontMatch === 3 && backMatch === 1) || (frontMatch === 2 && backMatch === 2)) return isNewRule ? '6' : '8';
  if ((frontMatch === 3 && backMatch === 0) || (frontMatch === 2 && backMatch === 1) ||
      (frontMatch === 1 && backMatch === 2) || (frontMatch === 0 && backMatch === 2)) return isNewRule ? '7' : '9';

  return null;
};

export const calculateHistoricalPrizes = (userFront: number[], userBack: number[], history: LottoDraw[]): PrizeResult[] => {
  const results: Record<string, PrizeResult> = {
    '1': { tier: '1', name: '一等奖', count: 0, dates: [] },
    '2': { tier: '2', name: '二等奖', count: 0, dates: [] },
    '3': { tier: '3', name: '三等奖', count: 0, dates: [] },
    '4': { tier: '4', name: '四等奖', count: 0, dates: [] },
    '5': { tier: '5', name: '五等奖', count: 0, dates: [] },
    '6': { tier: '6', name: '六等奖', count: 0, dates: [] },
    '7': { tier: '7', name: '七等奖', count: 0, dates: [] },
    '8': { tier: '8', name: '八等奖', count: 0, dates: [] },
    '9': { tier: '9', name: '九等奖', count: 0, dates: [] },
  };

  history.forEach(draw => {
    const tier = checkPrize(userFront, userBack, draw);
    if (tier && results[tier]) {
      results[tier].count++;
      results[tier].dates.push(draw.date);
    }
  });

  return Object.values(results);
};

/**
 * 计算加权移动平均
 * @param data 数据序列
 * @param weights 权重数组，长度应与数据长度一致或更短
 * @returns 加权平均值
 */
const calculateWeightedMovingAverage = (data: number[], weights: number[]): number => {
  const effectiveLength = Math.min(data.length, weights.length);
  const recentData = data.slice(-effectiveLength);
  const effectiveWeights = weights.slice(-effectiveLength);
  
  const weightSum = effectiveWeights.reduce((a, b) => a + b, 0);
  const weightedSum = recentData.reduce((sum, val, idx) => sum + val * effectiveWeights[idx], 0);
  
  return weightSum > 0 ? weightedSum / weightSum : 0;
};

/**
 * 计算标准差
 */
const calculateStdDev = (data: number[]): number => {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
};

/**
 * 智能预测算法 - 加权移动平均 + 均值回归 + 动态置信度
 * 
 * 核心思想：
 * 1. 加权移动平均 - 近期数据权重更高，适应"短期惯性"
 * 2. 均值回归 - 极端值倾向于回归历史均值
 * 3. 动态置信度 - 波动越大，置信度越低，诚实告知用户
 * 
 * @param maxRangeWidth 最大区间宽度限制（默认20），用于极差等范围小的指标
 */
const smartPrediction = (
  values: number[],
  minValue: number,
  maxValue: number,
  deviationThreshold: { high: number; medium: number },
  maxRangeWidth: number = 20
): PredictionResult => {
  // 基础兜底
  if (values.length === 0) {
    return {
      predictedValue: Math.round((minValue + maxValue) / 2),
      confidence: 0,
      confidenceLevel: 'low',
      suggestedRange: { min: minValue, max: maxValue },
      trend: 'stable',
      trendDescription: '数据不足，无法预测'
    };
  }

  // 1. 计算三个时间窗口的加权平均
  // 近5期：权重 50%（短期惯性）
  // 近15期：权重 30%（中期趋势）
  // 近50期：权重 20%（长期基准）
  const recent5 = values.slice(-5);
  const recent15 = values.slice(-15);
  const recent50 = values.slice(-50);
  
  const weightedAvg5 = recent5.length > 0 
    ? recent5.reduce((a, b) => a + b, 0) / recent5.length 
    : 0;
  const weightedAvg15 = recent15.length > 0 
    ? calculateWeightedMovingAverage(recent15, [1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8]) 
    : weightedAvg5;
  const weightedAvg50 = recent50.length > 0 
    ? calculateWeightedMovingAverage(recent50, Array(50).fill(0).map((_, i) => 1 + i * 0.08)) 
    : weightedAvg15;
  
  // 综合预测值（加权合成）- 增加短期权重，让预测更敏感地跟随近期走势
  let prediction = Math.round(
    weightedAvg5 * 0.7 + 
    weightedAvg15 * 0.2 + 
    weightedAvg50 * 0.1
  );

  // 2. 均值回归修正
  // 计算历史均值
  const historicalMean = values.reduce((a, b) => a + b, 0) / values.length;
  const deviationFromMean = Math.abs(prediction - historicalMean);
  
  // 如果预测值偏离历史均值超过阈值，向均值方向拉回 30%
  const meanReversionThreshold = (maxValue - minValue) * 0.15; // 15% 范围
  if (deviationFromMean > meanReversionThreshold) {
    const reversionDirection = prediction > historicalMean ? -1 : 1;
    const reversionAmount = Math.round(deviationFromMean * 0.3);
    prediction += reversionDirection * reversionAmount;
  }

  // 3. 计算置信度（基于近期波动率）
  const recentValues = values.slice(-20);
  const volatility = calculateStdDev(recentValues);
  
  // 根据波动率确定置信度
  let confidence: number;
  let confidenceLevel: 'high' | 'medium' | 'low';
  
  if (volatility <= deviationThreshold.high) {
    confidence = 75 + Math.round((deviationThreshold.high - volatility) / deviationThreshold.high * 15);
    confidenceLevel = 'high';
  } else if (volatility <= deviationThreshold.medium) {
    confidence = 50 + Math.round((deviationThreshold.medium - volatility) / (deviationThreshold.medium - deviationThreshold.high) * 15);
    confidenceLevel = 'medium';
  } else {
    confidence = Math.max(20, 50 - Math.round((volatility - deviationThreshold.medium) / deviationThreshold.medium * 20));
    confidenceLevel = 'low';
  }
  confidence = Math.min(95, Math.max(20, confidence)); // 限制在 20-95%

  // 4. 生成建议区间（仅在置信度高时才给出窄区间）- 整体区间宽度降低约50%
  let rangeWidth: number;
  if (confidenceLevel === 'high') {
    rangeWidth = Math.round(volatility * 0.6);
  } else if (confidenceLevel === 'medium') {
    rangeWidth = Math.round(volatility * 1);
  } else {
    rangeWidth = Math.round(volatility * 1.5);
  }
  // 根据 maxRangeWidth 动态调整最小宽度
  // 高置信度时最小宽度为 4，中/低置信度时适当放宽
  const minWidth = maxRangeWidth <= 6 ? 3 : 6;
  rangeWidth = Math.max(minWidth, Math.min(maxRangeWidth, rangeWidth));
  
  const suggestedRange = {
    min: Math.max(minValue, prediction - Math.floor(rangeWidth / 2)),
    max: Math.min(maxValue, prediction + Math.ceil(rangeWidth / 2))
  };

  // 5. 判断趋势
  const shortTermAvg = recent5.length > 0 
    ? recent5.reduce((a, b) => a + b, 0) / recent5.length 
    : prediction;
  const mediumTermAvg = recent15.length > 0 
    ? recent15.reduce((a, b) => a + b, 0) / recent15.length 
    : shortTermAvg;
  
  const trendDiff = shortTermAvg - mediumTermAvg;
  const trendThreshold = volatility * 0.5;
  
  let trend: 'up' | 'down' | 'stable';
  let trendDescription: string;
  
  if (trendDiff > trendThreshold) {
    trend = 'up';
    trendDescription = '近期呈上升趋势';
  } else if (trendDiff < -trendThreshold) {
    trend = 'down';
    trendDescription = '近期呈下降趋势';
  } else {
    trend = 'stable';
    trendDescription = '近期趋势平稳';
  }

  // 限制预测值在合理范围内
  prediction = Math.max(minValue, Math.min(maxValue, prediction));

  return {
    predictedValue: prediction,
    confidence,
    confidenceLevel,
    suggestedRange,
    trend,
    trendDescription
  };
};

/**
 * 预测下期前区和值
 * 采用改进的智能预测算法：加权移动平均 + 均值回归 + 动态置信度
 */
export const predictNextSum = (history: LottoDraw[]): PredictionResult => {
  // 提取和值序列（从新到旧）
  const sums = history.map(d => d.front.reduce((a, b) => a + b, 0));
  
  // 大乐透和值范围：最小 1+2+3+4+5=15，最大 31+32+33+34+35=165
  // 实际常见范围 50-130
  return smartPrediction(sums, 15, 165, { high: 15, medium: 25 });
};

/**
 * 预测下期前区极差
 * 采用同样的智能预测算法，但使用更严格的区间限制
 * 
 * 极差范围较小（4-34，共31个值），因此区间宽度限制更严格：
 * - 高置信度：区间宽度 ≤ 4
 * - 中置信度：区间宽度 ≤ 5  
 * - 低置信度：区间宽度 ≤ 6（超过则认为无效）
 */
export const predictNextRange = (history: LottoDraw[]): PredictionResult => {
  // 提取极差序列（从新到旧）
  const ranges = history.map(d => {
    const max = Math.max(...d.front);
    const min = Math.min(...d.front);
    return max - min;
  });
  
  // 大乐透极差范围：最小 4 (如 1,2,3,4,5)，最大 34 (如 1,2,3,4,35)
  // 实际常见范围 15-30
  // 使用更严格的波动率阈值：高置信度要求波动率≤3，中置信度≤5
  // 最大区间宽度限制为 6（超过则视为无效预测）
  return smartPrediction(ranges, 4, 34, { high: 3, medium: 5 }, 6);
};

// ========== P2 新增：遗漏值分析 ==========

/**
 * 计算号码遗漏值 - 优化版 O(n)
 * @param history 历史开奖数据（按时间从新到旧排序）
 * @param isFront true=前区(1-35), false=后区(1-12)
 * @returns 每个号码的遗漏统计
 * 
 * 优化说明：
 * - 原算法：O(maxNum × history.length)，35×2500=87,500 次操作
 * - 新算法：O(history.length)，只需 2,500 次操作
 * - 提升：35 倍性能提升
 */
export const calculateOmitStats = (
  history: LottoDraw[],
  isFront: boolean
): OmitStats[] => {
  const maxNum = isFront ? 35 : 12;
  
  // 使用 Map 记录每个号码最后出现的位置（期号索引）
  // key: 号码, value: 在历史数据中的索引
  const lastSeenIndex = new Map<number, number>();
  
  // 只需遍历一次历史数据，记录每个号码最近出现的位置
  for (let i = 0; i < history.length; i++) {
    const draw = history[i];
    const numbers = isFront ? draw.front : draw.back;
    
    numbers.forEach(num => {
      // 只记录第一次出现的位置（因为 history 是从新到旧，第一次就是最近）
      if (!lastSeenIndex.has(num)) {
        lastSeenIndex.set(num, i);
      }
    });
    
    // 如果所有号码都已找到，提前退出
    if (lastSeenIndex.size === maxNum) {
      break;
    }
  }
  
  // 构建结果
  const stats: OmitStats[] = [];
  for (let num = 1; num <= maxNum; num++) {
    const seenIndex = lastSeenIndex.get(num);
    
    if (seenIndex === undefined) {
      // 号码从未出现
      stats.push({
        num,
        omit: history.length,
        lastDrawId: '-',
        lastDrawDate: '-'
      });
    } else {
      // 遗漏值 = 该号码出现的索引（就是遗漏期数）
      const draw = history[seenIndex];
      stats.push({
        num,
        omit: seenIndex,
        lastDrawId: draw.id,
        lastDrawDate: draw.date
      });
    }
  }

  return stats;
};

// ========== P2 新增：连号分析 ==========

/**
 * 检测一组号码中的连号
 * @param numbers 排序后的号码数组
 * @returns 连号组数，每组包含起始号码和长度
 */
export const findConsecutive = (numbers: number[]): { start: number; length: number }[] => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const consecutive: { start: number; length: number }[] = [];
  
  let currentStart = sorted[0];
  let currentLength = 1;

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      currentLength++;
    } else {
      if (currentLength >= 2) {
        consecutive.push({ start: currentStart, length: currentLength });
      }
      currentStart = sorted[i];
      currentLength = 1;
    }
  }

  if (currentLength >= 2) {
    consecutive.push({ start: currentStart, length: currentLength });
  }

  return consecutive;
};

/**
 * 获取号码所在区间
 */
const getNumberZone = (num: number): { zone: string; range: string } => {
  if (num <= 12) return { zone: '小号区', range: '1-12' };
  if (num <= 24) return { zone: '中号区', range: '13-24' };
  return { zone: '大号区', range: '25-35' };
};

/**
 * 计算连号统计
 * @param history 历史开奖数据
 * @returns 连号统计结果
 */
export const calculateConsecutiveStats = (
  history: LottoDraw[]
): ConsecutiveStats => {
  const totalDraws = history.length;
  let consecutiveDraws = 0;
  
  const lengthCounts: Record<number, number> = { 2: 0, 3: 0, 4: 0, 5: 0 };
  const zoneCounts: Record<string, { zone: string; range: string; count: number }> = {
    '小号区': { zone: '小号区', range: '1-12', count: 0 },
    '中号区': { zone: '中号区', range: '13-24', count: 0 },
    '大号区': { zone: '大号区', range: '25-35', count: 0 }
  };

  history.forEach(draw => {
    const consecutive = findConsecutive(draw.front);
    
    if (consecutive.length > 0) {
      consecutiveDraws++;
      
      consecutive.forEach(group => {
        // 统计长度分布
        const len = Math.min(group.length, 5);
        lengthCounts[len] = (lengthCounts[len] || 0) + 1;
        
        // 统计位置分布（取连号的中间位置）
        const midNum = group.start + Math.floor(group.length / 2);
        const zoneInfo = getNumberZone(midNum);
        zoneCounts[zoneInfo.zone].count++;
      });
    }
  });

  const lengthDistribution = [2, 3, 4, 5].map(length => ({
    length,
    count: lengthCounts[length],
    percentage: totalDraws > 0 
      ? ((lengthCounts[length] / totalDraws) * 100).toFixed(1) 
      : '0.0'
  }));

  return {
    totalDraws,
    consecutiveDraws,
    consecutiveRate: totalDraws > 0 
      ? ((consecutiveDraws / totalDraws) * 100).toFixed(1) 
      : '0.0',
    lengthDistribution,
    zoneDistribution: Object.values(zoneCounts)
  };
};

// 号码温度类型
export type NumberTemperature = 'hot' | 'warm' | 'cold' | 'frozen';

/**
 * 根据遗漏值获取号码温度标签
 * @param omit 遗漏期数
 * @returns 温度标签
 */
export const getNumberTemperature = (omit: number): NumberTemperature => {
  if (omit <= 5) return 'hot';      // 热号
  if (omit <= 15) return 'warm';    // 温号
  if (omit <= 30) return 'cold';    // 冷号
  return 'frozen';                   // 极冷
};

/**
 * 获取温度标签对应的中文和样式
 * @param temp 温度类型
 */
export const getTemperatureStyle = (temp: NumberTemperature): { label: string; bgClass: string; textClass: string } => {
  switch (temp) {
    case 'hot':
      return { label: '热', bgClass: 'bg-green-50', textClass: 'text-green-600' };
    case 'warm':
      return { label: '温', bgClass: 'bg-yellow-50', textClass: 'text-yellow-600' };
    case 'cold':
      return { label: '冷', bgClass: 'bg-orange-50', textClass: 'text-orange-600' };
    case 'frozen':
      return { label: '极冷', bgClass: 'bg-red-50', textClass: 'text-red-600' };
  }
};

/**
 * 计算某一期开奖时各号码的温度标签（基于开奖前的数据）
 * @param history 全部历史数据（从新到旧排序）
 * @param targetIndex 目标期数在 history 中的索引
 * @returns 该期开奖号码的温度映射
 * 
 * 注意：这是站在历史的角度，模拟"开奖前"的视角
 * - 对于第 i 期，只看它之后的数据（i+1, i+2...）来计算遗漏值
 * - 这样就能知道该号码在开奖前是冷号还是热号
 */
export const calculateDrawTemperature = (
  history: LottoDraw[],
  targetIndex: number
): { front: Record<number, NumberTemperature>; back: Record<number, NumberTemperature> } => {
  // 获取目标期之后的数据（即更早的历史数据）
  const priorHistory = history.slice(targetIndex + 1);
  
  const frontResult: Record<number, NumberTemperature> = {};
  const backResult: Record<number, NumberTemperature> = {};
  
  // 计算前区号码的温度
  const targetFront = history[targetIndex]?.front || [];
  const targetBack = history[targetIndex]?.back || [];
  
  // 用于记录每个号码最后出现的位置
  const lastSeenFront = new Map<number, number>();
  const lastSeenBack = new Map<number, number>();
  
  // 遍历之前的历史数据，记录每个号码最后出现的位置
  for (let i = 0; i < priorHistory.length; i++) {
    const draw = priorHistory[i];
    
    draw.front.forEach(num => {
      if (!lastSeenFront.has(num)) {
        lastSeenFront.set(num, i);
      }
    });
    
    draw.back.forEach(num => {
      if (!lastSeenBack.has(num)) {
        lastSeenBack.set(num, i);
      }
    });
    
    // 如果所有号码都找到了，提前退出
    if (lastSeenFront.size === 35 && lastSeenBack.size === 12) {
      break;
    }
  }
  
  // 为目标期的每个前区号码计算温度
  targetFront.forEach(num => {
    const seenIndex = lastSeenFront.get(num);
    let omit: number;
    
    if (seenIndex === undefined) {
      // 号码从未在之前出现过
      omit = priorHistory.length;
    } else {
      // 遗漏值就是它在 priorHistory 中的索引
      omit = seenIndex;
    }
    
    frontResult[num] = getNumberTemperature(omit);
  });
  
  // 为目标期的每个后区号码计算温度
  targetBack.forEach(num => {
    const seenIndex = lastSeenBack.get(num);
    let omit: number;
    
    if (seenIndex === undefined) {
      omit = priorHistory.length;
    } else {
      omit = seenIndex;
    }
    
    backResult[num] = getNumberTemperature(omit);
  });
  
  return { front: frontResult, back: backResult };
};

// ========== P2 新增：重号分析 ==========

/**
 * 计算两个数组的交集数量
 */
export const countIntersection = (arr1: number[], arr2: number[]): number => {
  return arr1.filter(x => arr2.includes(x)).length;
};

export const countOdd = (numbers: number[]): number => {
  return numbers.filter(n => n % 2 !== 0).length;
};

/**
 * 计算重号统计
 * @param history 历史开奖数据（按时间从新到旧排序）
 * @returns 重号统计结果
 */
export const calculateRepeatStats = (
  history: LottoDraw[]
): RepeatStats => {
  const frontDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const backDist: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  const recentTrend: { drawId: string; frontRepeat: number; backRepeat: number }[] = [];

  // 需要从旧到新遍历才能计算重号
  const historyAsc = [...history].reverse();

  historyAsc.forEach((draw, index) => {
    if (index === 0) {
      // 第一期没有上一期，默认0个重号
      frontDist[0]++;
      backDist[0]++;
      recentTrend.push({ drawId: draw.id, frontRepeat: 0, backRepeat: 0 });
    } else {
      const prevDraw = historyAsc[index - 1];
      const frontRepeat = countIntersection(draw.front, prevDraw.front);
      const backRepeat = countIntersection(draw.back, prevDraw.back);
      
      frontDist[frontRepeat]++;
      backDist[backRepeat]++;
      recentTrend.push({ drawId: draw.id, frontRepeat, backRepeat });
    }
  });

  const totalDraws = history.length;
  
  const frontDistribution = [0, 1, 2, 3, 4, 5].map(count => ({
    count,
    frequency: frontDist[count],
    percentage: totalDraws > 0 
      ? ((frontDist[count] / totalDraws) * 100).toFixed(1) 
      : '0.0'
  }));

  const backDistribution = [0, 1, 2].map(count => ({
    count,
    frequency: backDist[count],
    percentage: totalDraws > 0 
      ? ((backDist[count] / totalDraws) * 100).toFixed(1) 
      : '0.0'
  }));

  return {
    frontDistribution,
    backDistribution,
    recentTrend: recentTrend.slice(-30) // 只取最近30期
  };
};

// ========== 概率转移矩阵计算 ==========

/**
 * 创建和值区间定义
 * 第一个区间：15~34
 * 中间区间步长8：35~42, 43~50, ..., 139~146
 * 最后一个区间：147~165
 */
export const createSumIntervals = (): SumInterval[] => {
  const intervals: SumInterval[] = [];
  
  intervals.push({
    index: 0,
    min: 15,
    max: 34,
    label: '15-34'
  });
  
  let start = 35;
  const step = 8;
  const midEnd = 146;
  
  for (let i = 1; start <= midEnd; i++) {
    const max = start + step - 1;
    intervals.push({
      index: i,
      min: start,
      max,
      label: `${start}-${max}`
    });
    start += step;
  }
  
  const lastIndex = intervals.length;
  intervals.push({
    index: lastIndex,
    min: 147,
    max: 165,
    label: '147-165'
  });
  
  return intervals;
};

/**
 * 获取和值所在的区间索引
 */
export const getSumIntervalIndex = (sum: number, intervals: SumInterval[]): number => {
  for (let i = 0; i < intervals.length; i++) {
    if (sum >= intervals[i].min && sum <= intervals[i].max) {
      return i;
    }
  }
  return -1;
};

/**
 * 创建极差区间定义
 * 第1个区间：4~7
 * 后续区间步长3：8~10, 11~13, ..., 32~34
 */
export const createRangeIntervals = (): SumInterval[] => {
  const intervals: SumInterval[] = [];
  
  intervals.push({
    index: 0,
    min: 4,
    max: 7,
    label: '4-7'
  });
  
  let start = 8;
  const step = 3;
  const end = 34;
  
  for (let i = 1; start <= end; i++) {
    const max = Math.min(start + step - 1, end);
    intervals.push({
      index: i,
      min: start,
      max,
      label: `${start}-${max}`
    });
    start += step;
  }
  
  return intervals;
};

/**
 * 获取极差所在的区间索引
 */
export const getRangeIntervalIndex = (range: number, intervals: SumInterval[]): number => {
  for (let i = 0; i < intervals.length; i++) {
    if (range >= intervals[i].min && range <= intervals[i].max) {
      return i;
    }
  }
  return -1;
};

/**
 * 构建极差概率转移矩阵
 */
export const buildRangeTransitionMatrices = (
  history: LottoDraw[],
  intervals: SumInterval[]
): TransitionMatrix => {
  const numIntervals = intervals.length;
  
  const firstOrder: number[][] = Array(numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const secondOrder: number[][] = Array(numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const thirdOrder: number[][] = Array(numIntervals * numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const fourthOrder: number[][] = Array(numIntervals ** 4).fill(0).map(() => Array(numIntervals).fill(0));
  
  const rangeIndices: number[] = history.map(draw => {
    const max = Math.max(...draw.front);
    const min = Math.min(...draw.front);
    const range = max - min;
    return getRangeIntervalIndex(range, intervals);
  }).filter(idx => idx !== -1);
  
  for (let i = 0; i < rangeIndices.length - 1; i++) {
    const current = rangeIndices[i];
    const next = rangeIndices[i + 1];
    firstOrder[current][next]++;
  }
  
  for (let i = 0; i < firstOrder.length; i++) {
    const rowSum = firstOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrder[i][j] = firstOrder[i][j] / rowSum;
      }
    }
  }
  
  for (let i = 0; i < rangeIndices.length - 2; i++) {
    const current = rangeIndices[i];
    const prev = rangeIndices[i + 1];
    const next = rangeIndices[i + 2];
    const key = current * numIntervals + prev;
    secondOrder[key][next]++;
  }
  
  for (let i = 0; i < secondOrder.length; i++) {
    const rowSum = secondOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrder[i][j] = secondOrder[i][j] / rowSum;
      }
    }
  }
  
  for (let i = 0; i < rangeIndices.length - 3; i++) {
    const current = rangeIndices[i];
    const prev1 = rangeIndices[i + 1];
    const prev2 = rangeIndices[i + 2];
    const next = rangeIndices[i + 3];
    const key = current * numIntervals * numIntervals + prev1 * numIntervals + prev2;
    thirdOrder[key][next]++;
  }
  
  for (let i = 0; i < thirdOrder.length; i++) {
    const rowSum = thirdOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrder[i][j] = thirdOrder[i][j] / rowSum;
      }
    }
  }
  
  for (let i = 0; i < rangeIndices.length - 4; i++) {
    const current = rangeIndices[i];
    const prev1 = rangeIndices[i + 1];
    const prev2 = rangeIndices[i + 2];
    const prev3 = rangeIndices[i + 3];
    const next = rangeIndices[i + 4];
    const key = current * numIntervals ** 3 + prev1 * numIntervals * numIntervals + prev2 * numIntervals + prev3;
    fourthOrder[key][next]++;
  }
  
  for (let i = 0; i < fourthOrder.length; i++) {
    const rowSum = fourthOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrder[i][j] = fourthOrder[i][j] / rowSum;
      }
    }
  }
  
  return {
    intervals,
    firstOrder,
    secondOrder,
    thirdOrder,
    fourthOrder
  };
};

/**
 * 计算极差概率转移结果
 * 权重: 1阶=0.55, 2阶=0.40, 3阶=0.05, 4阶=0, 5阶=0
 */
export const calculateRangeTransitionResult = (history: LottoDraw[]): TransitionResult => {
  const intervals = createRangeIntervals();
  const matrices = buildRangeTransitionMatrices(history, intervals);
  const numIntervals = intervals.length;
  
  const recentRanges = history.slice(0, 5).map(draw => {
    const max = Math.max(...draw.front);
    const min = Math.min(...draw.front);
    const range = max - min;
    return getRangeIntervalIndex(range, intervals);
  }).filter(idx => idx !== -1);
  
  const firstOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentRanges.length >= 1) {
    const currentIdx = recentRanges[0];
    if (currentIdx >= 0 && currentIdx < numIntervals) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrderProbs[j] = matrices.firstOrder[currentIdx][j];
      }
    }
  }
  
  const secondOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentRanges.length >= 2) {
    const currentIdx = recentRanges[0];
    const prevIdx = recentRanges[1];
    const key = currentIdx * numIntervals + prevIdx;
    if (key >= 0 && key < matrices.secondOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrderProbs[j] = matrices.secondOrder[key][j];
      }
    }
  }
  
  const thirdOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentRanges.length >= 3) {
    const currentIdx = recentRanges[0];
    const prevIdx1 = recentRanges[1];
    const prevIdx2 = recentRanges[2];
    const key = currentIdx * numIntervals * numIntervals + prevIdx1 * numIntervals + prevIdx2;
    if (key >= 0 && key < matrices.thirdOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrderProbs[j] = matrices.thirdOrder[key][j];
      }
    }
  }
  
  const fourthOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentRanges.length >= 4) {
    const currentIdx = recentRanges[0];
    const prevIdx1 = recentRanges[1];
    const prevIdx2 = recentRanges[2];
    const prevIdx3 = recentRanges[3];
    const key = currentIdx * numIntervals ** 3 + prevIdx1 * numIntervals * numIntervals + prevIdx2 * numIntervals + prevIdx3;
    if (key >= 0 && key < matrices.fourthOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrderProbs[j] = matrices.fourthOrder[key][j];
      }
    }
  }
  
  const normalizeProbs = (probs: number[], defaultProb: number = 1 / numIntervals): number[] => {
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return probs.map(() => defaultProb);
    }
    return probs;
  };
  
  const norm1st = normalizeProbs(firstOrderProbs);
  const norm2nd = normalizeProbs(secondOrderProbs);
  const norm3rd = normalizeProbs(thirdOrderProbs);
  const norm4th = normalizeProbs(fourthOrderProbs);
  
  const W1 = 0.20, W2 = 0.60, W3 = 0.20, W4 = 0;
  
  let maxScore = 0;
  let bestIntervalIndex = 0;
  
  for (let i = 0; i < numIntervals; i++) {
    const score = norm1st[i] * W1 + norm2nd[i] * W2 + norm3rd[i] * W3 + norm4th[i] * W4;
    if (score > maxScore) {
      maxScore = score;
      bestIntervalIndex = i;
    }
  }
  
  return {
    intervals,
    firstOrderProbs: norm1st,
    secondOrderProbs: norm2nd,
    thirdOrderProbs: norm3rd,
    fourthOrderProbs: norm4th,
    bestInterval: intervals[bestIntervalIndex],
    maxScore
  };
};

// ==================== 前区连号概率转移矩阵 ====================

export const createConsecutiveIntervals = (): SumInterval[] => {
  return [
    { index: 0, min: 0, max: 0, label: '0连号' },
    { index: 1, min: 1, max: 1, label: '1个2连号' },
    { index: 2, min: 2, max: 2, label: '2个2连号' },
    { index: 3, min: 3, max: 3, label: '1个3连号' },
    { index: 4, min: 4, max: 4, label: '1个4连号' },
    { index: 5, min: 5, max: 5, label: '1个5连号' },
  ];
};

export const getConsecutiveIndex = (draw: LottoDraw): number => {
  const consecutive = findConsecutive(draw.front);
  if (consecutive.length === 0) return 0;
  
  const twoCount = consecutive.filter(c => c.length === 2).length;
  if (twoCount === 1) return 1;
  if (twoCount === 2) return 2;
  
  for (const c of consecutive) {
    if (c.length === 3) return 3;
    if (c.length === 4) return 4;
    if (c.length === 5) return 5;
  }
  
  return 0;
};

export const buildConsecutiveTransitionMatrices = (history: LottoDraw[], intervals: SumInterval[]): TransitionMatrix => {
  const numIntervals = intervals.length;
  
  const firstOrder: number[][] = Array(numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const secondOrder: number[][] = Array(numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const thirdOrder: number[][] = Array(numIntervals * numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const fourthOrder: number[][] = Array(numIntervals ** 4).fill(0).map(() => Array(numIntervals).fill(0));
  
  const indices = history.map(draw => getConsecutiveIndex(draw)).filter(idx => idx !== -1);
  
  for (let i = 0; i < indices.length - 1; i++) {
    firstOrder[indices[i]][indices[i + 1]]++;
  }
  
  for (let i = 0; i < numIntervals; i++) {
    const rowSum = firstOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 2; i++) {
    const key = indices[i] * numIntervals + indices[i + 1];
    secondOrder[key][indices[i + 2]]++;
  }
  
  for (let i = 0; i < secondOrder.length; i++) {
    const rowSum = secondOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 3; i++) {
    const key = indices[i] * numIntervals * numIntervals + indices[i + 1] * numIntervals + indices[i + 2];
    thirdOrder[key][indices[i + 3]]++;
  }
  
  for (let i = 0; i < thirdOrder.length; i++) {
    const rowSum = thirdOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 4; i++) {
    const key = indices[i] * numIntervals ** 3 + indices[i + 1] * numIntervals * numIntervals + indices[i + 2] * numIntervals + indices[i + 3];
    fourthOrder[key][indices[i + 4]]++;
  }
  
  for (let i = 0; i < fourthOrder.length; i++) {
    const rowSum = fourthOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrder[i][j] /= rowSum;
      }
    }
  }
  
  return { intervals, firstOrder, secondOrder, thirdOrder, fourthOrder };
};

export const calculateConsecutiveTransitionResult = (history: LottoDraw[]): TransitionResult => {
  const intervals = createConsecutiveIntervals();
  const matrices = buildConsecutiveTransitionMatrices(history, intervals);
  const numIntervals = intervals.length;
  
  const recentIndices = history.slice(0, 5).map(draw => getConsecutiveIndex(draw)).filter(idx => idx !== -1);
  
  const firstOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 1) {
    const currentIdx = recentIndices[0];
    for (let j = 0; j < numIntervals; j++) {
      firstOrderProbs[j] = matrices.firstOrder[currentIdx][j];
    }
  }
  
  const secondOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 2) {
    const key = recentIndices[0] * numIntervals + recentIndices[1];
    if (key < matrices.secondOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrderProbs[j] = matrices.secondOrder[key][j];
      }
    }
  }
  
  const thirdOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 3) {
    const key = recentIndices[0] * numIntervals * numIntervals + recentIndices[1] * numIntervals + recentIndices[2];
    if (key < matrices.thirdOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrderProbs[j] = matrices.thirdOrder[key][j];
      }
    }
  }
  
  const fourthOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 4) {
    const key = recentIndices[0] * numIntervals ** 3 + recentIndices[1] * numIntervals * numIntervals + recentIndices[2] * numIntervals + recentIndices[3];
    if (key < matrices.fourthOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrderProbs[j] = matrices.fourthOrder[key][j];
      }
    }
  }
  
  const normalizeProbs = (probs: number[], defaultProb: number = 1 / numIntervals): number[] => {
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return probs.map(() => defaultProb);
    }
    return probs;
  };
  
  const norm1st = normalizeProbs(firstOrderProbs);
  const norm2nd = normalizeProbs(secondOrderProbs);
  const norm3rd = normalizeProbs(thirdOrderProbs);
  const norm4th = normalizeProbs(fourthOrderProbs);
  
  const W1 = 1.00, W2 = 0.00, W3 = 0.00, W4 = 0;
  
  let maxScore = 0;
  let bestIntervalIndex = 0;
  
  for (let i = 0; i < numIntervals; i++) {
    const score = norm1st[i] * W1 + norm2nd[i] * W2 + norm3rd[i] * W3 + norm4th[i] * W4;
    if (score > maxScore) {
      maxScore = score;
      bestIntervalIndex = i;
    }
  }
  
  return {
    intervals,
    firstOrderProbs: norm1st,
    secondOrderProbs: norm2nd,
    thirdOrderProbs: norm3rd,
    fourthOrderProbs: norm4th,
    bestInterval: intervals[bestIntervalIndex],
    maxScore
  };
};

// ==================== 前区重号概率转移矩阵 ====================

export const createFrontRepeatIntervals = (): SumInterval[] => {
  return [
    { index: 0, min: 0, max: 0, label: '0重号' },
    { index: 1, min: 1, max: 1, label: '1重号' },
    { index: 2, min: 2, max: 2, label: '2重号' },
    { index: 3, min: 3, max: 3, label: '3重号' },
    { index: 4, min: 4, max: 4, label: '4重号' },
  ];
};

export const getFrontRepeatIndex = (history: LottoDraw[], index: number): number => {
  if (index >= history.length - 1) return 0;
  const current = history[index];
  const prev = history[index + 1];
  const repeat = countIntersection(current.front, prev.front);
  return Math.min(repeat, 4);
};

export const buildFrontRepeatTransitionMatrices = (history: LottoDraw[], intervals: SumInterval[]): TransitionMatrix => {
  const numIntervals = intervals.length;
  
  const firstOrder: number[][] = Array(numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const secondOrder: number[][] = Array(numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const thirdOrder: number[][] = Array(numIntervals * numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const fourthOrder: number[][] = Array(numIntervals ** 4).fill(0).map(() => Array(numIntervals).fill(0));
  
  const indices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    indices.push(getFrontRepeatIndex(history, i));
  }
  
  for (let i = 0; i < indices.length - 1; i++) {
    firstOrder[indices[i]][indices[i + 1]]++;
  }
  
  for (let i = 0; i < numIntervals; i++) {
    const rowSum = firstOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 2; i++) {
    const key = indices[i] * numIntervals + indices[i + 1];
    secondOrder[key][indices[i + 2]]++;
  }
  
  for (let i = 0; i < secondOrder.length; i++) {
    const rowSum = secondOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 3; i++) {
    const key = indices[i] * numIntervals * numIntervals + indices[i + 1] * numIntervals + indices[i + 2];
    thirdOrder[key][indices[i + 3]]++;
  }
  
  for (let i = 0; i < thirdOrder.length; i++) {
    const rowSum = thirdOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 4; i++) {
    const key = indices[i] * numIntervals ** 3 + indices[i + 1] * numIntervals * numIntervals + indices[i + 2] * numIntervals + indices[i + 3];
    fourthOrder[key][indices[i + 4]]++;
  }
  
  for (let i = 0; i < fourthOrder.length; i++) {
    const rowSum = fourthOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrder[i][j] /= rowSum;
      }
    }
  }
  
  return { intervals, firstOrder, secondOrder, thirdOrder, fourthOrder };
};

export const calculateFrontRepeatTransitionResult = (history: LottoDraw[]): TransitionResult => {
  const intervals = createFrontRepeatIntervals();
  const matrices = buildFrontRepeatTransitionMatrices(history, intervals);
  const numIntervals = intervals.length;
  
  const recentIndices: number[] = [];
  for (let i = 0; i < Math.min(5, history.length); i++) {
    recentIndices.push(getFrontRepeatIndex(history, i));
  }
  
  const firstOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 1) {
    const currentIdx = recentIndices[0];
    for (let j = 0; j < numIntervals; j++) {
      firstOrderProbs[j] = matrices.firstOrder[currentIdx][j];
    }
  }
  
  const secondOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 2) {
    const key = recentIndices[0] * numIntervals + recentIndices[1];
    if (key < matrices.secondOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrderProbs[j] = matrices.secondOrder[key][j];
      }
    }
  }
  
  const thirdOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 3) {
    const key = recentIndices[0] * numIntervals * numIntervals + recentIndices[1] * numIntervals + recentIndices[2];
    if (key < matrices.thirdOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrderProbs[j] = matrices.thirdOrder[key][j];
      }
    }
  }
  
  const fourthOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 4) {
    const key = recentIndices[0] * numIntervals ** 3 + recentIndices[1] * numIntervals * numIntervals + recentIndices[2] * numIntervals + recentIndices[3];
    if (key < matrices.fourthOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrderProbs[j] = matrices.fourthOrder[key][j];
      }
    }
  }
  
  const normalizeProbs = (probs: number[], defaultProb: number = 1 / numIntervals): number[] => {
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return probs.map(() => defaultProb);
    }
    return probs;
  };
  
  const norm1st = normalizeProbs(firstOrderProbs);
  const norm2nd = normalizeProbs(secondOrderProbs);
  const norm3rd = normalizeProbs(thirdOrderProbs);
  const norm4th = normalizeProbs(fourthOrderProbs);
  
  const W1 = 0.60, W2 = 0.40, W3 = 0.00, W4 = 0;
  
  let maxScore = 0;
  let bestIntervalIndex = 0;
  
  for (let i = 0; i < numIntervals; i++) {
    const score = norm1st[i] * W1 + norm2nd[i] * W2 + norm3rd[i] * W3 + norm4th[i] * W4;
    if (score > maxScore) {
      maxScore = score;
      bestIntervalIndex = i;
    }
  }
  
  return {
    intervals,
    firstOrderProbs: norm1st,
    secondOrderProbs: norm2nd,
    thirdOrderProbs: norm3rd,
    fourthOrderProbs: norm4th,
    bestInterval: intervals[bestIntervalIndex],
    maxScore
  };
};

// ==================== 前区奇数概率转移矩阵 ====================

export const createOddIntervals = (): SumInterval[] => {
  return [
    { index: 0, min: 0, max: 0, label: '0奇数' },
    { index: 1, min: 1, max: 1, label: '1奇数' },
    { index: 2, min: 2, max: 2, label: '2奇数' },
    { index: 3, min: 3, max: 3, label: '3奇数' },
    { index: 4, min: 4, max: 4, label: '4奇数' },
    { index: 5, min: 5, max: 5, label: '5奇数' },
  ];
};

export const getOddIndex = (draw: LottoDraw): number => {
  return countOdd(draw.front);
};

export const buildOddTransitionMatrices = (history: LottoDraw[], intervals: SumInterval[]): TransitionMatrix => {
  const numIntervals = intervals.length;
  
  const firstOrder: number[][] = Array(numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const secondOrder: number[][] = Array(numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const thirdOrder: number[][] = Array(numIntervals * numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const fourthOrder: number[][] = Array(numIntervals ** 4).fill(0).map(() => Array(numIntervals).fill(0));
  
  const indices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    indices.push(getOddIndex(history[i]));
  }
  
  for (let i = 0; i < indices.length - 1; i++) {
    firstOrder[indices[i]][indices[i + 1]]++;
  }
  
  for (let i = 0; i < numIntervals; i++) {
    const rowSum = firstOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 2; i++) {
    const key = indices[i] * numIntervals + indices[i + 1];
    secondOrder[key][indices[i + 2]]++;
  }
  
  for (let i = 0; i < secondOrder.length; i++) {
    const rowSum = secondOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 3; i++) {
    const key = indices[i] * numIntervals * numIntervals + indices[i + 1] * numIntervals + indices[i + 2];
    thirdOrder[key][indices[i + 3]]++;
  }
  
  for (let i = 0; i < thirdOrder.length; i++) {
    const rowSum = thirdOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 4; i++) {
    const key = indices[i] * numIntervals ** 3 + indices[i + 1] * numIntervals * numIntervals + indices[i + 2] * numIntervals + indices[i + 3];
    fourthOrder[key][indices[i + 4]]++;
  }
  
  for (let i = 0; i < fourthOrder.length; i++) {
    const rowSum = fourthOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrder[i][j] /= rowSum;
      }
    }
  }
  
  return { intervals, firstOrder, secondOrder, thirdOrder, fourthOrder };
};

export const calculateOddTransitionResult = (history: LottoDraw[]): TransitionResult => {
  const intervals = createOddIntervals();
  const matrices = buildOddTransitionMatrices(history, intervals);
  const numIntervals = intervals.length;
  
  const recentIndices: number[] = [];
  for (let i = 0; i < Math.min(5, history.length); i++) {
    recentIndices.push(getOddIndex(history[i]));
  }
  
  const firstOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 1) {
    const currentIdx = recentIndices[0];
    for (let j = 0; j < numIntervals; j++) {
      firstOrderProbs[j] = matrices.firstOrder[currentIdx][j];
    }
  }
  
  const secondOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 2) {
    const key = recentIndices[0] * numIntervals + recentIndices[1];
    if (key < matrices.secondOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrderProbs[j] = matrices.secondOrder[key][j];
      }
    }
  }
  
  const thirdOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 3) {
    const key = recentIndices[0] * numIntervals * numIntervals + recentIndices[1] * numIntervals + recentIndices[2];
    if (key < matrices.thirdOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrderProbs[j] = matrices.thirdOrder[key][j];
      }
    }
  }
  
  const fourthOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 4) {
    const key = recentIndices[0] * numIntervals ** 3 + recentIndices[1] * numIntervals * numIntervals + recentIndices[2] * numIntervals + recentIndices[3];
    if (key < matrices.fourthOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrderProbs[j] = matrices.fourthOrder[key][j];
      }
    }
  }
  
  const normalizeProbs = (probs: number[], defaultProb: number = 1 / numIntervals): number[] => {
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return probs.map(() => defaultProb);
    }
    return probs;
  };
  
  const norm1st = normalizeProbs(firstOrderProbs);
  const norm2nd = normalizeProbs(secondOrderProbs);
  const norm3rd = normalizeProbs(thirdOrderProbs);
  const norm4th = normalizeProbs(fourthOrderProbs);
  
  const W1 = 0.00, W2 = 0.80, W3 = 0.00, W4 = 0.20;
  
  let maxScore = 0;
  let bestIntervalIndex = 0;
  
  for (let i = 0; i < numIntervals; i++) {
    const score = norm1st[i] * W1 + norm2nd[i] * W2 + norm3rd[i] * W3 + norm4th[i] * W4;
    if (score > maxScore) {
      maxScore = score;
      bestIntervalIndex = i;
    }
  }
  
  return {
    intervals,
    firstOrderProbs: norm1st,
    secondOrderProbs: norm2nd,
    thirdOrderProbs: norm3rd,
    fourthOrderProbs: norm4th,
    bestInterval: intervals[bestIntervalIndex],
    maxScore
  };
};

// ==================== 后区重号概率转移矩阵 ====================

export const createBackRepeatIntervals = (): SumInterval[] => {
  return [
    { index: 0, min: 0, max: 0, label: '0重号' },
    { index: 1, min: 1, max: 1, label: '1重号' },
    { index: 2, min: 2, max: 2, label: '2重号' },
  ];
};

export const getBackRepeatIndex = (history: LottoDraw[], index: number): number => {
  if (index >= history.length - 1) return 0;
  const current = history[index];
  const prev = history[index + 1];
  return countIntersection(current.back, prev.back);
};

export const buildBackRepeatTransitionMatrices = (history: LottoDraw[], intervals: SumInterval[]): TransitionMatrix => {
  const numIntervals = intervals.length;
  
  const firstOrder: number[][] = Array(numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const secondOrder: number[][] = Array(numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const thirdOrder: number[][] = Array(numIntervals * numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const fourthOrder: number[][] = Array(numIntervals ** 4).fill(0).map(() => Array(numIntervals).fill(0));
  
  const indices: number[] = [];
  for (let i = 0; i < history.length; i++) {
    indices.push(getBackRepeatIndex(history, i));
  }
  
  for (let i = 0; i < indices.length - 1; i++) {
    firstOrder[indices[i]][indices[i + 1]]++;
  }
  
  for (let i = 0; i < numIntervals; i++) {
    const rowSum = firstOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 2; i++) {
    const key = indices[i] * numIntervals + indices[i + 1];
    secondOrder[key][indices[i + 2]]++;
  }
  
  for (let i = 0; i < secondOrder.length; i++) {
    const rowSum = secondOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 3; i++) {
    const key = indices[i] * numIntervals * numIntervals + indices[i + 1] * numIntervals + indices[i + 2];
    thirdOrder[key][indices[i + 3]]++;
  }
  
  for (let i = 0; i < thirdOrder.length; i++) {
    const rowSum = thirdOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrder[i][j] /= rowSum;
      }
    }
  }
  
  for (let i = 0; i < indices.length - 4; i++) {
    const key = indices[i] * numIntervals ** 3 + indices[i + 1] * numIntervals * numIntervals + indices[i + 2] * numIntervals + indices[i + 3];
    fourthOrder[key][indices[i + 4]]++;
  }
  
  for (let i = 0; i < fourthOrder.length; i++) {
    const rowSum = fourthOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrder[i][j] /= rowSum;
      }
    }
  }
  
  return { intervals, firstOrder, secondOrder, thirdOrder, fourthOrder };
};

export const calculateBackRepeatTransitionResult = (history: LottoDraw[]): TransitionResult => {
  const intervals = createBackRepeatIntervals();
  const matrices = buildBackRepeatTransitionMatrices(history, intervals);
  const numIntervals = intervals.length;
  
  const recentIndices: number[] = [];
  for (let i = 0; i < Math.min(5, history.length); i++) {
    recentIndices.push(getBackRepeatIndex(history, i));
  }
  
  const firstOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 1) {
    const currentIdx = recentIndices[0];
    for (let j = 0; j < numIntervals; j++) {
      firstOrderProbs[j] = matrices.firstOrder[currentIdx][j];
    }
  }
  
  const secondOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 2) {
    const key = recentIndices[0] * numIntervals + recentIndices[1];
    if (key < matrices.secondOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrderProbs[j] = matrices.secondOrder[key][j];
      }
    }
  }
  
  const thirdOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 3) {
    const key = recentIndices[0] * numIntervals * numIntervals + recentIndices[1] * numIntervals + recentIndices[2];
    if (key < matrices.thirdOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrderProbs[j] = matrices.thirdOrder[key][j];
      }
    }
  }
  
  const fourthOrderProbs = Array(numIntervals).fill(0);
  if (recentIndices.length >= 4) {
    const key = recentIndices[0] * numIntervals ** 3 + recentIndices[1] * numIntervals * numIntervals + recentIndices[2] * numIntervals + recentIndices[3];
    if (key < matrices.fourthOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrderProbs[j] = matrices.fourthOrder[key][j];
      }
    }
  }
  
  const normalizeProbs = (probs: number[], defaultProb: number = 1 / numIntervals): number[] => {
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return probs.map(() => defaultProb);
    }
    return probs;
  };
  
  const norm1st = normalizeProbs(firstOrderProbs);
  const norm2nd = normalizeProbs(secondOrderProbs);
  const norm3rd = normalizeProbs(thirdOrderProbs);
  const norm4th = normalizeProbs(fourthOrderProbs);
  
  const W1 = 0.00, W2 = 0.00, W3 = 0.00, W4 = 1.00;
  
  let maxScore = 0;
  let bestIntervalIndex = 0;
  
  for (let i = 0; i < numIntervals; i++) {
    const score = norm1st[i] * W1 + norm2nd[i] * W2 + norm3rd[i] * W3 + norm4th[i] * W4;
    if (score > maxScore) {
      maxScore = score;
      bestIntervalIndex = i;
    }
  }
  
  return {
    intervals,
    firstOrderProbs: norm1st,
    secondOrderProbs: norm2nd,
    thirdOrderProbs: norm3rd,
    fourthOrderProbs: norm4th,
    bestInterval: intervals[bestIntervalIndex],
    maxScore
  };
};

/**
 * 构建概率转移矩阵
 * @param history 历史数据（从新到旧排序）
 * @param intervals 区间定义
 * @returns 1-5阶转移矩阵
 */
export const buildTransitionMatrices = (
  history: LottoDraw[],
  intervals: SumInterval[]
): TransitionMatrix => {
  const numIntervals = intervals.length;
  
  const firstOrder: number[][] = Array(numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const secondOrder: number[][] = Array(numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const thirdOrder: number[][] = Array(numIntervals * numIntervals * numIntervals).fill(0).map(() => Array(numIntervals).fill(0));
  const fourthOrder: number[][] = Array(numIntervals ** 4).fill(0).map(() => Array(numIntervals).fill(0));
  
  const sumIndices: number[] = history.map(draw => {
    const sum = draw.front.reduce((a, b) => a + b, 0);
    return getSumIntervalIndex(sum, intervals);
  }).filter(idx => idx !== -1);
  
  for (let i = 0; i < sumIndices.length - 1; i++) {
    const current = sumIndices[i];
    const next = sumIndices[i + 1];
    firstOrder[current][next]++;
  }
  
  for (let i = 0; i < numIntervals; i++) {
    const rowSum = firstOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrder[i][j] = firstOrder[i][j] / rowSum;
      }
    }
  }
  
  for (let i = 0; i < sumIndices.length - 2; i++) {
    const current = sumIndices[i];
    const prev = sumIndices[i + 1];
    const next = sumIndices[i + 2];
    const key = current * numIntervals + prev;
    secondOrder[key][next]++;
  }
  
  for (let i = 0; i < secondOrder.length; i++) {
    const rowSum = secondOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrder[i][j] = secondOrder[i][j] / rowSum;
      }
    }
  }
  
  for (let i = 0; i < sumIndices.length - 3; i++) {
    const current = sumIndices[i];
    const prev1 = sumIndices[i + 1];
    const prev2 = sumIndices[i + 2];
    const next = sumIndices[i + 3];
    const key = current * numIntervals * numIntervals + prev1 * numIntervals + prev2;
    thirdOrder[key][next]++;
  }
  
  for (let i = 0; i < thirdOrder.length; i++) {
    const rowSum = thirdOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrder[i][j] = thirdOrder[i][j] / rowSum;
      }
    }
  }
  
  for (let i = 0; i < sumIndices.length - 4; i++) {
    const current = sumIndices[i];
    const prev1 = sumIndices[i + 1];
    const prev2 = sumIndices[i + 2];
    const prev3 = sumIndices[i + 3];
    const next = sumIndices[i + 4];
    const key = current * numIntervals ** 3 + prev1 * numIntervals * numIntervals + prev2 * numIntervals + prev3;
    fourthOrder[key][next]++;
  }
  
  for (let i = 0; i < fourthOrder.length; i++) {
    const rowSum = fourthOrder[i].reduce((a, b) => a + b, 0);
    if (rowSum > 0) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrder[i][j] = fourthOrder[i][j] / rowSum;
      }
    }
  }
  
  return {
    intervals,
    firstOrder,
    secondOrder,
    thirdOrder,
    fourthOrder
  };
};

/**
 * 计算当前状态下各阶概率并找出乘积最高区间
 * @param history 历史数据（从新到旧排序）
 * @returns 各区间的1-5阶概率及最佳区间
 */
export const calculateTransitionResult = (history: LottoDraw[]): TransitionResult => {
  const intervals = createSumIntervals();
  const matrices = buildTransitionMatrices(history, intervals);
  const numIntervals = intervals.length;
  
  const recentSums = history.slice(0, 5).map(draw => {
    const sum = draw.front.reduce((a, b) => a + b, 0);
    return getSumIntervalIndex(sum, intervals);
  }).filter(idx => idx !== -1);
  
  const firstOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentSums.length >= 1) {
    const currentIdx = recentSums[0];
    if (currentIdx >= 0 && currentIdx < numIntervals) {
      for (let j = 0; j < numIntervals; j++) {
        firstOrderProbs[j] = matrices.firstOrder[currentIdx][j];
      }
    }
  }
  
  const secondOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentSums.length >= 2) {
    const currentIdx = recentSums[0];
    const prevIdx = recentSums[1];
    const key = currentIdx * numIntervals + prevIdx;
    if (key >= 0 && key < matrices.secondOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        secondOrderProbs[j] = matrices.secondOrder[key][j];
      }
    }
  }
  
  const thirdOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentSums.length >= 3) {
    const currentIdx = recentSums[0];
    const prevIdx1 = recentSums[1];
    const prevIdx2 = recentSums[2];
    const key = currentIdx * numIntervals * numIntervals + prevIdx1 * numIntervals + prevIdx2;
    if (key >= 0 && key < matrices.thirdOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        thirdOrderProbs[j] = matrices.thirdOrder[key][j];
      }
    }
  }
  
  const fourthOrderProbs: number[] = Array(numIntervals).fill(0);
  if (recentSums.length >= 4) {
    const currentIdx = recentSums[0];
    const prevIdx1 = recentSums[1];
    const prevIdx2 = recentSums[2];
    const prevIdx3 = recentSums[3];
    const key = currentIdx * numIntervals ** 3 + prevIdx1 * numIntervals * numIntervals + prevIdx2 * numIntervals + prevIdx3;
    if (key >= 0 && key < matrices.fourthOrder.length) {
      for (let j = 0; j < numIntervals; j++) {
        fourthOrderProbs[j] = matrices.fourthOrder[key][j];
      }
    }
  }
  
  const normalizeProbs = (probs: number[], defaultProb: number = 1 / numIntervals): number[] => {
    const sum = probs.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return probs.map(() => defaultProb);
    }
    return probs;
  };
  
  const norm1st = normalizeProbs(firstOrderProbs);
  const norm2nd = normalizeProbs(secondOrderProbs);
  const norm3rd = normalizeProbs(thirdOrderProbs);
  const norm4th = normalizeProbs(fourthOrderProbs);
  
  const W1 = 0.60, W2 = 0.30, W3 = 0.10, W4 = 0;
  
  let maxScore = 0;
  let bestIntervalIndex = 0;
  
  for (let i = 0; i < numIntervals; i++) {
    const score = norm1st[i] * W1 + norm2nd[i] * W2 + norm3rd[i] * W3 + norm4th[i] * W4;
    if (score > maxScore) {
      maxScore = score;
      bestIntervalIndex = i;
    }
  }
  
  return {
    intervals,
    firstOrderProbs: norm1st,
    secondOrderProbs: norm2nd,
    thirdOrderProbs: norm3rd,
    fourthOrderProbs: norm4th,
    bestInterval: intervals[bestIntervalIndex],
    maxScore
  };
};
