
import { LottoDraw } from "../types";

export interface StrategyParams {
  history: LottoDraw[];
  predictedSum: number;
  predictedDiff: number;
  count: number;
}

export interface PromptStrategy {
  id: string;
  name: string;
  description: string;
  temperature: number;
  buildPrompt: (params: StrategyParams) => string;
}

/**
 * 策略A：均衡型 - 热冷搭配，稳健为主
 * 当前默认策略，追求热号和冷号的平衡
 */
const balancedStrategy: PromptStrategy = {
  id: "balanced",
  name: "均衡型",
  description: "3热2冷搭配，稳健选号",
  temperature: 0.7,
  buildPrompt: ({ history, predictedSum, predictedDiff, count }) => {
    const simplifiedHistory = history.slice(0, 300).map(h => 
      `${h.id}:${h.front.join(',')}+${h.back.join(',')}`
    ).join('\n');

    return `你是大乐透数据分析专家。请基于历史数据统计，生成符合规则的号码组合。

【数学约束-必须满足】
1. 每组前区和值 ∈ [${predictedSum - 3}, ${predictedSum + 3}]
2. 每组前区极差 ∈ [${predictedDiff - 1}, ${predictedDiff + 1}]
3. 号码不重复，前区升序，后区升序

【选号策略-均衡型】
- 前区：3个近期热号 + 2个遗漏值>15的冷号
- 后区：1热1冷搭配
- 避免全奇全偶、全大全小的极端组合
- 兼顾连号可能性（适当保留相邻号码）

【历史数据-近300期】
${simplifiedHistory}

请以JSON格式输出 ${count} 组号码：
{
  "recommendations": [[f1,f2,f3,f4,f5,b1,b2], ...],
  "reasoning": "简要说明选号逻辑"
}`;
  }
};

/**
 * 策略B：热号追追 - 顺势而为
 * 高比例热号，追近期趋势
 */
const hotChasingStrategy: PromptStrategy = {
  id: "hot_chasing",
  name: "热号追追",
  description: "4热1冷，顺势而为",
  temperature: 0.6,
  buildPrompt: ({ history, predictedSum, predictedDiff, count }) => {
    const simplifiedHistory = history.slice(0, 100).map(h => 
      `${h.id}:${h.front.join(',')}+${h.back.join(',')}`
    ).join('\n');

    return `你是大乐透趋势跟踪专家。近期热号更容易重复出现，请重点追逐热号。

【数学约束-必须满足】
1. 每组前区和值 ∈ [${predictedSum - 3}, ${predictedSum + 3}]
2. 每组前区极差 ∈ [${predictedDiff - 1}, ${predictedDiff + 1}]
3. 号码不重复，前区升序，后区升序

【选号策略-热号追追】
- 前区：4个最近50期高频热号 + 1个中等频率号码
- 后区：优先选择最近30期出现频率最高的2个号码
- 重点关注：重号（与上期相同的号码）
- 避免选择：遗漏值>20的冷号

【近期数据-近100期】
${simplifiedHistory}

请以JSON格式输出 ${count} 组号码：
{
  "recommendations": [[f1,f2,f3,f4,f5,b1,b2], ...],
  "reasoning": "简要说明选号逻辑"
}`;
  }
};

/**
 * 策略C：冷号反弹 - 博冷号回补
 * 高比例冷号，博长期未出的号码反弹
 */
const coldReboundStrategy: PromptStrategy = {
  id: "cold_rebound",
  name: "冷号反弹",
  description: "2热3冷，博冷号回补",
  temperature: 0.8,
  buildPrompt: ({ history, predictedSum, predictedDiff, count }) => {
    const simplifiedHistory = history.slice(0, 500).map(h => 
      `${h.id}:${h.front.join(',')}+${h.back.join(',')}`
    ).join('\n');

    return `你是大乐透冷门捕捉专家。长期未出的冷号即将反弹，请重点选择冷号。

【数学约束-必须满足】
1. 每组前区和值 ∈ [${predictedSum - 3}, ${predictedSum + 3}]
2. 每组前区极差 ∈ [${predictedDiff - 1}, ${predictedDiff + 1}]
3. 号码不重复，前区升序，后区升序

【选号策略-冷号反弹】
- 前区：2个近期热号（保底）+ 3个遗漏值>20的冷号
- 后区：优先选择遗漏值>15的冷号，最多1个热号
- 重点关注：遗漏值25-40期的"极冷号"即将反弹
- 避免选择：最近10期刚出过的号码（除非必须满足约束）

【历史数据-近500期】
${simplifiedHistory}

请以JSON格式输出 ${count} 组号码：
{
  "recommendations": [[f1,f2,f3,f4,f5,b1,b2], ...],
  "reasoning": "简要说明选号逻辑"
}`;
  }
};

/**
 * 策略D：区间精准 - 数学优先
 * 严格约束和值极差，其他随机
 */
const intervalFocusedStrategy: PromptStrategy = {
  id: "interval_focused",
  name: "区间精准",
  description: "严格数学约束，号码随机",
  temperature: 0.9,
  buildPrompt: ({ history, predictedSum, predictedDiff, count }) => {
    return `你是数学优化专家。请在严格满足和值和极差约束的前提下，随机均匀选择号码。

【核心约束-必须严格满足】
1. 每组前区和值 = ${predictedSum}（允许±2误差）
2. 每组前区极差 = ${predictedDiff}（允许±1误差）
3. 号码不重复，前区升序 1-35，后区升序 1-12

【选号策略-数学优先】
- 前区：在满足和值和极差约束的前提下，尽可能均匀分布
- 不刻意追热号或冷号，纯随机选择
- 避免明显的模式（如等差数列）
- 后区：随机选择，不参考历史

【生成要求】
先生成一个满足和值和极差约束的前区组合，然后随机选择后区。
如果不存在满足约束的组合，返回最接近的并说明偏差。

请以JSON格式输出 ${count} 组号码：
{
  "recommendations": [[f1,f2,f3,f4,f5,b1,b2], ...],
  "reasoning": "简要说明如何满足约束"
}`;
  }
};

/**
 * 策略E：全随机 - 对照组
 * 纯随机选号，仅范围约束
 */
const pureRandomStrategy: PromptStrategy = {
  id: "pure_random",
  name: "纯随机",
  description: "对照组，纯随机选号",
  temperature: 1.0,
  buildPrompt: ({ count }) => {
    return `请随机生成大乐透号码。

【基本规则】
1. 前区：1-35 选5个不重复数字，升序排列
2. 后区：1-12 选2个不重复数字，升序排列
3. 完全随机选择，不要参考任何历史数据或模式

请以JSON格式输出 ${count} 组号码：
{
  "recommendations": [[f1,f2,f3,f4,f5,b1,b2], ...],
  "reasoning": "随机生成"
}`;
  }
};

/**
 * 所有可用策略
 */
export const PROMPT_STRATEGIES: PromptStrategy[] = [
  balancedStrategy,
  hotChasingStrategy,
  coldReboundStrategy,
  intervalFocusedStrategy,
  pureRandomStrategy
];

/**
 * 根据ID获取策略
 */
export function getStrategyById(id: string): PromptStrategy {
  return PROMPT_STRATEGIES.find(s => s.id === id) || balancedStrategy;
}
