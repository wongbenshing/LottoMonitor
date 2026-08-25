
import { LottoDraw, PrizeResult } from "../types";
import { checkPrize } from "../utils";
import { PromptStrategy, StrategyParams, getStrategyById } from "./promptStrategies";

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.deepseek.com/chat/completions";

/**
 * Walk-forward 单轮测试结果
 */
export interface WalkForwardRound {
  round: number;              // 轮次
  drawId: string;             // 验证期号
  predicted: number[][];      // 预测号码（多组）
  actual: LottoDraw;          // 实际开奖
  bestPrize: string | null;   // 最佳中奖等级
  matchCount: number;         // 最高命中号码数
  sumDeviation: number;       // 和值偏差
  diffDeviation: number;      // 极差偏差
}

/**
 * 策略评估报告
 */
export interface StrategyEvaluation {
  strategyId: string;
  strategyName: string;
  totalRounds: number;                    // 总测试轮数
  winCount: number;                       // 中奖轮数（任意奖项）
  winRate: string;                        // 中奖率
  prizeDistribution: { tier: string; name: string; count: number }[];
  avgSumDeviation: number;                // 平均和值偏差
  avgDiffDeviation: number;               // 平均极差偏差
  bestRound: WalkForwardRound | null;     // 最佳表现轮次
  rounds: WalkForwardRound[];             // 所有轮次详情
}

/**
 * 对比报告
 */
export interface StrategyComparison {
  timestamp: number;
  testPeriods: number;
  windowSize: number;
  evaluations: StrategyEvaluation[];
  winner: string;  // 最佳策略ID
}

/**
 * 调用 DeepSeek API（指定策略）
 */
async function callDeepSeekWithStrategy(
  strategy: PromptStrategy, 
  params: StrategyParams
): Promise<number[][]> {
  if (!API_KEY) {
    throw new Error("DeepSeek API Key is not configured.");
  }

  const prompt = strategy.buildPrompt(params);

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-reasoner",
      messages: [
        { role: "system", content: "你是彩票选号助手，必须以JSON格式返回结果。" },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: strategy.temperature
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "API 调用失败");
  }

  const data = await response.json();
  const result = JSON.parse(data.choices[0].message.content);
  
  // 标准化结果
  const recommendations = result.recommendations || [];
  return recommendations
    .filter((rec: any) => Array.isArray(rec) && rec.length === 7)
    .map((rec: number[]) => rec.map(Number));
}

/**
 * 单轮 Walk-forward 测试
 */
async function runSingleRound(
  history: LottoDraw[],
  testIndex: number,
  strategy: PromptStrategy,
  predictedSum: number,
  predictedDiff: number
): Promise<WalkForwardRound> {
  // "当时"知道的历史（不包含当期及之后）
  const knownHistory = history.slice(0, testIndex);
  const actualDraw = history[testIndex];

  // 生成预测（每组策略只生成1组号码用于快速对比）
  const predictions = await callDeepSeekWithStrategy(strategy, {
    history: knownHistory,
    predictedSum,
    predictedDiff,
    count: 1
  });

  const predicted = predictions.length > 0 ? predictions : [[1, 8, 15, 22, 30, 5, 10]];

  // 验证结果（取多组中的最佳表现）
  let bestPrize: string | null = null;
  let bestMatchCount = 0;
  let bestSumDev = Infinity;
  let bestDiffDev = Infinity;

  for (const rec of predicted) {
    const front = rec.slice(0, 5);
    const back = rec.slice(5, 7);
    
    // 检查中奖
    const prize = checkPrize(front, back, actualDraw);
    
    // 计算命中数
    const frontMatch = front.filter(n => actualDraw.front.includes(n)).length;
    const backMatch = back.filter(n => actualDraw.back.includes(n)).length;
    const totalMatch = frontMatch + backMatch;
    
    // 计算偏差
    const sum = front.reduce((a, b) => a + b, 0);
    const diff = Math.max(...front) - Math.min(...front);
    const sumDev = Math.abs(sum - predictedSum);
    const diffDev = Math.abs(diff - predictedDiff);

    // 记录最佳
    if (!bestPrize || (prize && parseInt(prize) < parseInt(bestPrize))) {
      bestPrize = prize;
    }
    if (totalMatch > bestMatchCount) {
      bestMatchCount = totalMatch;
      bestSumDev = sumDev;
      bestDiffDev = diffDev;
    }
  }

  return {
    round: testIndex,
    drawId: actualDraw.id,
    predicted,
    actual: actualDraw,
    bestPrize,
    matchCount: bestMatchCount,
    sumDeviation: bestSumDev,
    diffDeviation: bestDiffDev
  };
}

/**
 * 评估单个策略
 */
