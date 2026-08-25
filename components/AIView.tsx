import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LottoDraw, AnalysisSummary } from '../types';
import { getSmartAnalysis, cancelDeepSeekRequest } from '../services/deepseekService';
import { calculateHistoricalPrizes, calculateTransitionResult, calculateRangeTransitionResult, calculateConsecutiveTransitionResult, calculateFrontRepeatTransitionResult, calculateBackRepeatTransitionResult, calculateOddTransitionResult, findConsecutive, countIntersection, countOdd } from '../utils';
import { PredictionResult } from '../types';
import * as htmlToImage from 'html-to-image';

interface Props {
  history: LottoDraw[];
  analysis: AnalysisSummary | null;
  setAnalysis: (analysis: AnalysisSummary | null) => void;
}

const AIView: React.FC<Props> = ({ history, analysis, setAnalysis }) => {
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  
  // Wake Lock 引用，防止屏幕熄屏
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // AbortController 引用，用于取消请求
  const abortControllerRef = useRef<AbortController | null>(null);

  const sumTransitionResult = useMemo<TransitionResult>(() => calculateTransitionResult(history), [history]);
  const rangeTransitionResult = useMemo<TransitionResult>(() => calculateRangeTransitionResult(history), [history]);
  const consecutiveTransitionResult = useMemo<TransitionResult>(() => calculateConsecutiveTransitionResult(history), [history]);
  const frontRepeatTransitionResult = useMemo<TransitionResult>(() => calculateFrontRepeatTransitionResult(history), [history]);
  const backRepeatTransitionResult = useMemo<TransitionResult>(() => calculateBackRepeatTransitionResult(history), [history]);
  const oddTransitionResult = useMemo<TransitionResult>(() => calculateOddTransitionResult(history), [history]);
  
  const [inputSumMin, setInputSumMin] = useState<string>(sumTransitionResult.bestInterval.min.toString());
  const [inputSumMax, setInputSumMax] = useState<string>(sumTransitionResult.bestInterval.max.toString());
  const [inputRangeMin, setInputRangeMin] = useState<string>(rangeTransitionResult.bestInterval.min.toString());
  const [inputRangeMax, setInputRangeMax] = useState<string>(rangeTransitionResult.bestInterval.max.toString());
  const [inputCount, setInputCount] = useState<string>("1");
  
  const [selectedConsecutive, setSelectedConsecutive] = useState<number[]>([consecutiveTransitionResult.bestInterval.index]);
  const [selectedFrontRepeat, setSelectedFrontRepeat] = useState<number[]>([frontRepeatTransitionResult.bestInterval.index]);
  const [selectedBackRepeat, setSelectedBackRepeat] = useState<number[]>([backRepeatTransitionResult.bestInterval.index]);
  const [selectedOdd, setSelectedOdd] = useState<number[]>([oddTransitionResult.bestInterval.index]);

  useEffect(() => {
    if (!analysis) {
      setInputSumMin(sumTransitionResult.bestInterval.min.toString());
      setInputSumMax(sumTransitionResult.bestInterval.max.toString());
      setInputRangeMin(rangeTransitionResult.bestInterval.min.toString());
      setInputRangeMax(rangeTransitionResult.bestInterval.max.toString());
      setSelectedConsecutive([consecutiveTransitionResult.bestInterval.index]);
      setSelectedFrontRepeat([frontRepeatTransitionResult.bestInterval.index]);
      setSelectedBackRepeat([backRepeatTransitionResult.bestInterval.index]);
      setSelectedOdd([oddTransitionResult.bestInterval.index]);
    }
  }, [sumTransitionResult, rangeTransitionResult, consecutiveTransitionResult, frontRepeatTransitionResult, backRepeatTransitionResult, oddTransitionResult, analysis]);

  const consecutiveOptions = [
    { value: 0, label: '0连号' },
    { value: 1, label: '1个2连号' },
    { value: 2, label: '2个2连号' },
    { value: 3, label: '1个3连号' },
    { value: 4, label: '1个4连号' },
    { value: 5, label: '1个5连号' },
  ];

  const frontRepeatOptions = [
    { value: 0, label: '0重号' },
    { value: 1, label: '1重号' },
    { value: 2, label: '2重号' },
    { value: 3, label: '3重号' },
    { value: 4, label: '4重号' },
  ];

  const backRepeatOptions = [
    { value: 0, label: '0重号' },
    { value: 1, label: '1重号' },
    { value: 2, label: '2重号' },
  ];

  const oddOptions = [
    { value: 0, label: '0奇数' },
    { value: 1, label: '1奇数' },
    { value: 2, label: '2奇数' },
    { value: 3, label: '3奇数' },
    { value: 4, label: '4奇数' },
    { value: 5, label: '5奇数' },
  ];

  const toggleOption = (options: number[], value: number): number[] => {
    if (options.includes(value)) {
      return options.filter(v => v !== value);
    }
    return [...options, value];
  };

  // 请求屏幕常亮（防止熄屏导致请求中断）
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        console.log('屏幕常亮已开启');
      }
    } catch (err) {
      console.warn('无法开启屏幕常亮:', err);
    }
  };

  // 释放屏幕常亮
  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        console.log('屏幕常亮已释放');
      }).catch((err: Error) => {
        console.warn('释放屏幕常亮失败:', err);
      });
      wakeLockRef.current = null;
    }
  };

  const performAnalysis = async () => {
    if (history.length === 0) return;
    
    const sumMinVal = parseInt(inputSumMin);
    const sumMaxVal = parseInt(inputSumMax);
    const rangeMinVal = parseInt(inputRangeMin);
    const rangeMaxVal = parseInt(inputRangeMax);
    const countVal = parseInt(inputCount);

    if (isNaN(sumMinVal) || isNaN(sumMaxVal) || sumMinVal < 15 || sumMaxVal > 165 || sumMinVal > sumMaxVal) {
      alert("请输入合理的前区和值范围 (15-165)");
      return;
    }
    if (isNaN(rangeMinVal) || isNaN(rangeMaxVal) || rangeMinVal < 4 || rangeMaxVal > 34 || rangeMinVal > rangeMaxVal) {
      alert("请输入合理的前区极差范围 (4-34)");
      return;
    }
    if (isNaN(countVal) || countVal < 1 || countVal > 10) {
      alert("组数请设置在 1-10 之间");
      return;
    }
    if (selectedConsecutive.length === 0 && selectedFrontRepeat.length === 0 && selectedBackRepeat.length === 0 && selectedOdd.length === 0) {
      alert("请至少选择一个连号、重号或奇数选项");
      return;
    }

    await requestWakeLock();
    
    abortControllerRef.current = new AbortController();
    
    setLoading(true);
    try {
      const res = await getSmartAnalysis(
        history,
        sumMinVal,
        sumMaxVal,
        rangeMinVal,
        rangeMaxVal,
        selectedConsecutive,
        selectedFrontRepeat,
        selectedBackRepeat,
        selectedOdd,
        countVal,
        abortControllerRef.current.signal
      );
      setAnalysis(res);
    } catch (e) {
      console.error(e);
      if (e instanceof Error && e.message === '请求已取消') {
        alert("分析已取消");
      } else {
        alert("DeepSeek 分析失败，请检查 API 配置。");
      }
    } finally {
      setLoading(false);
      releaseWakeLock();
      abortControllerRef.current = null;
    }
  };

  // 监听页面可见性变化
  // 注意：切换应用到后台时不取消请求，让请求在后台继续进行
  // 但释放 Wake Lock 以允许屏幕正常熄屏（用户可能在等待期间想省电）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 页面隐藏时释放屏幕常亮（让手机可以正常熄屏省电）
        // 但不取消请求，让它在后台继续
        console.log('页面切换到后台，释放 Wake Lock，请求继续进行中...');
        releaseWakeLock();
      } else {
        // 页面重新可见时，如果还在 loading，尝试重新获取 Wake Lock
        if (loading && 'wakeLock' in navigator) {
          console.log('页面回到前台，请求仍在进行中');
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loading]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      releaseWakeLock();
      cancelDeepSeekRequest();
    };
  }, []);

  const handleSaveImage = async () => {
    if (!captureRef.current) return;
    setIsSaving(true);
    try {
      const dataUrl = await htmlToImage.toPng(captureRef.current, {
        backgroundColor: '#f8fafc',
        cacheBust: true,
        style: { borderRadius: '0', padding: '20px' }
      });
      const link = document.createElement('a');
      link.download = `DLT_Analysis_${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Save error', err);
      alert('保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 交互输入区 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
          DeepSeek 选号参数
        </h3>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">目标前区和值范围</label>
            <div className="flex gap-2">
              <input 
                type="number"
                value={inputSumMin}
                onChange={(e) => setInputSumMin(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="最小值"
              />
              <span className="self-center text-slate-300 font-bold">-</span>
              <input 
                type="number"
                value={inputSumMax}
                onChange={(e) => setInputSumMax(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="最大值"
              />
            </div>
            <p className="text-[9px] text-slate-400">最佳区间: {sumTransitionResult.bestInterval.label}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">前区极差范围</label>
            <div className="flex gap-2">
              <input 
                type="number"
                value={inputRangeMin}
                onChange={(e) => setInputRangeMin(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="最小"
              />
              <span className="self-center text-slate-300 font-bold">-</span>
              <input 
                type="number"
                value={inputRangeMax}
                onChange={(e) => setInputRangeMax(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="最大"
              />
            </div>
            <p className="text-[9px] text-slate-400">最佳区间: {rangeTransitionResult.bestInterval.label}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">生成组数 (1-10)</label>
            <input 
              type="number"
              value={inputCount}
              onChange={(e) => setInputCount(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black text-slate-700 focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">前区连号选择</label>
            <div className="flex flex-wrap gap-2">
              {consecutiveOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedConsecutive(toggleOption(selectedConsecutive, option.value))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedConsecutive.includes(option.value)
                      ? 'bg-purple-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">前区重号选择</label>
            <div className="flex flex-wrap gap-2">
              {frontRepeatOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedFrontRepeat(toggleOption(selectedFrontRepeat, option.value))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedFrontRepeat.includes(option.value)
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">后区重号选择</label>
            <div className="flex flex-wrap gap-2">
              {backRepeatOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedBackRepeat(toggleOption(selectedBackRepeat, option.value))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedBackRepeat.includes(option.value)
                      ? 'bg-indigo-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">前区奇数选择</label>
            <div className="flex flex-wrap gap-2">
              {oddOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => setSelectedOdd(toggleOption(selectedOdd, option.value))}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedOdd.includes(option.value)
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={performAnalysis}
          disabled={loading}
          className={`w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-50' : ''}`}
        >
          {loading ? (
            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              开始 AI 选号
            </>
          )}
        </button>
      </div>

      {loading && (
        <div className="py-20 flex flex-col items-center gap-4 animate-in fade-in">
           <div className="animate-spin h-10 w-10 border-4 border-slate-300 border-t-slate-800 rounded-full"></div>
           <p className="text-slate-400 font-bold animate-pulse text-sm">DeepSeek 正在进行深度回溯计算...</p>
        </div>
      )}

      {analysis && !loading && (
        <div ref={captureRef} className="space-y-6 animate-in slide-in-from-bottom duration-500 pb-10">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-[2.5rem] text-white shadow-2xl border border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-500 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0012 18.75c-1.03 0-1.9-.4-2.593-1.003l-.547-.547z"></path></svg>
              </div>
              <h2 className="text-xl font-bold tracking-tight">DeepSeek 智能选号报告</h2>
            </div>

            <div className="space-y-4">
              {analysis.recommendations && analysis.recommendations.map((rec, idx) => {
                if (!Array.isArray(rec) || rec.length < 7) return null;

                const frontNums = rec.slice(0, 5);
                const backNums = rec.slice(5, 7);
                const sum = frontNums.reduce((a, b) => a + b, 0);
                const rangeVal = Math.max(...frontNums) - Math.min(...frontNums);
                const backtest = calculateHistoricalPrizes(frontNums, backNums, history).filter(r => r.count > 0);

                const consecutive = findConsecutive(frontNums);
                let consecutiveDesc = '0连号';
                if (consecutive.length > 0) {
                  const twoCount = consecutive.filter(c => c.length === 2).length;
                  if (twoCount === 1) consecutiveDesc = '1个2连号';
                  else if (twoCount === 2) consecutiveDesc = '2个2连号';
                  else {
                    for (const c of consecutive) {
                      if (c.length === 3) consecutiveDesc = '1个3连号';
                      else if (c.length === 4) consecutiveDesc = '1个4连号';
                      else if (c.length === 5) consecutiveDesc = '1个5连号';
                    }
                  }
                }

                const frontRepeat = history.length > 0 ? countIntersection(frontNums, history[0].front) : 0;
                const backRepeat = history.length > 0 ? countIntersection(backNums, history[0].back) : 0;
                const oddCount = countOdd(frontNums);

                return (
                  <div key={idx} className="bg-white/5 p-5 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-black bg-indigo-500 px-2 py-0.5 rounded uppercase tracking-widest">推荐方案 #{idx + 1}</span>
                    </div>
                    
                    <div className="flex gap-2 justify-center mb-4">
                      {frontNums.map((n, i) => (
                        <div key={i} className="w-9 h-9 bg-white text-slate-900 font-black rounded-full flex items-center justify-center shadow-lg text-xs">
                          {n.toString().padStart(2, '0')}
                        </div>
                      ))}
                      <div className="w-px h-6 bg-white/20 self-center"></div>
                      {backNums.map((n, i) => (
                        <div key={i} className="w-9 h-9 bg-indigo-500 text-white font-black rounded-full flex items-center justify-center shadow-lg text-xs">
                          {n.toString().padStart(2, '0')}
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center text-[10px] font-bold">
                      <span className="text-slate-400">和值: <b className="text-indigo-400">{sum}</b></span>
                      <span className="text-slate-400">极差: <b className="text-blue-400">{rangeVal}</b></span>
                      <span className="text-slate-400">连号: <b className="text-purple-400">{consecutiveDesc}</b></span>
                      <span className="text-slate-400">前区重号: <b className="text-red-400">{frontRepeat}个</b></span>
                      <span className="text-slate-400">后区重号: <b className="text-indigo-400">{backRepeat}个</b></span>
                      <span className="text-slate-400">前区奇数: <b className="text-green-400">{oddCount}个</b></span>
                    </div>

                    {backtest.length > 0 && (
                      <div className="pt-3 mt-3 border-t border-white/5">
                        <div className="flex gap-2 flex-wrap justify-center">
                          {backtest.map(b => (
                            <span key={b.tier} className="text-[9px] font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-lg">
                              {b.name} x{b.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-amber-200 leading-relaxed">
                  <span className="font-bold">重要提示：</span>彩票开奖完全随机，历史数据统计结果不代表未来中奖概率，请理性购彩，量力而行。
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={handleSaveImage}
              disabled={isSaving}
              className={`w-full py-4 flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold shadow-sm active:scale-95 transition-all ${isSaving ? 'opacity-50' : ''}`}
            >
              <svg className={`w-5 h-5 ${isSaving ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
              </svg>
              {isSaving ? '正在生成长图...' : '导出分析报告'}
            </button>
            <p className="text-[10px] text-center text-slate-400 font-medium">数据基于 DeepSeek-V3 模型概率推演，仅供参考。</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIView;