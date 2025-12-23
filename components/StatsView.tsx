
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { LottoDraw } from '../types';

interface Props {
  history: LottoDraw[];
}

const StatsView: React.FC<Props> = ({ history }) => {
  const frontStats = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 35; i++) counts[i] = 0;
    history.forEach(d => d.front.forEach(n => counts[n]++));
    return Object.entries(counts).map(([num, count]) => ({ num: parseInt(num), count }))
      .sort((a, b) => b.count - a.count);
  }, [history]);

  const backStats = useMemo(() => {
    const counts: Record<number, number> = {};
    for (let i = 1; i <= 12; i++) counts[i] = 0;
    history.forEach(d => d.back.forEach(n => counts[n]++));
    return Object.entries(counts).map(([num, count]) => ({ num: parseInt(num), count }))
      .sort((a, b) => b.count - a.count);
  }, [history]);

  const sumTrendData = useMemo(() => {
    // Only show last 50 draws for trend clarity
    return [...history].reverse().slice(-50).map(d => ({
      date: d.date.split('-').slice(1).join('/'),
      sum: d.front.reduce((a, b) => a + b, 0),
      id: d.id
    }));
  }, [history]);

  return (
    <div className="space-y-6 pb-4">
      {/* Sum Trend Chart */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>前区之和走势 (近50期)</span>
          <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 bg-slate-100 rounded">和值范围: 15-165</span>
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sumTrendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{fontSize: 9, fill: '#94a3b8'}} hide />
              <YAxis domain={['dataMin - 10', 'dataMax + 10']} hide />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Line 
                type="monotone" 
                dataKey="sum" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ r: 3, fill: '#6366f1', strokeWidth: 2 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">最热前区</h3>
          <div className="flex items-center gap-3">
             <span className="text-3xl font-black text-red-600">{frontStats[0]?.num.toString().padStart(2, '0')}</span>
             <span className="text-[10px] text-slate-400 font-medium">出现 {frontStats[0]?.count} 次</span>
          </div>
        </section>
        <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">最热后区</h3>
          <div className="flex items-center gap-3">
             <span className="text-3xl font-black text-blue-600">{backStats[0]?.num.toString().padStart(2, '0')}</span>
             <span className="text-[10px] text-slate-400 font-medium">出现 {backStats[0]?.count} 次</span>
          </div>
        </section>
      </div>

      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">前区频率统计 (Top 10)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frontStats.slice(0, 10)} layout="vertical" margin={{ left: -20 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="num" type="category" tick={{fontSize: 12, fontWeight: 'bold'}} />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {frontStats.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`rgba(239, 68, 68, ${1 - index * 0.08})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4">后区频率分布</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={backStats}>
              <XAxis dataKey="num" tick={{fontSize: 10, fontWeight: 'bold'}} />
              <YAxis hide />
              <Tooltip cursor={{fill: 'transparent'}} />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default StatsView;
