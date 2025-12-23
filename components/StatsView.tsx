
import React, { useMemo, useState } from 'react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { LottoDraw } from '../types';

interface Props {
  history: LottoDraw[];
}

const StatsView: React.FC<Props> = ({ history }) => {
  // 1. Position-based Top Frequency
  const positionStats = useMemo(() => {
    const stats = [1, 2, 3, 4, 5].map(() => ({} as Record<number, number>));
    history.forEach(d => {
      const sortedFront = [...d.front].sort((a, b) => a - b);
      sortedFront.forEach((num, idx) => {
        stats[idx][num] = (stats[idx][num] || 0) + 1;
      });
    });
    return stats.map(s => 
      Object.entries(s)
        .map(([num, count]) => ({ num: parseInt(num), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );
  }, [history]);

  // 2. Rear Zone 2D Combination Heatmap (12x12)
  const rearHeatmap = useMemo(() => {
    const heatmap: number[][] = Array(13).fill(0).map(() => Array(13).fill(0));
    let maxFreq = 0;
    history.forEach(d => {
      const [b1, b2] = [...d.back].sort((a, b) => a - b);
      heatmap[b1][b2]++;
      if (heatmap[b1][b2] > maxFreq) maxFreq = heatmap[b1][b2];
    });
    return { data: heatmap, max: maxFreq };
  }, [history]);

  const sumTrendData = useMemo(() => {
    return [...history].reverse().slice(-50).map(d => ({
      date: d.date.split('-').slice(1).join('/'),
      sum: d.front.reduce((a, b) => a + b, 0),
      id: d.id
    }));
  }, [history]);

  const [activePosTab, setActivePosTab] = useState(0);

  return (
    <div className="space-y-6 pb-4">
      {/* Sum Trend Chart */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>前区和值走势</span>
          <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 bg-slate-100 rounded">近50期</span>
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sumTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
              />
              <Line 
                type="monotone" 
                dataKey="sum" 
                stroke="#6366f1" 
                strokeWidth={2} 
                dot={{ r: 2, fill: '#6366f1' }}
                animationDuration={1000}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Position Frequency */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-3">前区位置热号 (Top 5)</h3>
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1 no-scrollbar">
          {[1, 2, 3, 4, 5].map((pos, idx) => (
            <button
              key={pos}
              onClick={() => setActivePosTab(idx)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${
                activePosTab === idx ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-500'
              }`}
            >
              第 {pos} 位
            </button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {positionStats[activePosTab].map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-600 font-black rounded-xl border border-red-100 text-sm">
                {item.num.toString().padStart(2, '0')}
              </div>
              <span className="text-[10px] text-slate-400 font-bold">{item.count}次</span>
            </div>
          ))}
        </div>
      </section>

      {/* Rear Combination Heatmap */}
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
              const isCombo = row < col; // Only upper triangle since back numbers are sorted
              
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
                  {/* Axis indicators */}
                  {row === 1 && <span className="absolute -top-4 text-[8px] font-bold text-slate-300">{col}</span>}
                  {col === 12 && <span className="absolute -right-4 text-[8px] font-bold text-slate-300">{row}</span>}
                </div>
              );
            });
          })}
        </div>
        <p className="text-[9px] text-slate-400 mt-6 text-center italic">说明：纵轴(1-12)与横轴(1-12)交点代表该两号组合出现的频次</p>
      </section>
    </div>
  );
};

export default StatsView;
