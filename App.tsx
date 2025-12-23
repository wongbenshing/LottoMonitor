
import React, { useState, useEffect, useCallback } from 'react';
import { TabType, LottoDraw } from './types';
import { INITIAL_DATA } from './constants';
import HistoryView from './components/HistoryView';
import AnalyzerView from './components/AnalyzerView';
import StatsView from './components/StatsView';
import AIView from './components/AIView';
import BottomNav from './components/BottomNav';
import { crawlLottoHistory } from './services/lottoService';

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>(TabType.HISTORY);
  const [history, setHistory] = useState<LottoDraw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const updateHistory = useCallback((newData: LottoDraw[]) => {
    setHistory(prev => {
      const merged = [...newData, ...prev].reduce((acc: LottoDraw[], curr) => {
        if (!acc.find(item => item.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);
      const sorted = merged.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      localStorage.setItem('dlt_history', JSON.stringify(sorted));
      return sorted;
    });
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const data = await crawlLottoHistory();
      if (data.length > 0) {
        updateHistory(data);
      }
    } catch (e) {
      console.error("Auto-sync failed", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initialize data and trigger auto-sync
  useEffect(() => {
    const saved = localStorage.getItem('dlt_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        setHistory(INITIAL_DATA);
      }
    } else {
      setHistory(INITIAL_DATA);
    }
    setIsLoading(false);
    
    // Auto sync on launch
    triggerSync();
  }, [updateHistory]);

  const renderContent = () => {
    switch (currentTab) {
      case TabType.HISTORY:
        return <HistoryView history={history} onUpdate={updateHistory} isSyncing={isSyncing} onSync={triggerSync} />;
      case TabType.ANALYZER:
        return <AnalyzerView history={history} />;
      case TabType.STATS:
        return <StatsView history={history} />;
      case TabType.AI:
        return <AIView history={history} />;
      default:
        return <HistoryView history={history} onUpdate={updateHistory} isSyncing={isSyncing} onSync={triggerSync} />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-10 glass-morphism border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">L</div>
          <div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
              超级大乐透智析
            </h1>
            {isSyncing && (
              <p className="text-[10px] text-blue-500 font-bold animate-pulse">正在同步云端数据...</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">数据存储</div>
          <div className="text-xs text-slate-600 font-bold">
            {history.length} 期数据
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {renderContent()}
      </main>

      <BottomNav activeTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};

export default App;
