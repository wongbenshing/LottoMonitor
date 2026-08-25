
import React, { useState, useMemo } from 'react';
import { LottoDraw } from '../types';
import { parseHistoryData } from '../services/deepseekService';
import { convertToCSV } from '../services/lottoService';
import { calculateDrawTemperature, getTemperatureStyle, NumberTemperature, getConsecutiveIndex, countOdd, countIntersection } from '../utils';

interface Props {
  history: LottoDraw[];
  isSyncing: boolean;
  onUpdate: (data: LottoDraw[]) => void;
  onSync: () => void;
}

const HistoryView: React.FC<Props> = ({ history, isSyncing, onUpdate, onSync }) => {
  const [showImport, setShowImport] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  
  const [filterYear, setFilterYear] = useState<string>('All');
  const [searchDate, setSearchDate] = useState<string>('');
  const [showAll, setShowAll] = useState<boolean>(false);

  const years = useMemo(() => {
    const ySet = new Set<string>();
    history.forEach(d => ySet.add(d.date.split('-')[0]));
    return ['All', ...Array.from(ySet).sort((a, b) => b.localeCompare(a))];
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter(d => {
      const matchYear = filterYear === 'All' || d.date.startsWith(filterYear);
      const matchSearch = !searchDate || d.date.includes(searchDate) || d.id.includes(searchDate);
      return matchYear && matchSearch;
    });
  }, [history, filterYear, searchDate]);

  // 判断是否使用了筛选条件
  const hasFilter = filterYear !== 'All' || searchDate !== '';

  // 显示的数据：无筛选时默认显示最新100条，有筛选时显示全部匹配结果
  const displayHistory = useMemo(() => {
    if (hasFilter || showAll) {
      return filteredHistory;
    }
    return filteredHistory.slice(0, 100);
  }, [filteredHistory, hasFilter, showAll]);

  const handleManualImport = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseHistoryData(rawText);
      if (parsed && parsed.length > 0) {
        onUpdate(parsed);
        setRawText('');
        setShowImport(false);
        alert(`DeepSeek 手动解析成功: ${parsed.length} 条记录已追加。`);
      } else {
        alert('解析结果为空，请确保粘贴了正确的文本格式。');
      }
    } catch (e) {
      alert('AI 解析出错，请重试或检查 API KEY。');
    } finally {
      setIsParsing(false);
    }
  };

  const handleExportCSV = () => {
    const csv = convertToCSV(history);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `history.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* 操作工具栏 */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-3 sticky top-[58px] z-20">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
            开奖数据库
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-2xl font-bold text-xs flex items-center gap-1 border border-indigo-100 shadow-sm active:scale-95"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              导出
            </button>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-sm transition-all ${
                isSyncing 
                  ? 'bg-slate-100 text-slate-400' 
                  : 'bg-blue-600 text-white shadow-md active:scale-95'
              }`}
            >
              <svg className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              {isSyncing ? '正在拉取...' : '同步云端'}
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none min-w-[90px]"
          >
            {years.map(y => <option key={y} value={y}>{y === 'All' ? '全部年份' : `${y}年`}</option>)}
          </select>
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜索日期或期号..."
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs pl-8 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
        </div>

        <button
          onClick={() => setShowImport(!showImport)}
          className="text-[10px] text-blue-500 font-black uppercase tracking-widest text-center py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          {showImport ? '关闭解析面板' : '数据未及时更新？点击手动粘贴解析'}
        </button>

        {showImport && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in slide-in-from-top duration-300">
            <p className="text-[10px] text-slate-500 font-bold leading-tight">
              提示：粘贴历史开奖文本，DeepSeek 将为您识别。
            </p>
            <textarea
              className="w-full h-24 p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="粘贴开奖文本..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <button
              onClick={handleManualImport}
              disabled={isParsing}
              className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-bold disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {isParsing ? '解析中...' : 'AI 识别并追加'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-20">
        {/* 显示提示 */}
        {!hasFilter && filteredHistory.length > 100 && !showAll && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 flex items-center justify-between">
            <span className="text-xs text-blue-600 font-bold">
              显示最新 100 条，共 {filteredHistory.length} 条记录
            </span>
            <button
              onClick={() => setShowAll(true)}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              显示全部
            </button>
          </div>
        )}
        
        {/* 温度图例 */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-wrap gap-2 text-[10px] justify-center">
            <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg border border-green-200 font-bold">热 0-5期</span>
            <span className="px-2 py-1 bg-yellow-50 text-yellow-600 rounded-lg border border-yellow-200 font-bold">温 6-15期</span>
            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg border border-orange-200 font-bold">冷 16-30期</span>
            <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg border border-red-200 font-bold">极冷 &gt;30期</span>
          </div>
          <p className="text-[9px] text-slate-400 text-center mt-2">标签基于开奖前的遗漏值统计</p>
        </div>
        
        {filteredHistory.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-400 font-bold">未找到匹配记录</p>
          </div>
        ) : (
          displayHistory.map((draw, idx) => {
            const originalIndex = history.findIndex(h => h.id === draw.id);
            const temperature = originalIndex >= 0 
              ? calculateDrawTemperature(history, originalIndex)
              : { front: {}, back: {} };
            
            const consecutiveIdx = getConsecutiveIndex(draw);
            const consecutiveLabels = ['0', '1', '2-2', '3', '4', '5'];
            
            const prevDraw = idx + 1 < displayHistory.length ? displayHistory[idx + 1] : null;
            const frontRepeat = prevDraw ? countIntersection(draw.front, prevDraw.front) : 0;
            const backRepeat = prevDraw ? countIntersection(draw.back, prevDraw.back) : 0;
            const frontRepeatLabel = frontRepeat === 2 && consecutiveIdx === 2 ? '2-2' : frontRepeat.toString();
            
            const oddCount = countOdd(draw.front);
            const sumValue = draw.front.reduce((a, b) => a + b, 0);
            
            return (
              <div key={draw.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                     <span className="text-sm font-black text-slate-800">第 {draw.id} 期</span>
                     <span className="text-[10px] text-slate-400 font-bold">{draw.date}</span>
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">和值: {sumValue}</div>
                </div>
                
                <div className="flex gap-2 items-center mb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {draw.front.map((num, i) => (
                      <div key={i} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 font-black rounded-lg border border-red-100 shadow-sm text-xs">
                        {num.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                  <div className="w-px h-6 bg-slate-100 mx-1"></div>
                  <div className="flex gap-1.5">
                    {draw.back.map((num, i) => (
                      <div key={i} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 font-black rounded-lg border border-blue-100 shadow-sm text-xs">
                        {num.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex gap-2 items-center mb-2">
                  <div className="flex gap-1.5 flex-wrap">
                    {draw.front.map((num, i) => {
                      const temp = temperature.front[num] || 'warm';
                      const style = getTemperatureStyle(temp);
                      return (
                        <div 
                          key={`temp-f-${i}`} 
                          className={`w-8 flex items-center justify-center py-0.5 ${style.bgClass} ${style.textClass} font-bold rounded text-[9px] border`}
                        >
                          {style.label}
                        </div>
                      );
                    })}
                  </div>
                  <div className="w-px h-4 bg-slate-100 mx-1"></div>
                  <div className="flex gap-1.5">
                    {draw.back.map((num, i) => {
                      const temp = temperature.back[num] || 'warm';
                      const style = getTemperatureStyle(temp);
                      return (
                        <div 
                          key={`temp-b-${i}`} 
                          className={`w-8 flex items-center justify-center py-0.5 ${style.bgClass} ${style.textClass} font-bold rounded text-[9px] border`}
                        >
                          {style.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="text-slate-400">连号:</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    consecutiveIdx === 0 ? 'bg-slate-100 text-slate-600' :
                    consecutiveIdx === 1 ? 'bg-purple-100 text-purple-600' :
                    consecutiveIdx === 2 ? 'bg-violet-100 text-violet-600' :
                    'bg-fuchsia-100 text-fuchsia-600'
                  }`}>{consecutiveLabels[consecutiveIdx]}</span>
                  
                  <span className="text-slate-400">重号:</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    frontRepeat === 0 ? 'bg-slate-100 text-slate-600' :
                    frontRepeat === 1 ? 'bg-red-100 text-red-600' :
                    frontRepeat === 2 ? 'bg-orange-100 text-orange-600' :
                    frontRepeat === 3 ? 'bg-amber-100 text-amber-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>{frontRepeatLabel}</span>
                  
                  <span className="text-slate-400">后重:</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    backRepeat === 0 ? 'bg-slate-100 text-slate-600' :
                    backRepeat === 1 ? 'bg-blue-100 text-blue-600' :
                    'bg-cyan-100 text-cyan-600'
                  }`}>{backRepeat}</span>
                  
                  <span className="text-slate-400">奇数:</span>
                  <span className={`px-2 py-0.5 rounded-full ${
                    oddCount <= 2 ? 'bg-green-100 text-green-600' :
                    oddCount <= 3 ? 'bg-emerald-100 text-emerald-600' :
                    'bg-teal-100 text-teal-600'
                  }`}>{oddCount}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryView;
