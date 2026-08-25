import { LottoDraw, AnalysisSummary } from "../types";
import { checkPrize } from "../utils";

const API_KEY = process.env.API_KEY;
const BASE_URL = "https://api.deepseek.com/v1/chat/completions";

let currentAbortController: AbortController | null = null;

interface AnalysisParams {
  sumMin: number;
  sumMax: number;
  rangeMin: number;
  rangeMax: number;
  consecutiveOptions: number[];
  frontRepeatOptions: number[];
  backRepeatOptions: number[];
  oddOptions: number[];
}

const findConsecutive = (numbers: number[]): { start: number; length: number }[] => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const consecutive: { start: number; length: number }[] = [];
  if (sorted.length === 0) return consecutive;
  
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

const getConsecutiveIndex = (numbers: number[]): number => {
  const consecutive = findConsecutive(numbers);
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

const countIntersection = (arr1: number[], arr2: number[]): number => {
  return arr1.filter(x => arr2.includes(x)).length;
};

const validateRecommendation = (rec: number[], params: AnalysisParams, history: LottoDraw[]): boolean => {
  if (rec.length !== 7) return false;
  
  const frontNums = rec.slice(0, 5);
  const backNums = rec.slice(5, 7);
  
  const sum = frontNums.reduce((a, b) => a + b, 0);
  if (sum < params.sumMin || sum > params.sumMax) return false;
  
  const range = Math.max(...frontNums) - Math.min(...frontNums);
  if (range < params.rangeMin || range > params.rangeMax) return false;
  
  const consecutiveIndex = getConsecutiveIndex(frontNums);
  if (params.consecutiveOptions.length > 0 && !params.consecutiveOptions.includes(consecutiveIndex)) {
    return false;
  }
  
  const oddCount = frontNums.filter(n => n % 2 !== 0).length;
  if (params.oddOptions.length > 0 && !params.oddOptions.includes(oddCount)) {
    return false;
  }
  
  if (history.length > 0) {
    const lastDraw = history[0];
    const frontRepeat = countIntersection(frontNums, lastDraw.front);
    const frontRepeatIndex = Math.min(frontRepeat, 4);
    if (params.frontRepeatOptions.length > 0 && !params.frontRepeatOptions.includes(frontRepeatIndex)) {
      return false;
    }
    
    const backRepeat = countIntersection(backNums, lastDraw.back);
    if (params.backRepeatOptions.length > 0 && !params.backRepeatOptions.includes(backRepeat)) {
      return false;
    }
    
    for (const draw of history) {
      const prizeTier = checkPrize(frontNums, backNums, draw);
      if (prizeTier === '1' || prizeTier === '2' || prizeTier === '3') {
        return false;
      }
    }
  }
  
  const frontUnique = new Set(frontNums).size === 5;
  const backUnique = new Set(backNums).size === 2;
  if (!frontUnique || !backUnique) return false;
  
  const frontValid = frontNums.every(n => n >= 1 && n <= 35);
  const backValid = backNums.every(n => n >= 1 && n <= 12);
  if (!frontValid || !backValid) return false;
  
  return true;
};

/**
 * 取消正在进行的 DeepSeek 请求
 * 用于页面隐藏或组件卸载时
 */
export const cancelDeepSeekRequest = (): void => {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
};

async function callDeepSeek(messages: any[], isJson: boolean = true, temperature: number = 0.7, signal?: AbortSignal): Promise<any> {
  if (!API_KEY) {
    throw new Error("DeepSeek API Key is not configured.");
  }

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: messages,
      response_format: isJson ? { type: "json_object" } : { type: "text" },
      temperature: temperature
    }),
    signal
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "DeepSeek API 调用失败");
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  return isJson ? JSON.parse(content) : content;
}

/**
 * 数据归一化工具：将各种可能的 AI 返回格式转换为 [f1,f2,f3,f4,f5,b1,b2] 的平铺数组
 */
