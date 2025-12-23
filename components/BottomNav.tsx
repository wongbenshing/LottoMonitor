
import React from 'react';
import { TabType } from '../types';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

const BottomNav: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: TabType.HISTORY, label: '历史', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: TabType.ANALYZER, label: '回测', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: TabType.STATS, label: '走势', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: TabType.AI, label: 'AI选号', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 glass-morphism border-t border-slate-200 px-6 safe-bottom z-50">
      <div className="flex justify-between items-center h-16">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] transition-all ${
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon}></path>
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-0.5 animate-pulse"></div>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
