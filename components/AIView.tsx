
import React, { useState, useEffect } from 'react';
import { LottoDraw, AnalysisSummary } from '../types';
import { getSmartAnalysis } from '../services/geminiService';

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
             <p className="text-indigo-100 animate-pulse">正在深度分析历史规律...</p>
          </div>
        ) : analysis ? (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
              <p className="text-xs font-bold text-indigo-200 mb-3 uppercase tracking-wider">推荐组合 (5+2)</p>
              <div className="flex gap-2 justify-center">
                {analysis.recommendation.slice(0, 5).map((n, i) => (
                  <div key={i} className="w-10 h-10 bg-white text-indigo-700 font-black rounded-full flex items-center justify-center shadow-lg">
                    {n.toString().padStart(2, '0')}
                  </div>
                ))}
                <div className="w-px h-8 bg-white/30 self-center"></div>
                {analysis.recommendation.slice(5).map((n, i) => (
                  <div key={i} className="w-10 h-10 bg-yellow-400 text-yellow-900 font-black rounded-full flex items-center justify-center shadow-lg">
                    {n.toString().padStart(2, '0')}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-indigo-100">深度趋势分析</h4>
              <p className="text-sm leading-relaxed text-indigo-50">
                {analysis.explanation}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-3 rounded-xl">
                <p className="text-[10px] text-indigo-200 mb-1 uppercase">近期热号</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.hotNumbers.map(n => <span key={n} className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded">{n}</span>)}
                </div>
              </div>
              <div className="bg-white/10 p-3 rounded-xl">
                <p className="text-[10px] text-indigo-200 mb-1 uppercase">近期冷号</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.coldNumbers.map(n => <span key={n} className="text-xs font-bold bg-white/20 px-1.5 py-0.5 rounded">{n}</span>)}
                </div>
              </div>
            </div>

            <button 
              onClick={performAnalysis}
              className="w-full py-3 bg-white text-indigo-600 rounded-2xl font-bold shadow-lg hover:bg-indigo-50 transition-colors"
            >
              重新分析趋势
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-indigo-100">暂无分析数据，请尝试点击下方按钮</p>
            <button onClick={performAnalysis} className="mt-4 px-6 py-2 bg-white text-indigo-600 rounded-xl font-bold">开始分析</button>
          </div>
        )}
      </div>

      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
        <div className="flex gap-3">
          <span className="text-amber-500 text-lg">💡</span>
          <div>
            <h4 className="font-bold text-amber-800 text-sm">专家贴士</h4>
            <p className="text-xs text-amber-700 mt-1 leading-relaxed">
              彩票开奖是随机事件。AI分析仅基于历史频率和数学规律，不能保证中奖。请保持理性，小额投注，享受乐趣。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIView;
