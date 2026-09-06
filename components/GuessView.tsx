import React, { useEffect, useState } from 'react';
import type { GuessRecord, GuessStats } from '../types';
import { fetchGuessRecords, removePickFromGuess } from '../services/guessService';
import { computeGuessStats } from '../services/guessCore';
import { PICK_COST } from '../constants';

const TIER_NAMES: Record<string, string> = {
  '1': '一等奖', '2': '二等奖', '3': '三等奖', '4': '四等奖',
  '5': '五等奖', '6': '六等奖', '7': '七等奖', '8': '八等奖', '9': '九等奖',
};

const fmtMoney = (n: number): string => n >= 10000 ? `¥${(n / 10000).toFixed(2)}万` : `¥${n.toLocaleString()}`;

const GuessView: React.FC = () => {
  const [records, setRecords] = useState<GuessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setRecords(await fetchGuessRecords());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // 移出一组竞猜(已开奖期会被后端拒绝)
  const handleRemovePick = async (targetDate: string, pickIndex: number) => {
    if (!window.confirm(`确认将第 ${pickIndex + 1} 组移出 ${targetDate} 的竞猜?`)) return;
    const res = await removePickFromGuess(targetDate, pickIndex);
    if (res.ok) {
      load();
    } else {
      alert(`移出失败: ${res.error ?? '未知错误'}`);
    }
  };

  const stats: GuessStats = computeGuessStats(records);
  const nextRec = records.filter(r => r.status === 'pending').sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  const verified = records.filter(r => r.status === 'verified').sort((a, b) => b.targetDate.localeCompare(a.targetDate));
  const roiColor = stats.roi >= 0 ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* 下期竞猜状态卡 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
          下期竞猜
        </h3>
        {nextRec ? (
          <>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="font-black text-slate-700">目标开奖日: {nextRec.targetDate}</span>
              <span className="text-slate-300">|</span>
              <span>期号 {nextRec.periodId}</span>
              <span className="text-slate-300">|</span>
              <span className="text-amber-600 font-bold">待开奖</span>
            </div>
            <div className="space-y-2">
              {nextRec.picks.map((nums, i) => {
                const front = nums.slice(0, 5);
                const back = nums.slice(5, 7);
                const sum = front.reduce((a, b) => a + b, 0);
                const range = Math.max(...front) - Math.min(...front);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-1.5 bg-slate-50 rounded-2xl px-4 py-3">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">第{i + 1}组</span>
                    {front.map((n, j) => (
                      <span key={j} className="w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-black flex items-center justify-center">{n}</span>
                    ))}
                    <span className="text-slate-300 mx-1">|</span>
                    {back.map((n, j) => (
                      <span key={j} className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">{n}</span>
                    ))}
                    <span className="text-[10px] text-slate-400 ml-2">和值{sum} · 极差{range}</span>
                    <button
                      onClick={() => handleRemovePick(nextRec.targetDate, i)}
                      className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 transition-all"
                    >
                      移出竞猜
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-400">
              生成于 {new Date(nextRec.createdAt).toLocaleString('zh-CN', { hour12: false })} · 参数: 和值 {nextRec.params.sumMin}-{nextRec.params.sumMax} · 极差 {nextRec.params.rangeMin}-{nextRec.params.rangeMax} · 智能体每日10:00自动生成
            </p>
          </>
        ) : (
          <div className="text-center py-8 text-slate-400 text-sm">
            <p className="font-bold mb-1">暂无待开奖的竞猜序列</p>
            <p className="text-xs">后端智能体每日 10:00 自动生成下期竞猜(2 组),首次记录需等下一开奖日(周一/三/六)</p>
            <button onClick={load} className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">刷新</button>
          </div>
        )}
      </div>

      {/* 竞猜统计 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-600 rounded-full"></span>
          竞猜统计
        </h3>
        {stats.totalPicks > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-slate-800">{stats.totalPeriods}</div>
                <div className="text-[10px] text-slate-400 font-bold">已验证期数</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-slate-800">{(stats.pickSuccessRate * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 font-bold">条目成功率 ({stats.winningPicks}/{stats.totalPicks})</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-slate-800">{stats.winDays}天</div>
                <div className="text-[10px] text-slate-400 font-bold">获胜天数</div>
              </div>
              <div className={`rounded-2xl p-4 text-center ${stats.roi >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <div className={`text-2xl font-black ${roiColor}`}>{stats.roi >= 0 ? '+' : ''}{(stats.roi * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 font-bold">综合 ROI</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 bg-slate-50 rounded-2xl px-4 py-3">
              <span>总投入: <b className="text-slate-700">{fmtMoney(stats.totalCost)}</b> ({stats.totalPicks}条 × {PICK_COST}元)</span>
              <span>总奖金: <b className="text-emerald-600">{fmtMoney(stats.totalPrize)}</b></span>
              <span className="text-slate-300">·</span>
              <span>盈亏: <b className={stats.totalPrize - stats.totalCost >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtMoney(stats.totalPrize - stats.totalCost)}</b></span>
            </div>
            <p className="text-[10px] text-slate-400">注: 一二等奖为浮动奖金,取 500.com 开奖实际单注奖金;历史数据无奖金字段时按 0 计</p>
          </>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm">尚无已验证的竞猜记录</div>
        )}
      </div>

      {/* 历史竞猜列表 */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-slate-700 rounded-full"></span>
          历史竞猜
          <span className="text-xs font-normal text-slate-400">({verified.length}期)</span>
        </h3>
        {verified.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">暂无历史记录</div>
        ) : (
          <div className="space-y-2">
            {verified.map(rec => {
              const prize = rec.totalPrize ?? 0;
              const win = rec.results?.filter(r => r.tier) ?? [];
              const open = expanded === rec.targetDate;
              return (
                <div key={rec.targetDate} className="border border-slate-100 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : rec.targetDate)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 text-left"
                  >
                    <span className="text-sm font-bold text-slate-700">{rec.targetDate}</span>
                    <span className="text-xs text-slate-400">{rec.drawId ?? rec.periodId}</span>
                    {win.length > 0 ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                        ✓ 中奖 {win.map(w => `${TIER_NAMES[w.tier!]}${fmtMoney(w.amount)}`).join(' + ')}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">✗ 未中奖</span>
                    )}
                    <span className={`ml-auto text-sm font-black ${prize > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {prize > 0 ? `+${fmtMoney(prize)}` : '−'}{fmtMoney(rec.picks.length * PICK_COST)}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-3 space-y-1.5 bg-slate-50/50">
                      {rec.picks.map((nums, i) => {
                        const r = rec.results?.[i];
                        const front = nums.slice(0, 5);
                        const back = nums.slice(5, 7);
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-[10px] font-bold text-slate-400 w-10">第{i + 1}组</span>
                            <span className="flex gap-1">{front.map((n, j) => (
                              <span key={j} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${r?.tier ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
                            ))}</span>
                            <span className="text-slate-300 mx-0.5">|</span>
                            <span className="flex gap-1">{back.map((n, j) => (
                              <span key={j} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${r?.tier ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
                            ))}</span>
                            <span className={`ml-2 font-bold ${r?.tier ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {r?.tier ? `${TIER_NAMES[r.tier]} ${fmtMoney(r.amount)}` : '未中'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loading && <p className="text-center text-xs text-slate-400">加载中...</p>}
    </div>
  );
};

export default GuessView;
