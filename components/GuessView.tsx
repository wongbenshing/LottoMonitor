import React, { useEffect, useState } from 'react';
import type { GuessRecord, GuessStats, LottoDraw } from '../types';
import { fetchGuessRecords, removePickFromGuess } from '../services/guessService';
import {
  computeGuessStats, latestDraw, isUpgradeWindow, upgradeGap, expectedReturnRate, periodCost,
} from '../services/guessCore';
import { fetchServerCSV } from '../services/lottoService';
import { PICK_COST, UPGRADE_POOL_THRESHOLD, EXPECTED_RETURN_RATE, SMALL_TIER_THEORY_RETURN_RATE } from '../constants';

const TIER_NAMES: Record<string, string> = {
  '1': '一等奖', '2': '二等奖', '3': '三等奖', '4': '四等奖',
  '5': '五等奖', '6': '六等奖', '7': '七等奖',
};

const fmtMoney = (n: number): string => n >= 10000 ? `¥${(n / 10000).toFixed(2)}万` : `¥${n.toLocaleString()}`;

/** 金额(元) → 亿/万 中文读数 */
const fmtPool = (n?: number): string => {
  if (!n) return '未知';
  return n >= 1e8 ? `${(n / 1e8).toFixed(3)} 亿` : `${(n / 1e4).toFixed(0)} 万`;
};

const pct = (v: number, digits = 1): string => `${(v * 100).toFixed(digits)}%`;

