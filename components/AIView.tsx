
import React, { useState, useEffect, useMemo } from 'react';
import { LottoDraw, AnalysisSummary, PrizeResult } from '../types';
import { getSmartAnalysis } from '../services/geminiService';
import { calculateHistoricalPrizes } from '../utils';

interface Props {
  history: LottoDraw[];
}

const AIView: React.FC<Props> = ({ history }) => {
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const performAnalysis = async () => {
    if (history.length === 0) return;
    setLoading(true);
    try {
      const res = await getSmartAnalysis(history);
      setAnalysis(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const recommendationBacktest = useMemo(() => {
    if (!analysis || history.length === 0) return null;
    const fNums = analysis.recommendation.slice(0, 5).sort((a, b) => a - b);
    const bNums = analysis.recommendation.slice(5, 7).sort((a, b) => a - b);
    const results = calculateHistoricalPrizes(fNums, bNums, history);
    return results.filter(r => r.count > 0);
  }, [analysis, history]);

  useEffect(() => {
    if (!analysis && history.length > 0) {
      performAnalysis();
    }
  }, [history]);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/20 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h2 className="text-xl font-bold">AI 智能选号建议</h2>
        </div>
        
        {loading ? (
          <div className="py-8 flex flex-col items-center gap-4">
             <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
             <p className="text-indigo-100 animate-pulse">正在根据历史规律测算推荐组合...</p>
          </div>
        ) : analysis ? (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
              <p className="text-xs font-bold text-indigo-200 mb-3 uppercase tracking-wider text-center">推荐组合 (5+2)</p>
              <div className="flex gap-2 justify-center">
                {analysis.recommendation.slice(0, 5).map((n, i) => (
                  <div key={i} className="w-10 h-10 bg-white text-indigo-700 font-black rounded-full flex items-center justify-center shadow-lg text-sm">
                    {n.toString().padStart(2, '0')}
                  </div>
                ))}
                <div className="w-px h-8 bg-white/30 self-center"></div>
                {analysis.recommendation.slice(5).map((n, i) => (
                  <div key={i} className="w-10 h-10 bg-yellow-400 text-yellow-900 font-black rounded-full flex items-center justify-center shadow-lg text-sm">
                    {n.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>

              {/* Backtest Results Inline */}
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-[10px] font-bold text-indigo-200 mb-3 uppercase tracking-wider">该组合历史中奖情况</p>
                {recommendationBacktest && recommendationBacktest.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {recommendationBacktest.map(res => (
                      <div key={res.tier} className="bg-white/10 px-3 py-2 rounded-xl flex justify-between items-center">
                        <span className="text-[10px] font-bold">{res.name}</span>
                        <span className="text-xs font-black text-yellow-300">{res.count}次</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-indigo-300 italic text-center">该推荐组合在历史上尚未中过奖，属于全新组合</p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-indigo-100">AI 分析逻辑</h4>
              <p className="text-sm leading-relaxed text-indigo-50">
                {analysis.explanation}
              </p>
            </div>

            <button 
              onClick={performAnalysis}
              className="w-full py-3 bg-white text-indigo-600 rounded-2xl font-bold shadow-lg hover:bg-indigo-50 active:scale-95 transition-all"
            >
              换一组分析
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <button onClick={performAnalysis} className="px-6 py-2 bg-white text-indigo-600 rounded-xl font-bold shadow-lg">启动 AI 分析</button>
          </div>
        )}
      </div>

      <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
        <div className="flex gap-3">
          <span className="text-red-500 text-lg">⚠️</span>
          <div>
            <h4 className="font-bold text-red-800 text-sm">谨慎参考提示</h4>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              本工具生成的推荐组合仅供娱乐与研究参考，AI 模型基于历史规律进行概率计算，不代表任何形式的中奖保证。彩票开奖具有完全的随机性，请量力而行，理性投注。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIView;
