
import React, { useState, useMemo } from 'react';
import { LottoDraw } from '../types';
import { parseHistoryData } from '../services/geminiService';
import { convertToCSV } from '../services/lottoService';

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

  const handleManualImport = async () => {
    if (!rawText.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseHistoryData(rawText);
      if (parsed && parsed.length > 0) {
        onUpdate(parsed);
        setRawText('');
        setShowImport(false);
        alert(`手动导入成功: ${parsed.length} 条`);
      } else {
        alert('解析失败，请检查粘贴的内容');
      }
    } catch (e) {
      alert('解析出错，请重试');
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
    link.setAttribute('download', `dlt_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Sticky Filter Bar */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-3 sticky top-[58px] z-20">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
            开奖记录
          </h2>
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
            {isSyncing ? '同步中...' : '同步全量'}
          </button>
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

        <div className="flex justify-between items-center px-1">
          <button 
            onClick={() => setShowImport(!showImport)}
            className="text-[10px] text-slate-400 hover:text-blue-500 font-bold uppercase tracking-wider py-1"
          >
            {showImport ? '隐藏工具' : '手动导入 / 纠错'}
          </button>
          <button 
            onClick={handleExportCSV}
            className="text-[10px] text-indigo-500 hover:text-indigo-700 font-bold uppercase tracking-wider py-1 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            导出 CSV
          </button>
        </div>

        {showImport && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-300">
            <textarea
              className="w-full h-24 p-3 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="粘贴 500.com 表格内容..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <button
              onClick={handleManualImport}
              disabled={isParsing}
              className="w-full bg-slate-800 text-white py-2 rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {isParsing ? 'AI 解析中...' : '解析并保存'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 pt-1">
        {filteredHistory.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-slate-400">没有找到匹配的记录</p>
          </div>
        ) : (
          filteredHistory.map((draw) => (
            <div key={draw.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-200 transition-all">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                   <span className="text-sm font-black text-slate-700">第 {draw.id} 期</span>
                   <span className="text-[10px] text-slate-400 font-bold">{draw.date}</span>
                </div>
                <div className="text-[10px] font-bold text-slate-300">和值: {draw.front.reduce((a, b) => a + b, 0)}</div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-1.5 flex-wrap">
                  {draw.front.map((num, i) => (
                    <div key={i} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 font-bold rounded-lg border border-red-100 shadow-sm text-xs">
                      {num.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
                <div className="w-px h-6 bg-slate-100 mx-1"></div>
                <div className="flex gap-1.5">
                  {draw.back.map((num, i) => (
                    <div key={i} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 font-bold rounded-lg border border-blue-100 shadow-sm text-xs">
                      {num.toString().padStart(2, '0')}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryView;