function normalizeRecommendation(rec: any): number[] | null {
  try {
    // 1. 如果已经是 7 个数字的数组
    if (Array.isArray(rec) && rec.length === 7) return rec.map(Number);

    // 2. 如果是 {front: [5], back: [2]} 对象
    if (rec && typeof rec === 'object' && Array.isArray(rec.front) && Array.isArray(rec.back)) {
      return [...rec.front, ...rec.back].map(Number);
    }

    // 3. 尝试从混合数组中提取数字
    if (Array.isArray(rec)) {
      const nums = rec.flat().filter(n => typeof n === 'number' || !isNaN(Number(n))).map(Number);
      if (nums.length >= 7) return nums.slice(0, 7);
    }
  } catch (e) {
    console.error("Format error", e);
  }
  return null;
}

/**
 * 解析历史文本数据
 * 使用低温(0.2)确保解析准确性
 */
export const parseHistoryData = async (rawText: string): Promise<LottoDraw[]> => {
  const messages = [
    {
      role: "system",
      content: `你是彩票数据解析助手。将用户粘贴的开奖文本解析为结构化JSON。

规则：
1. 期号(id)：保持原文，如"24001"或"2024-001"
2. 日期(date)：统一格式为YYYY-MM-DD，如无法识别则使用""
3. 前区(front)：5个数字，1-35，去重后升序
4. 后区(back)：2个数字，1-12，去重后升序
5. 如果一行数据不完整，跳过该行

输出格式：[{"id": "...", "date": "...", "front": [...], "back": [...]}]`
    },
    {
      role: "user",
      content: `解析以下数据（最多5000字符）：\n${rawText.slice(0, 5000)}`
    }
  ];

  try {
    // 使用低温确保解析准确性
    const data = await callDeepSeek(messages, true, 0.2);
    return Array.isArray(data) ? data : (data.data || []);
  } catch (e) {
    console.error("DeepSeek Parsing error", e);
    return [];
  }
};

