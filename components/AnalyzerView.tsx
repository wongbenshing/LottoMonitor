
import React, { useState, useMemo } from 'react';
import { LottoDraw, PrizeResult } from '../types';
import { calculateHistoricalPrizes } from '../utils';

interface Props {
  history: LottoDraw[];
}

const AnalyzerView: React.FC<Props> = ({ history }) => {
  const [front, setFront] = useState<string[]>(['', '', '', '', '']);
  const [back, setBack] = useState<string[]>(['', '']);
  const [results, setResults] = useState<PrizeResult[] | null>(null);

  const isFormValid = useMemo(() => {
    const fNums = front.map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= 35);
    const bNums = back.map(n => parseInt(n)).filter(n => !isNaN(n) && n >= 1 && n <= 12);
    return fNums.length === 5 && bNums.length === 2 && new Set(fNums).size === 5 && new Set(bNums).size === 2;
  }, [front, back]);

  const handleAnalyze = () => {
    if (!isFormValid) return;
    const fNums = front.map(n => parseInt(n)).sort((a, b) => a - b);
    const bNums = back.map(n => parseInt(n)).sort((a, b) => a - b);
    const analysis = calculateHistoricalPrizes(fNums, bNums, history);
    setResults(analysis);
  };

  const updateFront = (idx: number, val: string) => {
    const next = [...front];
    next[idx] = val.replace(/\D/g, '').slice(0, 2);
    setFront(next);
  };

  const updateBack = (idx: number, val: string) => {
    const next = [...back];
    next[idx] = val.replace(/\D/g, '').slice(0, 2);
    setBack(next);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          号码历史回测
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">前区号码 (01-35)</label>
            <div className="flex gap-2">
              {front.map((val, i) => (
                <input
                  key={i}
                  type="tel"
                  className="w-12 h-12 text-center text-lg font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-red-600 bg-red-50/30"
                  value={val}
                  placeholder="00"
                  onChange={(e) => updateFront(i, e.target.value)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 uppercase mb-2 block">后区号码 (01-12)</label>
            <div className="flex gap-2">
              {back.map((val, i) => (
                <input
                  key={i}
                  type="tel"
                  className="w-12 h-12 text-center text-lg font-bold border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-blue-600 bg-blue-50/30"
                  value={val}
                  placeholder="00"
                  onChange={(e) => updateBack(i, e.target.value)}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!isFormValid}
            className={`w-full py-3.5 rounded-2xl font-bold text-white shadow-lg transition-all ${isFormValid ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-[1.02] active:scale-[0.98]' : 'bg-slate-300'}`}
          >
            开始回测
          </button>
        </div>
      </div>

      {results && (
        <div className="space-y-3 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
             <h4 className="font-bold text-slate-700">回测结果统计</h4>
             <span className="text-xs text-slate-400">在 {history.length} 期开奖中</span>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {results.filter(r => r.count > 0).length === 0 ? (
              <div className="bg-white p-8 text-center rounded-2xl border border-slate-100">
                <p className="text-slate-400">这组号码在历史中从未中奖</p>
              </div>
            ) : (
              results.map((res) => res.count > 0 && (
                <div key={res.tier} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-l-blue-500 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-bold text-slate-800">{res.name}</h5>
                      <p className="text-xs text-slate-500 mt-1">历史中奖次数: <span className="text-blue-600 font-bold">{res.count}</span> 次</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded uppercase font-bold text-slate-400">最近日期</span>
                      <p className="text-xs font-medium text-slate-600 mt-1">{res.dates[0]}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyzerView;
