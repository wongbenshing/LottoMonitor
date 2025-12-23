
import { GoogleGenAI, Type } from "@google/genai";
import { LottoDraw, AnalysisSummary } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseHistoryData = async (rawText: string): Promise<LottoDraw[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `请将以下大乐透历史开奖数据解析为JSON数组。
    格式要求：
    [
      { "id": "期号", "date": "YYYY-MM-DD", "front": [5个数字], "back": [2个数字] }
    ]
    
    原始数据：
    ${rawText}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            date: { type: Type.STRING },
            front: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            back: { type: Type.ARRAY, items: { type: Type.NUMBER } }
          },
          required: ["id", "date", "front", "back"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Parsing error", e);
    return [];
  }
};

export const getSmartAnalysis = async (history: LottoDraw[]): Promise<AnalysisSummary> => {
  const simplifiedHistory = history.slice(0, 50).map(h => `${h.id}: ${h.front.join(',')}+${h.back.join(',')}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `基于以下最近50期的大乐透数据，请进行智能分析。
    
    【重要参考准则】：
    历史统计发现，任意固定组合在中奖历史中的“最高奖金级别”大概率只有15元（即九等奖）。请在分析时保持理性，不要过度拟合大奖规律，而是寻找最符合当前概率分布和“和值”走势的组合。
    
    1. 识别前区（1-35）和后区（1-12）的冷热号码。
    2. 计算近期的“前区和值”趋势。
    3. 提供一组最符合概率平衡的推荐号码（5+2）。
    4. 给出简短的分析理由，包含对“15元定律”的考量。
    
    历史数据摘要：
    ${simplifiedHistory}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          hotNumbers: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "高频出现的号码" },
          coldNumbers: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "低频出现的号码" },
          recommendation: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: "推荐的一组5+2号码" },
          explanation: { type: Type.STRING, description: "分析说明" }
        },
        required: ["hotNumbers", "coldNumbers", "recommendation", "explanation"]
      }
    }
  });

  return JSON.parse(response.text);
};