export const getSmartAnalysis = async (
  history: LottoDraw[],
  sumMin: number,
  sumMax: number,
  rangeMin: number,
  rangeMax: number,
  consecutiveOptions: number[],
  frontRepeatOptions: number[],
  backRepeatOptions: number[],
  oddOptions: number[],
  count: number = 1,
  signal?: AbortSignal
): Promise<AnalysisSummary> => {
  cancelDeepSeekRequest();
  
  const controller = new AbortController();
  currentAbortController = controller;
  
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  const params: AnalysisParams = {
    sumMin,
    sumMax,
    rangeMin,
    rangeMax,
    consecutiveOptions,
    frontRepeatOptions,
    backRepeatOptions,
    oddOptions
  };

  const simplifiedHistory = history.slice(0, 500).map(h => 
    `${h.id}:${h.front.join(',')}+${h.back.join(',')}`
  ).join('\n');

  const consecutiveLabels: Record<number, string> = {
    0: '0连号',
    1: '1个2连号',
    2: '2个2连号',
    3: '1个3连号',
    4: '1个4连号',
    5: '1个5连号'
  };

  const frontRepeatLabels: Record<number, string> = {
    0: '0重号',
    1: '1重号',
    2: '2重号',
    3: '3重号',
    4: '4重号'
  };

  const backRepeatLabels: Record<number, string> = {
    0: '0重号',
    1: '1重号',
    2: '2重号'
  };

  const oddLabels: Record<number, string> = {
    0: '0奇数',
    1: '1奇数',
    2: '2奇数',
    3: '3奇数',
    4: '4奇数',
    5: '5奇数'
  };

  const finalRecs: number[][] = [];
  let attempts = 0;
  const maxAttempts = 50;

  while (finalRecs.length < count && attempts < maxAttempts) {
    attempts++;
    
    const needMore = count - finalRecs.length;
    
    const consecutiveStr = consecutiveOptions.length > 0 
      ? consecutiveOptions.map(i => consecutiveLabels[i]).join('、') 
      : '无限制';
    const frontRepeatStr = frontRepeatOptions.length > 0 
      ? frontRepeatOptions.map(i => frontRepeatLabels[i]).join('、') 
      : '无限制';
    const backRepeatStr = backRepeatOptions.length > 0 
      ? backRepeatOptions.map(i => backRepeatLabels[i]).join('、') 
      : '无限制';
    const oddStr = oddOptions.length > 0 
      ? oddOptions.map(i => oddLabels[i]).join('、') 
      : '无限制';

    const messages = [
      {
        role: "system",
        content: `你是大乐透数据分析专家。请基于历史数据统计，结合用户指定的约束条件，生成符合规则的号码组合。

你必须以 JSON 格式输出结果，格式如下：
{
  "recommendations": [[f1,f2,f3,f4,f5,b1,b2], ...]
}

要求：
1. 必须返回有效的 JSON 对象
2. recommendations 必须是数组的数组，每组7个整数
3. 前区号码范围：1-35，不重复，升序排列
4. 后区号码范围：1-12，不重复，升序排列
5. 严格满足用户指定的约束条件`
      },
      {
        role: "user",
        content: `请生成 ${needMore} 组号码，约束条件如下：

【前区和值范围】${sumMin} - ${sumMax}
【前区极差范围】${rangeMin} - ${rangeMax}

【连号规则】${consecutiveStr}
- 0连号：无连续数字
- 1个2连号：有一组连续2个数字
- 2个2连号：有两组连续2个数字
- 1个3连号：有一组连续3个数字
- 1个4连号：有一组连续4个数字
- 1个5连号：有一组连续5个数字

【前区重号规则】${frontRepeatStr}
- 0重号：与上一期前区无重复数字
- 1重号：与上一期前区有1个重复数字
- 2重号：与上一期前区有2个重复数字
- 3重号：与上一期前区有3个重复数字
- 4重号：与上一期前区有4个重复数字

【后区重号规则】${backRepeatStr}
- 0重号：与上一期后区无重复数字
- 1重号：与上一期后区有1个重复数字
- 2重号：与上一期后区有2个重复数字

【前区奇数规则】${oddStr}
- 0奇数：前区5个号码全是偶数
- 1奇数：前区有1个奇数、4个偶数
- 2奇数：前区有2个奇数、3个偶数
- 3奇数：前区有3个奇数、2个偶数
- 4奇数：前区有4个奇数、1个偶数
- 5奇数：前区5个号码全是奇数

【选号策略建议】
- 前区：采用"冷号反扑"策略，3个近期热号 + 2个冷号
- 后区：1热1冷搭配，或2个中等频率号码
- 避免全奇全偶、全大全小的极端组合

【历史数据统计-近500期】
${simplifiedHistory}

【重要】
- 必须严格满足所有约束条件
- 不要虚构历史数据

【示例 JSON 输出】
{
  "recommendations": [[3,11,15,22,31,5,9], [8,14,19,26,33,2,10]]
}`
      }
    ];

    try {
      const result = await callDeepSeek(messages, true, 0.7, controller.signal);

      let rawRecs = result.recommendations || [];
      if (!Array.isArray(rawRecs)) rawRecs = [rawRecs];

      const normalizedRecs = rawRecs
        .map(normalizeRecommendation)
        .filter((r): r is number[] => r !== null && r.length === 7);

      for (const rec of normalizedRecs) {
        if (finalRecs.length >= count) break;
        if (validateRecommendation(rec, params, history)) {
          finalRecs.push(rec);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('DeepSeek 请求已被取消');
        throw new Error('请求已取消');
      }
      console.error("DeepSeek Analysis error", e);
      throw e;
    }
  }

  if (currentAbortController === controller) {
    currentAbortController = null;
  }

  const defaultRec = [[1, 8, 15, 22, 30, 5, 10]];
  
  return {
    hotNumbers: [],
    coldNumbers: [],
    recommendations: finalRecs.length > 0 ? finalRecs : defaultRec,
    explanation: ''
  };
};
