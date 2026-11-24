import React, { useState, useEffect, useCallback } from 'react';
import { TabType, LottoDraw, ViewMode, AnalysisSummary } from './types';
import { INITIAL_DATA } from './constants';
import HistoryView from './components/HistoryView';
import AnalyzerView from './components/AnalyzerView';
import StatsView from './components/StatsView';
import AIView from './components/AIView';
import WalkForwardView from './components/WalkForwardView';
import GuessView from './components/GuessView';
import BottomNav from './components/BottomNav';
import { fetchServerCSV } from './services/lottoService';
import { crawlLottoHistory, fetchLocalCSV } from './services/lottoService';
import DisclaimerModal from './components/DisclaimerModal';
import AgeVerification from './components/AgeVerification';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.PORTAL);
  const [currentTab, setCurrentTab] = useState<TabType>(TabType.HISTORY);
  const [history, setHistory] = useState<LottoDraw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showAgeVerification, setShowAgeVerification] = useState(false);
  
  // AI选号结果状态（提升到父组件，切换页面不丢失）
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisSummary | null>(null);

  // v1.3.1 持久化历史数据到 localStorage:配额超限时逐级降级,绝不让缓存异常影响渲染
  // ⚠ 必须放在 effect 里:以前写在 setState updater 内,QuotaExceededError 会在渲染阶段抛出 → 整树卸载 → 白屏
  const persistHistory = useCallback((data: LottoDraw[]) => {
    if (data.length === 0) return;
    try {
      localStorage.setItem('dlt_history', JSON.stringify(data));
    } catch {
      try {
        // 降级 1:只缓存最近 500 期(页面展示只用最新 100 条,云端每次都会重新拉全量)
        localStorage.setItem('dlt_history', JSON.stringify(data.slice(0, 500)));
        console.warn('[lotto] localStorage 配额不足,已降级为只缓存最近 500 期');
      } catch {
        try {
          localStorage.removeItem('dlt_history');
        } catch {
          /* localStorage 完全不可用时忽略 */
        }
        console.warn('[lotto] localStorage 不可用,已关闭历史数据本地缓存(不影响页面使用)');
      }
    }
  }, []);

  // 更新并持久化数据
  const updateHistory = useCallback((newData: LottoDraw[]) => {
    setHistory(prev => {
      // 合并并去重
      const merged = [...newData, ...prev].reduce((acc: LottoDraw[], curr) => {
        if (!acc.find(item => item.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      // 按期号倒序排
      return merged.sort((a, b) => parseInt(b.id) - parseInt(a.id));
    });
  }, []);

  // 历史数据变化后再落盘(副作用移出 setState updater)
  useEffect(() => {
    persistHistory(history);
  }, [history, persistHistory]);

  // 从后端获取最新的 CSV
  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const serverData = await fetchServerCSV();
      if (serverData.length > 0) {
        updateHistory(serverData);
      }
    } catch (e) {
      console.warn("Server CSV sync failed, keeping local/cached data.", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // 检查用户是否已完成年龄验证和同意免责声明
  useEffect(() => {
    const ageVerified = localStorage.getItem('ageVerified');
    const hasAgreed = localStorage.getItem('dlt_disclaimer_agreed');
    
    if (!ageVerified) {
      // 先显示年龄验证
      setShowAgeVerification(true);
    } else if (!hasAgreed) {
      // 已验证年龄但未同意免责声明
      setShowDisclaimer(true);
    }
  }, []);

  // 处理年龄验证通过
  const handleAgeVerified = () => {
    setShowAgeVerification(false);
    setShowDisclaimer(true);
  };

  // 处理用户同意免责声明
  const handleAgreeDisclaimer = () => {
    localStorage.setItem('dlt_disclaimer_agreed', 'true');
    setShowDisclaimer(false);
  };

  useEffect(() => {
    const initData = async () => {
      try {
        // 1. 尝试从本地持久化加载
        const saved = localStorage.getItem('dlt_history');
        // v1.3.1 缓存可能是降级子集或写坏的脏数据:解析后校验结构,异常一律当空缓存
        let cachedData: LottoDraw[] = [];
        try {
          const parsed = saved ? JSON.parse(saved) : [];
          cachedData = Array.isArray(parsed)
            ? parsed.filter((d: LottoDraw) => d && d.id && Array.isArray(d.front) && Array.isArray(d.back))
            : [];
        } catch (e) {
          console.warn('[lotto] 本地缓存解析失败,已忽略:', e);
          cachedData = [];
        }

        if (cachedData.length > 0) {
          setHistory(cachedData);
          setIsLoading(false);
        }

        // 2. 无论是否有缓存，都去云端拉一次最新的
        const serverData = await fetchServerCSV();
        if (serverData.length > 0) {
          updateHistory(serverData);
        } else if (cachedData.length === 0) {
          // 如果云端也挂了且没缓存，用兜底数据
          setHistory(INITIAL_DATA);
        }
      } catch (err) {
        console.error("Init failed", err);
        // 如果全失败了，确保 UI 能显示
        setHistory(prev => prev.length > 0 ? prev : INITIAL_DATA);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, [updateHistory]);

  const renderLottoContent = () => {
    switch (currentTab) {
      case TabType.HISTORY:
        return <HistoryView history={history} onUpdate={updateHistory} isSyncing={isSyncing} onSync={triggerSync} />;
      case TabType.ANALYZER:
        return <AnalyzerView history={history} />;
      case TabType.STATS:
        return <StatsView history={history} />;
      case TabType.AI:
        return <AIView history={history} analysis={aiAnalysis} setAnalysis={setAiAnalysis} />;
      case TabType.WALKFORWARD:
        return <WalkForwardView history={history} />;
      case TabType.GUESS:
        return <GuessView />;
      default:
        return <HistoryView history={history} onUpdate={updateHistory} isSyncing={isSyncing} onSync={triggerSync} />;
    }
  };

  // if (viewMode === ViewMode.PORTAL) {
  //   return <AppCenter onLaunchApp={setViewMode} />;
  // }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-slate-400 font-bold text-sm animate-pulse">正在获取云端开奖库...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 animate-in slide-in-from-right duration-300">
      <BottomNav activeTab={currentTab} onTabChange={setCurrentTab} />
      
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 left-0 right-0 z-50 glass-morphism border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/*<Logo size="sm" />*/}
            <div>
              <h1 className="text-md font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                大乐透智析
              </h1>
              {isSyncing && (
                <p className="text-[10px] text-blue-500 font-bold animate-pulse">云端同步中</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">样本量</div>
            <div className="text-xs text-slate-600 font-black">
              {history.length} 期
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 max-w-4xl mx-auto w-full sm:ml-20 pb-20 sm:pb-4">
          {renderLottoContent()}
        </main>
      </div>

      {/* 年龄验证弹窗 */}
      {showAgeVerification && <AgeVerification onVerified={handleAgeVerified} />}
      
      {/* 免责声明弹窗 */}
      {showDisclaimer && <DisclaimerModal onAgree={handleAgreeDisclaimer} />}
    </div>
  );
};

export default App;