const GuessView: React.FC = () => {
  const [records, setRecords] = useState<GuessRecord[]>([]);
  const [draws, setDraws] = useState<LottoDraw[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [recs, history] = await Promise.all([fetchGuessRecords(), fetchServerCSV().catch(() => [] as LottoDraw[])]);
    setRecords(recs);
    setDraws(history);
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

  // v1.4 奖池闸门:上期奖池 ≥8 亿 → 本期三至七等奖升档
  const lastDraw = latestDraw(draws);
  const inUpgradeWindow = isUpgradeWindow(draws);
  const gapToUpgrade = upgradeGap(draws);
  const currentEvRate = expectedReturnRate(lastDraw);
  // 卡片主口径用「分档实测均值」(新规 121 期),单期值波动大(p1/p2 浮动),放小字避免口径矛盾
  const windowEvRate = inUpgradeWindow ? EXPECTED_RETURN_RATE.upgrade : EXPECTED_RETURN_RATE.nonUpgrade;
  const suggestedPicks = inUpgradeWindow ? 2 : 1;

  return (
    <div className="space-y-6">
      {/* v1.4 奖池闸门卡(唯一能提升每元期望返还的机制) */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 space-y-3">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-amber-500 rounded-full"></span>
          奖池闸门
          <span className="text-xs font-normal text-slate-400">升档窗口决定每元期望返还</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-xl font-black text-slate-800">{fmtPool(lastDraw?.poolAfter)}</div>
            <div className="text-[10px] text-slate-400 font-bold">上期开奖后奖池</div>
          </div>
          <div className={`rounded-2xl p-4 text-center ${inUpgradeWindow ? 'bg-emerald-50' : 'bg-slate-50'}`}>
            <div className={`text-xl font-black ${inUpgradeWindow ? 'text-emerald-600' : 'text-slate-500'}`}>
              {inUpgradeWindow ? '升档窗口' : '非升档窗口'}
            </div>
            <div className="text-[10px] text-slate-400 font-bold">
              {inUpgradeWindow ? '三至七等奖升档(5→7 元等)' : `距 8 亿差 ${fmtPool(gapToUpgrade)}`}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-xl font-black text-blue-600">{pct(windowEvRate)}</div>
            <div className="text-[10px] text-slate-400 font-bold">该窗口每元期望返还</div>
            <div className="text-[9px] text-slate-400 mt-0.5">121 期分档均值 · 当期单期口径 {pct(currentEvRate)}</div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center">
            <div className="text-xl font-black text-slate-800">{suggestedPicks} 注</div>
            <div className="text-[10px] text-slate-400 font-bold">建议注数(软建议)</div>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 rounded-2xl px-4 py-3">
          规则:奖池 ≥8 亿 → <b>下期</b>三至七等奖单注奖金升档(5000→6666、150→200、
          <b>5→7</b> 元)。历史实测:升档期每元期望返还 {pct(EXPECTED_RETURN_RATE.upgrade)}、非升档期{' '}
          {pct(EXPECTED_RETURN_RATE.nonUpgrade)},窗口约占 {pct(40 / 121, 0)} 的期数。
          <br />
          <b>注数只是建议,不拦单</b>:非升档期默认降到 1 注以压低绝对亏损,想追加随时可在「下期竞猜」里手动加入。
          追加投注(每注 +1 元)只参与一/二等奖 80% 加奖,边际返还低于新买一注基本投注 —— 不建议追加。
        </p>
      </div>

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
            {nextRec.pickFeatures && nextRec.pickFeatures.length > 0 && (
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                {nextRec.pickFeatures.map((f, i) => (
                  <span key={i} className="bg-slate-50 rounded-lg px-2 py-1">
                    第{i + 1}组 和值{f.sum} · 极差{f.range} · 奇{f.oddCount} · 拥挤度
                    <b className={f.crowdingScore >= 50 ? 'text-orange-600' : 'text-emerald-600'}>{f.crowdingScore}</b>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              生成于 {new Date(nextRec.createdAt).toLocaleString('zh-CN', { hour12: false })} ·
              建议参数(仅作参考,不强制): 和值 {nextRec.params.sumMin}-{nextRec.params.sumMax} · 极差 {nextRec.params.rangeMin}-{nextRec.params.rangeMax} ·
              {nextRec.gate ? ` 闸门:${nextRec.gate.upgradeWindow ? '升档窗口' : '非升档窗口'} · 建议 ${nextRec.gate.suggestedPicks} 注 ·` : ''}
              智能体每日 10:00 自动生成
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
                <div className="text-[9px] text-slate-400 mt-0.5">含 5~18 元小奖,非实质中奖</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-slate-800">{stats.netWinPeriods}期</div>
                <div className="text-[10px] text-slate-400 font-bold">净回本期数</div>
                <div className="text-[9px] text-slate-400 mt-0.5">该期回收 &gt; 该期投入</div>
              </div>
              <div className={`rounded-2xl p-4 text-center ${stats.roi >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <div className={`text-2xl font-black ${roiColor}`}>{stats.roi >= 0 ? '+' : ''}{(stats.roi * 100).toFixed(1)}%</div>
                <div className="text-[10px] text-slate-400 font-bold">综合 ROI</div>
                <div className="text-[9px] text-slate-400 mt-0.5">期望上限约 -44%(制度抽水)</div>
              </div>
            </div>

            {/* v1.3 分层口径:小奖返还率可对照理论值判断系统是否在数学上正常运作 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 rounded-2xl p-4 text-center">
                <div className="text-xl font-black text-blue-700">{pct(stats.smallTierReturnRate)}</div>
                <div className="text-[10px] text-slate-500 font-bold">小奖返还率(六/七等)</div>
                <div className="text-[9px] text-slate-400 mt-0.5">理论 {pct(SMALL_TIER_THEORY_RETURN_RATE)} · 与理论吻合即数学正常</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className="text-xl font-black text-slate-800">{pct(stats.longTailReturnRate)}</div>
                <div className="text-[10px] text-slate-400 font-bold">长尾返还率(一~五等)</div>
                <div className="text-[9px] text-slate-400 mt-0.5">小样本几乎为 0,100 注内看不见</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className={`text-xl font-black ${stats.upgradeNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmtMoney(stats.upgradeNet)}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">升档窗口净盈亏({stats.upgradePeriods}期)</div>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 text-center">
                <div className={`text-xl font-black ${stats.nonUpgradeNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {fmtMoney(stats.nonUpgradeNet)}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">非升档期净盈亏({stats.nonUpgradePeriods}期)</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-slate-500 bg-slate-50 rounded-2xl px-4 py-3">
              <span>总投入: <b className="text-slate-700">{fmtMoney(stats.totalCost)}</b> ({stats.totalPicks}条 × {PICK_COST}元)</span>
              <span>总奖金: <b className="text-emerald-600">{fmtMoney(stats.totalPrize)}</b></span>
              <span className="text-slate-300">·</span>
              <span>盈亏: <b className={stats.totalPrize - stats.totalCost >= 0 ? 'text-emerald-600' : 'text-red-600'}>{fmtMoney(stats.totalPrize - stats.totalCost)}</b></span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              口径: 一/二等奖取官方当期单注奖金(浮动),三至七等奖取官方当期值(含奖池 ≥8 亿升档);
              官方字段缺失的记录会标 dataIncomplete 并在后台告警,不再静默按默认档结算。
              制度返还率约 51%~56%,长期期望为负 —— ROI 不可能转正,可优化的是「每元期望返还」(选升档窗口)与「绝对亏损」(控注数)。
            </p>
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
                    {(rec.gate?.upgradeWindow ?? rec.drawSnapshot?.isUpgradeWindow) && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-1.5 py-0.5">升档</span>
                    )}
                    {rec.dataIncomplete && (
                      <span title="官方奖金字段缺失,金额可能不完整" className="text-[10px] font-bold text-orange-600 bg-orange-50 rounded-full px-1.5 py-0.5">数据缺</span>
                    )}
                    {win.length > 0 ? (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                        ✓ 中奖 {win.map(w => `${TIER_NAMES[w.tier!]}${fmtMoney(w.amount)}`).join(' + ')}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">✗ 未中奖</span>
                    )}
                    <span className="ml-auto text-sm font-black whitespace-nowrap">
                      {prize > 0 && <span className="text-emerald-600">+{fmtMoney(prize)}</span>}
                      <span className={prize > 0 ? 'text-slate-500 ml-1.5' : 'text-slate-400'}>
                        −{fmtMoney(periodCost(rec))}
                      </span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-3 space-y-1.5 bg-slate-50/50">
                      {rec.picks.map((nums, i) => {
                        const r = rec.results?.[i];
                        const front = nums.slice(0, 5);
                        const back = nums.slice(5, 7);
                        // v1.2.4: 只给命中开奖号码的球上色(前区绿/后区紫),未命中保持灰
                        const draw = draws.find(d => d.date === rec.targetDate);
                        const hitFront = (n: number) => !!draw?.front.includes(n);
                        const hitBack = (n: number) => !!draw?.back.includes(n);
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-[10px] font-bold text-slate-400 w-10">第{i + 1}组</span>
                            <span className="flex gap-1">{front.map((n, j) => (
                              <span key={j} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${hitFront(n) ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
                            ))}</span>
                            <span className="text-slate-300 mx-0.5">|</span>
                            <span className="flex gap-1">{back.map((n, j) => (
                              <span key={j} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${hitBack(n) ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{n}</span>
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
