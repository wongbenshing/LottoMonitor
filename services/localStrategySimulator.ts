
import { LottoDraw } from "../types";
import { calculateOmitStats } from "../utils";

/**
 * 本地策略模拟器
 * 纯算法实现，不调用 API，用于快速 Walk-forward 测试
 */

export interface LocalStrategy {
  id: string;
  name: string;
  description: string;
  generate: (history: LottoDraw[], targetSum: number, targetDiff: number) => number[][];
}

/**
 * 计算号码频率（近 N 期）
 */
function calculateFrequency(history: LottoDraw[], periods: number, isFront: boolean): Map<number, number> {
  const freq = new Map<number, number>();
  const recent = history.slice(0, periods);
  
  recent.forEach(draw => {
    const numbers = isFront ? draw.front : draw.back;
    numbers.forEach(num => {
      freq.set(num, (freq.get(num) || 0) + 1);
    });
  });
  
  return freq;
}

/**
 * 获取热号列表（按频率排序）
 */
function getHotNumbers(history: LottoDraw[], count: number, periods: number, isFront: boolean): number[] {
  const freq = calculateFrequency(history, periods, isFront);
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([num]) => num);
}

/**
 * 获取冷号列表（按遗漏值排序）
 */
function getColdNumbers(history: LottoDraw[], count: number, isFront: boolean): number[] {
  const omitStats = calculateOmitStats(history, isFront);
  return omitStats
    .sort((a, b) => b.omit - a.omit)
    .slice(0, count)
    .map(s => s.num);
}

/**
 * 生成满足和值和极差约束的前区号码
 */
function generateFrontZone(
  candidates: number[],
  targetSum: number,
  targetDiff: number,
  maxAttempts: number = 100
): number[] | null {
  const frontCandidates = candidates.filter(n => n >= 1 && n <= 35);
  
  for (let i = 0; i < maxAttempts; i++) {
    // 随机打乱候选号码
    const shuffled = [...frontCandidates].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5).sort((a, b) => a - b);
    
    const sum = selected.reduce((a, b) => a + b, 0);
    const diff = selected[4] - selected[0];
    
    // 检查约束（允许一定误差）
    if (Math.abs(sum - targetSum) <= 5 && Math.abs(diff - targetDiff) <= 2) {
      return selected;
    }
  }
  
  // 如果找不到完美匹配的，返回最接近的
  let best: number[] | null = null;
  let bestScore = Infinity;
  
  for (let i = 0; i < 50; i++) {
    const shuffled = [...frontCandidates].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 5).sort((a, b) => a - b);
    
    const sum = selected.reduce((a, b) => a + b, 0);
    const diff = selected[4] - selected[0];
    
    const score = Math.abs(sum - targetSum) + Math.abs(diff - targetDiff) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = selected;
    }
  }
  
  return best;
}

/**
 * 生成后区号码
 */
function generateBackZone(candidates: number[]): number[] {
  const backCandidates = candidates.filter(n => n >= 1 && n <= 12);
  if (backCandidates.length >= 2) {
    const shuffled = [...backCandidates].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2).sort((a, b) => a - b);
  }
  // 默认随机
  const set = new Set<number>();
  while (set.size < 2) {
    set.add(Math.floor(Math.random() * 12) + 1);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * 策略1：均衡型 - 3热2冷
 */
const balancedStrategy: LocalStrategy = {
  id: "balanced",
  name: "均衡型（本地）",
  description: "3热2冷搭配，稳健选号",
  generate: (history, targetSum, targetDiff) => {
    const hotFront = getHotNumbers(history, 15, 50, true);
    const coldFront = getColdNumbers(history, 15, true);
    const hotBack = getHotNumbers(history, 5, 30, false);
    const coldBack = getColdNumbers(history, 5, false);
    
    // 选择3热2冷
    const selectedHot = hotFront.slice(0, 3);
    const selectedCold = coldFront.slice(0, 2);
    const frontCandidates = [...new Set([...selectedHot, ...selectedCold, ...Array.from({length: 35}, (_, i) => i + 1)])];
    
    const front = generateFrontZone(frontCandidates, targetSum, targetDiff);
    const back = generateBackZone([hotBack[0], coldBack[0]].filter(Boolean));
    
    if (front) {
      return [[...front, ...back]];
    }
    return [[1, 8, 15, 22, 30, 5, 10]];
  }
};

/**
 * 策略2：热号追追 - 4热1冷
 */
const hotChasingStrategy: LocalStrategy = {
  id: "hot_chasing",
  name: "热号追追（本地）",
  description: "4热1冷，追趋势",
  generate: (history, targetSum, targetDiff) => {
    const hotFront = getHotNumbers(history, 20, 30, true);
    const coldFront = getColdNumbers(history, 5, true);
    const hotBack = getHotNumbers(history, 6, 20, false);
    
    // 选择4热1冷
    const selectedHot = hotFront.slice(0, 4);
    const selectedCold = coldFront.slice(0, 1);
    const frontCandidates = [...new Set([...selectedHot, ...selectedCold, ...Array.from({length: 35}, (_, i) => i + 1)])];
    
    const front = generateFrontZone(frontCandidates, targetSum, targetDiff);
    const back = generateBackZone(hotBack.slice(0, 2));
    
    if (front) {
      return [[...front, ...back]];
    }
    return [[1, 8, 15, 22, 30, 5, 10]];
  }
};

/**
 * 策略3：冷号反弹 - 2热3冷
 */
const coldReboundStrategy: LocalStrategy = {
  id: "cold_rebound",
  name: "冷号反弹（本地）",
  description: "2热3冷，博冷号回补",
  generate: (history, targetSum, targetDiff) => {
    const hotFront = getHotNumbers(history, 10, 100, true);
    const coldFront = getColdNumbers(history, 20, true);
    const coldBack = getColdNumbers(history, 8, false);
    
    // 选择2热3冷
    const selectedHot = hotFront.slice(0, 2);
    const selectedCold = coldFront.slice(0, 3);
    const frontCandidates = [...new Set([...selectedHot, ...selectedCold, ...Array.from({length: 35}, (_, i) => i + 1)])];
    
    const front = generateFrontZone(frontCandidates, targetSum, targetDiff);
    const back = generateBackZone(coldBack.slice(0, 2));
    
    if (front) {
      return [[...front, ...back]];
    }
    return [[1, 8, 15, 22, 30, 5, 10]];
  }
};

/**
 * 策略4：区间精准 - 纯数学约束
 */
const intervalFocusedStrategy: LocalStrategy = {
  id: "interval_focused",
  name: "区间精准（本地）",
  description: "严格数学约束",
  generate: (history, targetSum, targetDiff) => {
    // 纯随机选择，但尽量满足约束
    let best: number[] | null = null;
    let bestScore = Infinity;
    
    for (let i = 0; i < 100; i++) {
      const set = new Set<number>();
      while (set.size < 5) {
        set.add(Math.floor(Math.random() * 35) + 1);
      }
      const front = Array.from(set).sort((a, b) => a - b);
      
      const sum = front.reduce((a, b) => a + b, 0);
      const diff = front[4] - front[0];
      
      const score = Math.abs(sum - targetSum) + Math.abs(diff - targetDiff) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = front;
      }
    }
    
    const backSet = new Set<number>();
    while (backSet.size < 2) {
      backSet.add(Math.floor(Math.random() * 12) + 1);
    }
    const back = Array.from(backSet).sort((a, b) => a - b);
    
    if (best) {
      return [[...best, ...back]];
    }
    return [[1, 8, 15, 22, 30, 5, 10]];
  }
};

/**
 * 策略5：纯随机 - 对照组
 */
const pureRandomStrategy: LocalStrategy = {
  id: "pure_random",
  name: "纯随机（本地）",
  description: "纯随机选号",
  generate: () => {
    const frontSet = new Set<number>();
    while (frontSet.size < 5) {
      frontSet.add(Math.floor(Math.random() * 35) + 1);
    }
    const front = Array.from(frontSet).sort((a, b) => a - b);
    
    const backSet = new Set<number>();
    while (backSet.size < 2) {
      backSet.add(Math.floor(Math.random() * 12) + 1);
    }
    const back = Array.from(backSet).sort((a, b) => a - b);
    
    return [[...front, ...back]];
  }
};

/**
 * 所有本地策略
 */
export const LOCAL_STRATEGIES: LocalStrategy[] = [
  balancedStrategy,
  hotChasingStrategy,
  coldReboundStrategy,
  intervalFocusedStrategy,
  pureRandomStrategy
];

/**
 * 根据ID获取本地策略
 */
export function getLocalStrategyById(id: string): LocalStrategy {
  return LOCAL_STRATEGIES.find(s => s.id === id) || pureRandomStrategy;
}

/**
 * 快速运行 Walk-forward 测试（纯本地，无 API 调用）
 */
export function runLocalWalkForwardTest(
  history: LottoDraw[],
  strategyIds: string[],
  config: { testPeriods: number; windowSize: number; sampleInterval?: number }
) {
  const { testPeriods, windowSize, sampleInterval = 1 } = config;
  const results: {
    strategyId: string;
    strategyName: string;
    rounds: {
      drawId: string;
      predicted: number[][];
      actual: LottoDraw;
      bestPrize: string | null;
      matchCount: number;
      sumDeviation: number;
      diffDeviation: number;
    }[];
  }[] = [];

  for (const strategyId of strategyIds) {
    const strategy = getLocalStrategyById(strategyId);
    const rounds = [];
    
    const startIndex = Math.max(windowSize, history.length - testPeriods);
    const endIndex = history.length;

    for (let i = startIndex; i < endIndex; i += sampleInterval) {
      const knownHistory = history.slice(0, i);
      const actualDraw = history[i];
      
      // 计算目标约束
      const recentHistory = knownHistory.slice(-windowSize);
      const sums = recentHistory.map(d => d.front.reduce((a, b) => a + b, 0));
      const targetSum = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length) || 90;
      
      const ranges = recentHistory.map(d => {
        const max = Math.max(...d.front);
        const min = Math.min(...d.front);
        return max - min;
      });
      const targetDiff = Math.round(ranges.reduce((a, b) => a + b, 0) / ranges.length) || 24;
      
      // 本地生成预测
      const predicted = strategy.generate(knownHistory, targetSum, targetDiff);
      
      // 计算命中
      const front = predicted[0].slice(0, 5);
      const back = predicted[0].slice(5, 7);
      
      let bestPrize: string | null = null;
      const frontMatch = front.filter(n => actualDraw.front.includes(n)).length;
      const backMatch = back.filter(n => actualDraw.back.includes(n)).length;
      
      // 简化中奖判断（只判断是否命中任意奖）
      if (frontMatch >= 3 || (frontMatch >= 2 && backMatch >= 1) || backMatch === 2) {
        bestPrize = '9'; // 简化为九等奖及以上
      }
      
      const sum = front.reduce((a, b) => a + b, 0);
      const diff = Math.max(...front) - Math.min(...front);
      
      rounds.push({
        drawId: actualDraw.id,
        predicted,
        actual: actualDraw,
        bestPrize,
        matchCount: frontMatch + backMatch,
        sumDeviation: Math.abs(sum - targetSum),
        diffDeviation: Math.abs(diff - targetDiff)
      });
    }
    
    results.push({
      strategyId: strategy.id,
      strategyName: strategy.name,
      rounds
    });
  }

  return results;
}
