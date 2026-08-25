import React, { useState } from 'react';

interface AgeVerificationProps {
  onVerified: () => void;
}

export const AgeVerification: React.FC<AgeVerificationProps> = ({ onVerified }) => {
  const [confirmed, setConfirmed] = useState(false);

  const handleVerify = () => {
    if (!confirmed) return;
    localStorage.setItem('ageVerified', 'true');
    onVerified();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">年龄验证</h2>
          <p className="text-slate-500">请确认您已满18周岁</p>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800 text-sm text-center font-medium">
            根据相关法律法规，禁止向未成年人提供彩票相关服务
          </p>
        </div>

        <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-slate-700">
            我已年满18周岁，理解并同意使用本工具进行彩票数据分析
          </span>
        </label>

        <button
          onClick={handleVerify}
          disabled={!confirmed}
          className={`w-full font-bold py-4 rounded-2xl transition-all ${
            confirmed
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-90'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          进入应用
        </button>

        <p className="text-xs text-center text-slate-400">
          您的选择将被保存在本地浏览器中
        </p>
      </div>
    </div>
  );
};

export default AgeVerification;