async function evaluateStrategy(
  history: LottoDraw[],
  strategy: PromptStrategy,
  config: { testPeriods: number; windowSize: number; onProgress?: (p: number) => void }
): Promise<StrategyEvaluation> {
  const { testPeriods, windowSize, onProgress } = config;
  const rounds: WalkForwardRound[] = [];
  
  // 使用最新的数据进行测试
  const endIndex = history.length;
  const startIndex = Math.max(windowSize, endIndex - testPeriods);

  for (let i = startIndex; i < endIndex; i++) {
    // 计算当前和值极差预测（使用简单均值）
    const recentHistory = history.slice(Math.max(0, i - windowSize), i);
    const sums = recentHistory.map(d => d.front.reduce((a, b) => a + b, 0));
    const predictedSum = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length);
    
    const ranges = recentHistory.map(d => {
      const max = Math.max(...d.front);
      const min = Math.min(...d.front);
      return max - min;
    });
    const predictedDiff = Math.round(ranges.reduce((a, b) => a + b, 0) / ranges.length);

    // 运行单轮测试
    const round = await runSingleRound(history, i, strategy, predictedSum, predictedDiff);
    rounds.push(round);

    // 进度回调
    if (onProgress) {
      onProgress(Math.round((i - startIndex) / (endIndex - startIndex) * 100));
    }

    // 添加延迟避免 API 限流
    if (i < endIndex - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 统计汇总
  const winCount = rounds.filter(r => r.bestPrize !== null).length;
  const avgSumDev = rounds.reduce((s, r) => s + r.sumDeviation, 0) / rounds.length;
  const avgDiffDev = rounds.reduce((s, r) => s + r.diffDeviation, 0) / rounds.length;
  
  const prizeTiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const prizeNames = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖'];
  
  const prizeDistribution = prizeTiers.map((tier, idx) => ({
    tier,
    name: prizeNames[idx],
    count: rounds.filter(r => r.bestPrize === tier).length
  }));

  const bestRound = rounds.reduce((best, r) => {
    if (!best) return r;
    if (!r.bestPrize) return best;
    if (!best.bestPrize) return r;
    return parseInt(r.bestPrize) < parseInt(best.bestPrize) ? r : best;
  }, null as WalkForwardRound | null);

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    totalRounds: rounds.length,
    winCount,
    winRate: ((winCount / rounds.length) * 100).toFixed(1) + '%',
    prizeDistribution,
    avgSumDeviation: Math.round(avgSumDev * 10) / 10,
    avgDiffDeviation: Math.round(avgDiffDev * 10) / 10,
    bestRound,
    rounds
  };
}

/**
 * 运行策略对比测试
 */
export async function runStrategyComparison(
  history: LottoDraw[],
  strategyIds: string[],
  config: { 
    testPeriods: number; 
    windowSize: number;
    onProgress?: (strategy: string, progress: number) => void;
  }
): Promise<StrategyComparison> {
  const strategies = strategyIds.map(id => getStrategyById(id));
  const evaluations: StrategyEvaluation[] = [];

  for (const strategy of strategies) {
    if (config.onProgress) {
      config.onProgress(strategy.name, 0);
    }

    const evaluation = await evaluateStrategy(history, strategy, {
      testPeriods: config.testPeriods,
      windowSize: config.windowSize,
      onProgress: (p) => config.onProgress?.(strategy.name, p)
    });

    evaluations.push(evaluation);
  }

  // 确定最佳策略（按中奖率排序，相同则按平均和值偏差排序）
  const winner = evaluations
    .sort((a, b) => {
      const winRateDiff = parseFloat(b.winRate) - parseFloat(a.winRate);
      if (winRateDiff !== 0) return winRateDiff;
      return a.avgSumDeviation - b.avgSumDeviation;
    })[0]?.strategyId || 'balanced';

  return {
    timestamp: Date.now(),
    testPeriods: config.testPeriods,
    windowSize: config.windowSize,
    evaluations,
    winner
  };
}

/**
 * 模拟纯随机策略（本地计算，不调用 API）
 */
export function simulateRandomStrategy(
  history: LottoDraw[],
  testPeriods: number
): StrategyEvaluation {
  const rounds: WalkForwardRound[] = [];
  const startIndex = Math.max(100, history.length - testPeriods);

  for (let i = startIndex; i < history.length; i++) {
    const actualDraw = history[i];
    
    // 生成随机号码
    const front = new Set<number>();
    while (front.size < 5) {
      front.add(Math.floor(Math.random() * 35) + 1);
    }
    const back = new Set<number>();
    while (back.size < 2) {
      back.add(Math.floor(Math.random() * 12) + 1);
    }
    
    const predicted = [[...Array.from(front).sort((a, b) => a - b), ...Array.from(back).sort((a, b) => a - b)]];
    const prize = checkPrize(predicted[0].slice(0, 5), predicted[0].slice(5, 7), actualDraw);
    
    const frontMatch = predicted[0].slice(0, 5).filter(n => actualDraw.front.includes(n)).length;
    const backMatch = predicted[0].slice(5, 7).filter(n => actualDraw.back.includes(n)).length;

    rounds.push({
      round: i,
      drawId: actualDraw.id,
      predicted,
      actual: actualDraw,
      bestPrize: prize,
      matchCount: frontMatch + backMatch,
      sumDeviation: 0,
      diffDeviation: 0
    });
  }

  const winCount = rounds.filter(r => r.bestPrize !== null).length;
  const prizeTiers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const prizeNames = ['一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖'];

  return {
    strategyId: 'pure_random',
    strategyName: '纯随机（模拟）',
    totalRounds: rounds.length,
    winCount,
    winRate: ((winCount / rounds.length) * 100).toFixed(1) + '%',
    prizeDistribution: prizeTiers.map((tier, idx) => ({
      tier,
      name: prizeNames[idx],
      count: rounds.filter(r => r.bestPrize === tier).length
    })),
    avgSumDeviation: 0,
    avgDiffDeviation: 0,
    bestRound: null,
    rounds
  };
}
