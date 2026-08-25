
import React, { useMemo, useState, useEffect } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Brush, ReferenceLine, BarChart, Bar } from 'recharts';
import { LottoDraw } from '../types';
import { predictNextSum, predictNextRange, calculateOmitStats, OmitStats, calculateTransitionResult, calculateRangeTransitionResult, calculateConsecutiveTransitionResult, calculateFrontRepeatTransitionResult, calculateBackRepeatTransitionResult, calculateOddTransitionResult, TransitionResult } from '../utils';
import { PredictionResult } from '../types';

interface Props {
  history: LottoDraw[];
}

const StatsView: React.FC<Props> = ({ history }) => {
  // 基础数据准备：将历史数据按时间顺序（从旧到新）排列
  const historyAsc = useMemo(() => [...history].reverse(), [history]);

  // 状态：当前 Brush 选中的数据索引范围
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: Math.max(0, historyAsc.length - 100),
    end: Math.max(0, historyAsc.length - 1)
  });

  // ========== 所有 useState 声明必须在最前面 ==========
  
  const [omitSortByValue, setOmitSortByValue] = useState(false);

  // 当外部 history 更新时，初始化或重置范围
  useEffect(() => {
    if (historyAsc.length > 0) {
      setRange({
        start: Math.max(0, historyAsc.length - 100),
        end: historyAsc.length - 1
      });
    }
  }, [historyAsc.length]);

  // 计算当前选定范围内的子集
  const visibleHistory = useMemo(() => {
    return historyAsc.slice(range.start, range.end + 1);
  }, [historyAsc, range]);

  // ========== P2 新增：遗漏值统计 ==========
  const frontOmitStats = useMemo(() => {
    // 使用全量历史计算遗漏值（从新到旧）
    return calculateOmitStats(history, true);
  }, [history]);

  const backOmitStats = useMemo(() => {
    return calculateOmitStats(history, false);
  }, [history]);

  const sortedFrontOmit = useMemo(() => {
    if (!omitSortByValue) return frontOmitStats;
    return [...frontOmitStats].sort((a, b) => b.omit - a.omit);
  }, [frontOmitStats, omitSortByValue]);

  const sortedBackOmit = useMemo(() => {
    if (!omitSortByValue) return backOmitStats;
    return [...backOmitStats].sort((a, b) => b.omit - a.omit);
  }, [backOmitStats, omitSortByValue]);

  // 获取遗漏值对应的颜色类
  const getOmitColorClass = (omit: number): string => {
    if (omit <= 5) return 'bg-green-50 text-green-600 border-green-200';
    if (omit <= 15) return 'bg-yellow-50 text-yellow-600 border-yellow-200';
    if (omit <= 30) return 'bg-orange-50 text-orange-600 border-orange-200';
    return 'bg-red-50 text-red-600 border-red-200';
  };

  // 1. 基于选定范围计算：前区和值走势数据
  const sumTrendData = useMemo(() => {
    return visibleHistory.map(d => ({
      id: d.id,
      sum: d.front.reduce((a, b) => a + b, 0),
      date: d.date
    }));
  }, [visibleHistory]);

  // 2. 计算选定范围平均和值
  const avgSum = useMemo(() => {
    if (sumTrendData.length === 0) return 0;
    const total = sumTrendData.reduce((acc, curr) => acc + curr.sum, 0);
    return parseFloat((total / sumTrendData.length).toFixed(2));
  }, [sumTrendData]);

  // 3. 基于选定范围计算：前区极差走势数据
  const rangeTrendData = useMemo(() => {
    return visibleHistory.map(d => {
      const max = Math.max(...d.front);
      const min = Math.min(...d.front);
      return {
        id: d.id,
        range: max - min,
        date: d.date
      };
    });
  }, [visibleHistory]);

  // 4. 计算平均极差
  const avgRange = useMemo(() => {
    if (rangeTrendData.length === 0) return 0;
    const total = rangeTrendData.reduce((acc, curr) => acc + curr.range, 0);
    return parseFloat((total / rangeTrendData.length).toFixed(2));
  }, [rangeTrendData]);

  // 3. 基于选定范围计算：后区组合分布图
  const rearHeatmap = useMemo(() => {
    const heatmap: number[][] = Array(13).fill(0).map(() => Array(13).fill(0));
    let maxFreq = 0;
    visibleHistory.forEach(d => {
      const [b1, b2] = [...d.back].sort((a, b) => a - b);
      heatmap[b1][b2]++;
      if (heatmap[b1][b2] > maxFreq) maxFreq = heatmap[b1][b2];
    });
    return { data: heatmap, max: maxFreq };
  }, [visibleHistory]);

  // 图表数据转换 (全量和值走势用于 Brush 控制)
  const fullSumTrendData = useMemo(() => {
    return historyAsc.map(d => ({
      date: d.date,
      sum: d.front.reduce((a, b) => a + b, 0),
      id: d.id
    }));
  }, [historyAsc]);

  // 限制预测只使用最近 100 期数据，确保不同用户看到相同的预测值
  // 避免因 localStorage 缓存数据量不同导致的预测差异
  const predictionData = useMemo(() => {
    // 取最新 100 期（history 是从新到旧排序的）
    return history.slice(0, 100);
  }, [history]);

  const sumPrediction = useMemo<PredictionResult>(() => predictNextSum(predictionData), [predictionData]);
  const rangePrediction = useMemo<PredictionResult>(() => predictNextRange(predictionData), [predictionData]);

  // 和值概率转移矩阵结果（使用全量历史数据）
  const transitionResult = useMemo<TransitionResult>(() => calculateTransitionResult(history), [history]);
  
  // 极差概率转移矩阵结果（使用全量历史数据）
  const rangeTransitionResult = useMemo<TransitionResult>(() => calculateRangeTransitionResult(history), [history]);
  
  // 前区连号概率转移矩阵结果（使用全量历史数据）
  const consecutiveTransitionResult = useMemo<TransitionResult>(() => calculateConsecutiveTransitionResult(history), [history]);
  
  // 前区重号概率转移矩阵结果（使用全量历史数据）
  const frontRepeatTransitionResult = useMemo<TransitionResult>(() => calculateFrontRepeatTransitionResult(history), [history]);
  
  // 后区重号概率转移矩阵结果（使用全量历史数据）
  const backRepeatTransitionResult = useMemo<TransitionResult>(() => calculateBackRepeatTransitionResult(history), [history]);
  
  // 前区奇数概率转移矩阵结果（使用全量历史数据）
  const oddTransitionResult = useMemo<TransitionResult>(() => calculateOddTransitionResult(history), [history]);

  const handleBrushChange = (obj: any) => {
    if (obj && typeof obj.startIndex === 'number' && typeof obj.endIndex === 'number') {
      setRange({ start: obj.startIndex, end: obj.endIndex });
    }
  };

  return (
    <div className="space-y-6 pb-4">
      {/* ========== 1. 遗漏值分析 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <span>遗漏值分析</span>
            <span className="text-[10px] text-slate-400 font-normal">遗漏期数 = 多久没出</span>
          </h3>
          <button
            onClick={() => setOmitSortByValue(!omitSortByValue)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
              omitSortByValue 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {omitSortByValue ? '按号码排序' : '按遗漏值排序'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4 text-[10px]">
          <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg border border-green-200 font-bold">0-5期 热号</span>
          <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-lg border border-yellow-200 font-bold">6-15期 温号</span>
          <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg border border-orange-200 font-bold">16-30期 冷号</span>
          <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg border border-red-200 font-bold">&gt;30期 极冷</span>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">前区号码 (1-35)</h4>
          <div className="grid grid-cols-7 gap-2">
            {sortedFrontOmit.map((stat) => (
              <div
                key={stat.num}
                className={`relative flex flex-col items-center p-2 rounded-xl border ${getOmitColorClass(stat.omit)} transition-all hover:scale-105`}
                title={`号码${stat.num}: 遗漏${stat.omit}期\n最近出现: 第${stat.lastDrawId}期 ${stat.lastDrawDate}`}
              >
                <span className="text-sm font-black">{stat.num.toString().padStart(2, '0')}</span>
                <span className="text-[9px] font-bold opacity-80">{stat.omit}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">后区号码 (1-12)</h4>
          <div className="grid grid-cols-6 gap-2">
            {sortedBackOmit.map((stat) => (
              <div
                key={stat.num}
                className={`relative flex flex-col items-center p-2 rounded-xl border ${getOmitColorClass(stat.omit)} transition-all hover:scale-105`}
                title={`号码${stat.num}: 遗漏${stat.omit}期\n最近出现: 第${stat.lastDrawId}期 ${stat.lastDrawDate}`}
              >
                <span className="text-sm font-black">{stat.num.toString().padStart(2, '0')}</span>
                <span className="text-[9px] font-bold opacity-80">{stat.omit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 2. 前区和值全量走势 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-slate-800">前区和值全量走势</h3>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">选定范围平均和值</span>
              <span className="text-sm font-black text-indigo-600">{avgSum}</span>
            </div>
            <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 bg-slate-100 rounded">拖动滑块影响统计</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fullSumTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="id" hide />
              <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                formatter={(value: number) => [`和值: ${value}`, '数据']}
              />
              <ReferenceLine y={avgSum} stroke="#94a3b8" strokeDasharray="5 5" label={{ position: 'right', value: `AVG: ${avgSum}`, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
              <Line
                type="monotone"
                dataKey="sum"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={1000}
              />
              <Brush
                dataKey="id"
                height={24}
                stroke="#6366f1"
                startIndex={range.start}
                endIndex={range.end}
                onChange={handleBrushChange}
                fill="#f8fafc"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ========== 3. 前区极差走势 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-slate-800">前区极差走势</h3>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">选定范围平均极差</span>
            <span className="text-sm font-black text-blue-600">{avgRange}</span>
          </div>
        </div>
        
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rangeTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="id" hide />
              <YAxis domain={['dataMin - 5', 'dataMax + 5']} hide />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                formatter={(value: number) => [`极差: ${value}`, '数据']}
              />
              <ReferenceLine y={avgRange} stroke="#94a3b8" strokeDasharray="5 5" label={{ position: 'right', value: `AVG: ${avgRange}`, fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
              <Line
                type="monotone"
                dataKey="range"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[9px] text-slate-400 mt-2 italic text-center">极差 = 前区最大值 - 前区最小值</p>
      </section>

      {/* ========== 4. 后区组合分布图 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>后区组合分布图</span>
          <span className="text-[10px] text-slate-400 font-bold">12x12 组合热力</span>
        </h3>
        <div className="relative aspect-square w-full max-w-[320px] mx-auto grid grid-cols-12 grid-rows-12 gap-0.5 border border-slate-100 bg-slate-50 p-1 rounded-xl">
          {Array.from({ length: 12 }).map((_, r) => {
            const row = r + 1;
            return Array.from({ length: 12 }).map((_, c) => {
              const col = c + 1;
              const freq = rearHeatmap.data[row][col] || 0;
              const intensity = rearHeatmap.max > 0 ? (freq / rearHeatmap.max) : 0;
              const isCombo = row < col;

              return (
                <div
                  key={`${row}-${col}`}
                  className={`relative rounded-sm transition-all flex items-center justify-center group`}
                  style={{
                    backgroundColor: isCombo ? `rgba(59, 130, 246, ${0.1 + intensity * 0.9})` : 'transparent',
                    opacity: isCombo ? 1 : 0.2
                  }}
                >
                  {isCombo && freq > 0 && (
                    <span className="text-[6px] font-bold text-white opacity-0 group-hover:opacity-100 scale-75">{freq}</span>
                  )}
                  {row === 1 && <span className="absolute -top-4 text-[8px] font-bold text-slate-300">{col}</span>}
                  {col === 12 && <span className="absolute -right-4 text-[8px] font-bold text-slate-300">{row}</span>}
                </div>
              );
            });
          })}
        </div>
        <p className="text-[9px] text-slate-400 mt-6 text-center italic">说明：统计数据仅限趋势图中拖动选取的时期范围</p>
      </section>

      {/* ========== 5. 前区和值概率转移矩阵 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">前区和值概率转移矩阵</h3>
        <p className="text-[10px] text-slate-400 mb-4">基于全量历史数据计算</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left font-bold text-slate-600 rounded-l-lg">和值区间</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">1阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">2阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">3阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600 rounded-r-lg">4阶概率</th>
              </tr>
            </thead>
            <tbody>
              {transitionResult.intervals.map((interval, index) => (
                <tr 
                  key={interval.index}
                  className={`border-t border-slate-100 ${
                    index === transitionResult.bestInterval.index ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2 font-bold text-slate-700">
                    {interval.label}
                    {index === transitionResult.bestInterval.index && (
                      <span className="ml-2 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold" 
                          style={{ color: getProbabilityColor(transitionResult.firstOrderProbs[index]) }}>
                      {(transitionResult.firstOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(transitionResult.secondOrderProbs[index]) }}>
                      {(transitionResult.secondOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(transitionResult.thirdOrderProbs[index]) }}>
                      {(transitionResult.thirdOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(transitionResult.fourthOrderProbs[index]) }}>
                      {(transitionResult.fourthOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase">综合预测</p>
              <p className="text-sm font-bold text-indigo-900">
                加权平均分最高的区间是 <span className="text-indigo-600">{transitionResult.bestInterval.label}</span>
                <span className="text-slate-400 ml-2">加权得分: {(transitionResult.maxScore * 100).toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 6. 前区极差概率转移矩阵 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">前区极差概率转移矩阵</h3>
        <p className="text-[10px] text-slate-400 mb-4">基于全量历史数据计算</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left font-bold text-slate-600 rounded-l-lg">极差区间</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">1阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">2阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">3阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600 rounded-r-lg">4阶概率</th>
              </tr>
            </thead>
            <tbody>
              {rangeTransitionResult.intervals.map((interval, index) => (
                <tr 
                  key={interval.index}
                  className={`border-t border-slate-100 ${
                    index === rangeTransitionResult.bestInterval.index ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2 font-bold text-slate-700">
                    {interval.label}
                    {index === rangeTransitionResult.bestInterval.index && (
                      <span className="ml-2 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold" 
                          style={{ color: getProbabilityColor(rangeTransitionResult.firstOrderProbs[index]) }}>
                      {(rangeTransitionResult.firstOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(rangeTransitionResult.secondOrderProbs[index]) }}>
                      {(rangeTransitionResult.secondOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(rangeTransitionResult.thirdOrderProbs[index]) }}>
                      {(rangeTransitionResult.thirdOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(rangeTransitionResult.fourthOrderProbs[index]) }}>
                      {(rangeTransitionResult.fourthOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-blue-400 font-bold uppercase">综合预测</p>
              <p className="text-sm font-bold text-blue-900">
                加权平均分最高的区间是 <span className="text-blue-600">{rangeTransitionResult.bestInterval.label}</span>
                <span className="text-slate-400 ml-2">加权得分: {(rangeTransitionResult.maxScore * 100).toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 7. 前区连号概率转移矩阵 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">前区连号概率转移矩阵</h3>
        <p className="text-[10px] text-slate-400 mb-4">基于全量历史数据计算</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left font-bold text-slate-600 rounded-l-lg">连号类型</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">1阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">2阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">3阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600 rounded-r-lg">4阶概率</th>
              </tr>
            </thead>
            <tbody>
              {consecutiveTransitionResult.intervals.map((interval, index) => (
                <tr 
                  key={interval.index}
                  className={`border-t border-slate-100 ${
                    index === consecutiveTransitionResult.bestInterval.index ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2 font-bold text-slate-700">
                    {interval.label}
                    {index === consecutiveTransitionResult.bestInterval.index && (
                      <span className="ml-2 text-[8px] bg-blue-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold" 
                          style={{ color: getProbabilityColor(consecutiveTransitionResult.firstOrderProbs[index]) }}>
                      {(consecutiveTransitionResult.firstOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(consecutiveTransitionResult.secondOrderProbs[index]) }}>
                      {(consecutiveTransitionResult.secondOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(consecutiveTransitionResult.thirdOrderProbs[index]) }}>
                      {(consecutiveTransitionResult.thirdOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(consecutiveTransitionResult.fourthOrderProbs[index]) }}>
                      {(consecutiveTransitionResult.fourthOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-purple-400 font-bold uppercase">综合预测</p>
              <p className="text-sm font-bold text-purple-900">
                加权平均分最高的类型是 <span className="text-purple-600">{consecutiveTransitionResult.bestInterval.label}</span>
                <span className="text-slate-400 ml-2">加权得分: {(consecutiveTransitionResult.maxScore * 100).toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 8. 前区重号概率转移矩阵 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">前区重号概率转移矩阵</h3>
        <p className="text-[10px] text-slate-400 mb-4">基于全量历史数据计算</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left font-bold text-slate-600 rounded-l-lg">重号数量</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">1阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">2阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">3阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600 rounded-r-lg">4阶概率</th>
              </tr>
            </thead>
            <tbody>
              {frontRepeatTransitionResult.intervals.map((interval, index) => (
                <tr 
                  key={interval.index}
                  className={`border-t border-slate-100 ${
                    index === frontRepeatTransitionResult.bestInterval.index ? 'bg-red-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2 font-bold text-slate-700">
                    {interval.label}
                    {index === frontRepeatTransitionResult.bestInterval.index && (
                      <span className="ml-2 text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold" 
                          style={{ color: getProbabilityColor(frontRepeatTransitionResult.firstOrderProbs[index]) }}>
                      {(frontRepeatTransitionResult.firstOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(frontRepeatTransitionResult.secondOrderProbs[index]) }}>
                      {(frontRepeatTransitionResult.secondOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(frontRepeatTransitionResult.thirdOrderProbs[index]) }}>
                      {(frontRepeatTransitionResult.thirdOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(frontRepeatTransitionResult.fourthOrderProbs[index]) }}>
                      {(frontRepeatTransitionResult.fourthOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-red-400 font-bold uppercase">综合预测</p>
              <p className="text-sm font-bold text-red-900">
                加权平均分最高的数量是 <span className="text-red-600">{frontRepeatTransitionResult.bestInterval.label}</span>
                <span className="text-slate-400 ml-2">加权得分: {(frontRepeatTransitionResult.maxScore * 100).toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 9. 后区重号概率转移矩阵 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">后区重号概率转移矩阵</h3>
        <p className="text-[10px] text-slate-400 mb-4">基于全量历史数据计算</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left font-bold text-slate-600 rounded-l-lg">重号数量</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">1阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">2阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">3阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600 rounded-r-lg">4阶概率</th>
              </tr>
            </thead>
            <tbody>
              {backRepeatTransitionResult.intervals.map((interval, index) => (
                <tr 
                  key={interval.index}
                  className={`border-t border-slate-100 ${
                    index === backRepeatTransitionResult.bestInterval.index ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2 font-bold text-slate-700">
                    {interval.label}
                    {index === backRepeatTransitionResult.bestInterval.index && (
                      <span className="ml-2 text-[8px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold" 
                          style={{ color: getProbabilityColor(backRepeatTransitionResult.firstOrderProbs[index]) }}>
                      {(backRepeatTransitionResult.firstOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(backRepeatTransitionResult.secondOrderProbs[index]) }}>
                      {(backRepeatTransitionResult.secondOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(backRepeatTransitionResult.thirdOrderProbs[index]) }}>
                      {(backRepeatTransitionResult.thirdOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(backRepeatTransitionResult.fourthOrderProbs[index]) }}>
                      {(backRepeatTransitionResult.fourthOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-indigo-400 font-bold uppercase">综合预测</p>
              <p className="text-sm font-bold text-indigo-900">
                加权平均分最高的数量是 <span className="text-indigo-600">{backRepeatTransitionResult.bestInterval.label}</span>
                <span className="text-slate-400 ml-2">加权得分: {(backRepeatTransitionResult.maxScore * 100).toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 10. 前区奇数概率转移矩阵 ========== */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">前区奇数概率转移矩阵</h3>
        <p className="text-[10px] text-slate-400 mb-4">基于全量历史数据计算</p>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2 text-left font-bold text-slate-600 rounded-l-lg">奇数数量</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">1阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">2阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600">3阶概率</th>
                <th className="px-2 py-2 text-center font-bold text-slate-600 rounded-r-lg">4阶概率</th>
              </tr>
            </thead>
            <tbody>
              {oddTransitionResult.intervals.map((interval, index) => (
                <tr 
                  key={interval.index}
                  className={`border-t border-slate-100 ${
                    index === oddTransitionResult.bestInterval.index ? 'bg-green-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-2 py-2 font-bold text-slate-700">
                    {interval.label}
                    {index === oddTransitionResult.bestInterval.index && (
                      <span className="ml-2 text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold" 
                          style={{ color: getProbabilityColor(oddTransitionResult.firstOrderProbs[index]) }}>
                      {(oddTransitionResult.firstOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(oddTransitionResult.secondOrderProbs[index]) }}>
                      {(oddTransitionResult.secondOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(oddTransitionResult.thirdOrderProbs[index]) }}>
                      {(oddTransitionResult.thirdOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-block w-full text-center font-bold"
                          style={{ color: getProbabilityColor(oddTransitionResult.fourthOrderProbs[index]) }}>
                      {(oddTransitionResult.fourthOrderProbs[index] * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-green-400 font-bold uppercase">综合预测</p>
              <p className="text-sm font-bold text-green-900">
                加权平均分最高的数量是 <span className="text-green-600">{oddTransitionResult.bestInterval.label}</span>
                <span className="text-slate-400 ml-2">加权得分: {(oddTransitionResult.maxScore * 100).toFixed(2)}%</span>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const getProbabilityColor = (prob: number): string => {
  const percent = prob * 100;
  if (percent >= 15) return '#ef4444';
  if (percent >= 10) return '#f97316';
  if (percent >= 5) return '#eab308';
  return '#64748b';
};

export default StatsView;
