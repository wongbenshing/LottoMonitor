import React from 'react';

interface Props {
  onAgree: () => void;
}

const DisclaimerModal: React.FC<Props> = ({ onAgree }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 背景遮罩 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* 弹窗内容 */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-[90%] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-300">
        {/* 头部图标 */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-6 rounded-t-3xl">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-black text-white text-center mt-4">使用声明</h2>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            欢迎使用大乐透智析！
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">请您了解以下重要信息：</p>
            
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0">1</span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  本工具仅供<span className="font-bold text-slate-800">娱乐和学习数据分析</span>使用，不构成任何投注建议。
                </p>
              </div>
              
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0">2</span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  彩票开奖是<span className="font-bold text-slate-800">完全随机的独立事件</span>，历史开奖数据不代表未来结果。
                </p>
              </div>
              
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0">3</span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  AI 选号功能基于概率统计模型生成，<span className="font-bold text-slate-800">不保证中奖</span>，请理性购彩。
                </p>
              </div>
              
              <div className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0">4</span>
                <p className="text-sm text-slate-600 leading-relaxed">
                  购彩有风险，投注需谨慎，请<span className="font-bold text-slate-800">量力而行，切勿沉迷</span>。
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            点击"我已了解并同意"即表示您理解并接受以上声明
          </p>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 pt-0">
          <button
            onClick={onAgree}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            我已了解并同意
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;
