import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误兜底:任何渲染期异常都不再白屏。
 *
 * 背景(lottomonitor 2026-11-24 白屏事故):App.tsx 曾在 setState updater 内直接
 * `localStorage.setItem('dlt_history', ...)`,当站点配额被占满(投注站同域下还有
 * ainews/association 等多个站点共享 localStorage 配额)时抛 QuotaExceededError,
 * 由于发生在 React 渲染阶段,导致整棵树被卸载 → 页面加载完立刻变成空白,且没有任何提示。
 * 现在缓存写入已改为 try/catch + 降级,这里再加一层兜底,让异常可见、可恢复。
 */
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[lotto] 页面渲染异常:', error, info?.componentStack);
  }

  /** 清掉本地缓存(通常是配额超限损坏的 dlt_history)后重载 */
  private handleReset = (): void => {
    try {
      localStorage.removeItem('dlt_history');
    } catch {
      /* 忽略:localStorage 不可用时仍允许重试 */
    }
    window.location.reload();
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-4 text-center">
          <div className="text-3xl">😵</div>
          <h1 className="text-lg font-black text-slate-800">页面加载出错</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            常见原因:浏览器本地存储(localStorage)已被占满,历史数据缓存写入失败。
            点击下方按钮清除本站缓存并重新加载即可恢复,不影响云端开奖数据。
          </p>
          <p className="text-[10px] text-slate-400 break-all bg-slate-50 rounded-xl px-3 py-2">
            {error.message || String(error)}
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              清除缓存并重试
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold"
            >
              重新加载
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
