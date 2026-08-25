
import React, { useState, useMemo } from 'react';
import { LottoDraw } from '../types';
import { PROMPT_STRATEGIES } from '../services/promptStrategies';
import { 
  runStrategyComparison, 
  simulateRandomStrategy, 
  StrategyComparison,
  StrategyEvaluation 
} from '../services/walkforwardService';
import { 
  LOCAL_STRATEGIES, 
  runLocalWalkForwardTest 
} from '../services/localStrategySimulator';

interface Props {
  history: LottoDraw[];
}

const WalkForwardView: React.FC<Props> = ({ history }) => {
  // 测试模式：'fast' = 本地算法（秒级），'full' = API调用（慢但准）
  const [testMode, setTestMode] = useState<'fast' | 'full'>('fast');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['balanced', 'hot_chasing', 'pure_random']);
  const [testPeriods, setTestPeriods] = useState<number>(50);
  const [windowSize, setWindowSize] = useState<number>(100);
  const [sampleInterval, setSampleInterval] = useState<number>(1); // 采样间隔：1=每期，2=隔期
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [result, setResult] = useState<StrategyComparison | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [testDuration, setTestDuration] = useState<number>(0); // 测试耗时

  // 快速模拟随机策略（不调用 API）
  const runQuickRandomTest = () => {
    const startTime = Date.now();
    setLoading(true);
    setTimeout(() => {
      const randomResult = simulateRandomStrategy(history, testPeriods);
      const mockComparison: StrategyComparison = {
        timestamp: Date.now(),
        testPeriods,
        windowSize,
        evaluations: [randomResult],
        winner: 'pure_random'
      };
      setResult(mockComparison);
      setTestDuration(Date.now() - startTime);
      setLoading(false);
    }, 100);
  };

  // 运行对比测试（支持快速/完整两种模式）
  const runComparison = async () => {
    if (selectedStrategies.length === 0) {
      alert('请至少选择一个策略');
      return;
    }
    if (testMode === 'full' && selectedStrategies.length > 3) {
      alert('完整模式下最多对比 3 个策略');
      return;
    }

    const startTime = Date.now();
    setLoading(true);
    setProgress({});
    setResult(null);

    try {
      if (testMode === 'fast') {
        // 快速模式：本地算法，无 API 调用
        const localResults = runLocalWalkForwardTest(history, selectedStrategies, {
          testPeriods,
          windowSize,
          sampleInterval
        });

        // 转换为 StrategyComparison 格式
        const evaluations: StrategyEvaluation[] = localResults.map(r => {
          const winCount = r.rounds.filter(round => round.bestPrize !== null).length;
          return {
            strategyId: r.strategyId,
            strategyName: r.strategyName,
            totalRounds: r.rounds.length,
            winCount,
            winRate: ((winCount / r.rounds.length) * 100).toFixed(1) + '%',
            prizeDistribution: [
              { tier: '9', name: '九等奖', count: winCount },
              { tier: '8', name: '八等奖', count: 0 },
              { tier: '7', name: '七等奖', count: 0 },
              { tier: '6', name: '六等奖', count: 0 },
              { tier: '5', name: '五等奖', count: 0 },
              { tier: '4', name: '四等奖', count: 0 },
              { tier: '3', name: '三等奖', count: 0 },
              { tier: '2', name: '二等奖', count: 0 },
              { tier: '1', name: '一等奖', count: 0 },
            ],
            avgSumDeviation: Math.round(
              r.rounds.reduce((s, round) => s + round.sumDeviation, 0) / r.rounds.length * 10
            ) / 10,
            avgDiffDeviation: Math.round(
              r.rounds.reduce((s, round) => s + round.diffDeviation, 0) / r.rounds.length * 10
            ) / 10,
            bestRound: null,
            rounds: r.rounds.map(round => ({
              round: 0,
              drawId: round.drawId,
              predicted: round.predicted,
              actual: round.actual,
              bestPrize: round.bestPrize,
              matchCount: round.matchCount,
              sumDeviation: round.sumDeviation,
              diffDeviation: round.diffDeviation
            }))
          };
        });

        const winner = evaluations
          .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))[0]?.strategyId || 'pure_random';

        setResult({
          timestamp: Date.now(),
          testPeriods,
          windowSize,
          evaluations,
          winner
        });
      } else {
        // 完整模式：调用 API
        const comparison = await runStrategyComparison(history, selectedStrategies, {
          testPeriods,
          windowSize,
          onProgress: (strategy, p) => {
            setProgress(prev => ({ ...prev, [strategy]: p }));
          }
        });
        setResult(comparison);
      }
      setTestDuration(Date.now() - startTime);
    } catch (e) {
      console.error(e);
      alert('测试失败：' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 获取选中策略的详细数据
  const selectedEvaluation = useMemo(() => {
    if (!result || !selectedStrategy) return null;
    return result.evaluations.find(e => e.strategyId === selectedStrategy);
  }, [result, selectedStrategy]);

  // 颜色配置（API策略和本地策略共用）
  const getStrategyColor = (id: string) => {
    const colors: Record<string, string> = {
      // API 策略
      balanced: 'bg-blue-500',
      hot_chasing: 'bg-red-500',
      cold_rebound: 'bg-cyan-500',
      interval_focused: 'bg-purple-500',
      pure_random: 'bg-slate-500',
      // 本地策略（同名）
      'balanced': 'bg-blue-500',
      'hot_chasing': 'bg-red-500',
      'cold_rebound': 'bg-cyan-500',
      'interval_focused': 'bg-purple-500',
      'pure_random': 'bg-slate-500'
    };
    return colors[id] || 'bg-slate-500';
  };

  return (
    <div className="space-y-6 pb-4">
      {/* 配置面板 */}
      <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-indigo-600 rounded-full"></span>
          Walk-forward 策略对比
        </h3>
        
        <div className="space-y-4">
          {/* 测试模式切换 */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setTestMode('fast')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                testMode === 'fast' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ⚡ 快速测试（本地算法）
            </button>
            <button
              onClick={() => setTestMode('full')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                testMode === 'full' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🧠 完整测试（AI模型）
            </button>
          </div>

          {/* 模式说明 */}
          <div className={`text-[10px] p-2 rounded-lg ${
            testMode === 'fast' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {testMode === 'fast' 
              ? '快速模式使用本地算法模拟策略，无需调用API，可在几秒内完成大量测试。适合快速筛选策略。'
              : '完整模式调用DeepSeek API，使用真实Prompt策略，更准确但较慢。适合最终验证。'
            }
          </div>

          {/* 策略选择 */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              选择对比策略（最多{testMode === 'full' ? '3' : '5'}个）
            </label>
            <div className="flex flex-wrap gap-2">
              {(testMode === 'fast' ? LOCAL_STRATEGIES : PROMPT_STRATEGIES).map(strategy => (
                <button
                  key={strategy.id}
                  onClick={() => {
                    if (selectedStrategies.includes(strategy.id)) {
                      setSelectedStrategies(prev => prev.filter(id => id !== strategy.id));
                    } else if (selectedStrategies.length < (testMode === 'full' ? 3 : 5)) {
                      setSelectedStrategies(prev => [...prev, strategy.id]);
                    }
                  }}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${
                    selectedStrategies.includes(strategy.id)
                      ? `${getStrategyColor(strategy.id)} text-white shadow-md`
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {strategy.name}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              {(testMode === 'fast' ? LOCAL_STRATEGIES : PROMPT_STRATEGIES)
                .find(s => s.id === selectedStrategies[0])?.description}
            </p>
          </div>

          {/* 参数设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                测试期数
              </label>
              <select
                value={testPeriods}
                onChange={(e) => setTestPeriods(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value={20}>20期</option>
                <option value={50}>50期（推荐）</option>
                <option value={100}>100期</option>
                {testMode === 'fast' && <option value={200}>200期（大量）</option>}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                历史窗口
              </label>
              <select
                value={windowSize}
                onChange={(e) => setWindowSize(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value={50}>50期</option>
                <option value={100}>100期</option>
                <option value={200}>200期</option>
              </select>
            </div>
          </div>

          {/* 采样间隔（仅快速模式） */}
          {testMode === 'fast' && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                采样间隔（减少计算量）
              </label>
              <select
                value={sampleInterval}
                onChange={(e) => setSampleInterval(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value={1}>每期都测（最准，较慢）</option>
                <option value={2}>隔期测试（平衡）</option>
                <option value={5}>每5期测一次（最快）</option>
              </select>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <button
              onClick={runComparison}
              disabled={loading || selectedStrategies.length === 0}
              className={`flex-1 py-3 ${
                testMode === 'fast' ? 'bg-green-600' : 'bg-indigo-600'
              } text-white rounded-xl font-bold shadow-md active:scale-95 transition-all ${
                loading ? 'opacity-50' : ''
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                  测试中...
                </span>
              ) : (
                `${testMode === 'fast' ? '⚡ 快速测试' : '🧠 完整测试'} (${selectedStrategies.length}个策略)`
              )}
            </button>
            <button
              onClick={runQuickRandomTest}
              disabled={loading}
              className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              纯随机
            </button>
          </div>

          {/* 进度显示 */}
          {loading && testMode === 'full' && Object.keys(progress).length > 0 && (
            <div className="space-y-2 bg-slate-50 p-3 rounded-xl">
              {Object.entries(progress).map(([name, p]) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600 w-20">{name}</span>
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${p}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-400 w-10 text-right">{p}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 结果概览 */}
      {result && (
        <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">测试结果概览</h3>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block">
                测试期数: {result.testPeriods} | 窗口: {result.windowSize}
              </span>
              <span className="text-[10px] text-green-600 font-bold">
                耗时: {(testDuration / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          {/* 策略对比表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase">策略</th>
                  <th className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase">中奖率</th>
                  <th className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase">九等奖+</th>
                  <th className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase">和值误差</th>
                  <th className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase">极差误差</th>
                  <th className="text-center py-2 text-[10px] font-bold text-slate-400 uppercase">操作</th>
                </tr>
              </thead>
              <tbody>
                {result.evaluations.map(eva => (
                  <tr 
                    key={eva.strategyId} 
                    className={`border-b border-slate-50 ${eva.strategyId === result.winner ? 'bg-green-50/50' : ''}`}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${getStrategyColor(eva.strategyId)}`}></div>
                        <span className="font-bold text-slate-700">{eva.strategyName}</span>
                        {eva.strategyId === result.winner && (
                          <span className="text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full">最佳</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center py-3">
                      <span className={`font-black ${parseFloat(eva.winRate) > 20 ? 'text-green-600' : 'text-slate-600'}`}>
                        {eva.winRate}
                      </span>
                    </td>
                    <td className="text-center py-3 text-slate-600">
                      {eva.prizeDistribution.slice(-3).reduce((s, p) => s + p.count, 0)}次
                    </td>
                    <td className="text-center py-3 text-slate-600">
                      ±{eva.avgSumDeviation}
                    </td>
                    <td className="text-center py-3 text-slate-600">
                      ±{eva.avgDiffDeviation}
                    </td>
                    <td className="text-center py-3">
                      <button
                        onClick={() => setSelectedStrategy(eva.strategyId)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 奖项分布图 */}
          <div className="mt-6">
            <h4 className="text-xs font-bold text-slate-500 mb-3">奖项分布对比</h4>
            <div className="space-y-3">
              {['九等奖', '八等奖', '七等奖'].map((name, idx) => {
                const tier = String(9 - idx);
                const maxCount = Math.max(...result.evaluations.map(e => 
                  e.prizeDistribution.find(p => p.tier === tier)?.count || 0
                ));
                
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-14">{name}</span>
                    <div className="flex-1 flex gap-2">
                      {result.evaluations.map(eva => {
                        const count = eva.prizeDistribution.find(p => p.tier === tier)?.count || 0;
                        const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
                        return (
                          <div key={eva.strategyId} className="flex-1 flex items-center gap-1">
                            <div 
                              className={`h-4 rounded ${getStrategyColor(eva.strategyId)}`}
                              style={{ width: `${Math.max(width, 5)}%` }}
                            />
                            <span className="text-[9px] text-slate-400">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 详细结果 */}
      {selectedEvaluation && (
        <section className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStrategyColor(selectedEvaluation.strategyId)}`}></div>
              {selectedEvaluation.strategyName} - 详细记录
            </h3>
            <button 
              onClick={() => setSelectedStrategy(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600"
            >
              收起
            </button>
          </div>

          {/* 轮次列表 */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {selectedEvaluation.rounds.map((round, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-xl text-xs ${
                  round.bestPrize ? 'bg-green-50 border border-green-100' : 'bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-600">第{round.drawId}期</span>
                  <div className="flex items-center gap-3">
                    {round.bestPrize && (
                      <span className="font-bold text-green-600">
                        {['', '一等奖', '二等奖', '三等奖', '四等奖', '五等奖', '六等奖', '七等奖', '八等奖', '九等奖'][parseInt(round.bestPrize)]}
                      </span>
                    )}
                    <span className="text-slate-400">命中{round.matchCount}个</span>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-slate-400">预测:</span>
                  {round.predicted[0]?.slice(0, 5).map((n, i) => (
                    <span key={i} className="w-5 h-5 bg-red-100 text-red-600 rounded flex items-center justify-center text-[10px] font-bold">
                      {n.toString().padStart(2, '0')}
                    </span>
                  ))}
                  <span className="text-slate-300">|</span>
                  {round.predicted[0]?.slice(5, 7).map((n, i) => (
                    <span key={i} className="w-5 h-5 bg-blue-100 text-blue-600 rounded flex items-center justify-center text-[10px] font-bold">
                      {n.toString().padStart(2, '0')}
                    </span>
                  ))}
                  <span className="text-slate-300 mx-1">→</span>
                  <span className="text-slate-400">实际:</span>
                  {round.actual.front.map((n, i) => (
                    <span key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                      round.predicted[0]?.slice(0, 5).includes(n) 
                        ? 'bg-red-500 text-white' 
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {n.toString().padStart(2, '0')}
                    </span>
                  ))}
                  <span className="text-slate-300">|</span>
                  {round.actual.back.map((n, i) => (
                    <span key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                      round.predicted[0]?.slice(5, 7).includes(n) 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-slate-200 text-slate-500'
                    }`}>
                      {n.toString().padStart(2, '0')}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default WalkForwardView;
