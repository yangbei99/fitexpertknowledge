import React, { useState, useEffect } from 'react';

// 预设密码的 SHA-256 哈希值
// 默认密码是: fit
// 如需修改密码，在浏览器控制台运行：
// crypto.subtle.digest('SHA-256', new TextEncoder().encode('你的新密码')).then(h => console.log(Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('')))
const PASSWORD_HASH = 'da4270e3735a3418c9d462af2e17d045132dede43df058e85b1f0399fcf96f1b';

const AUTH_KEY = 'documind_auth';

interface AuthGateProps {
  children: React.ReactNode;
}

// 计算 SHA-256 哈希
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 检查本地存储的认证状态
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored === PASSWORD_HASH) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const hash = await hashPassword(password);
      if (hash === PASSWORD_HASH) {
        localStorage.setItem(AUTH_KEY, hash);
        setIsAuthenticated(true);
      } else {
        setError('密码错误，请重试');
        setPassword('');
      }
    } catch {
      setError('验证失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 加载中
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#e5efff] to-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#2d6ad1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 已认证，显示主应用
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 未认证，显示登录页
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e5efff] via-white to-[#f0f7ff] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#2d6ad1] rounded-2xl shadow-lg shadow-[#2d6ad1]/30 mb-4">
            <span className="text-3xl text-white font-serif italic">D</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0048d6] tracking-tight">DocuMind</h1>
          <p className="text-zinc-500 mt-2">BCC 专家访谈文库</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-[#2d6ad1]/5 border border-[#b4c6e6]/30 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">
                访问密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入团队访问密码"
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#2d6ad1]/20 focus:border-[#2d6ad1] focus:bg-white transition-all"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 py-2 px-4 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 px-4 bg-[#2d6ad1] hover:bg-[#1d5abc] text-white font-medium rounded-xl transition-all shadow-lg shadow-[#2d6ad1]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  验证中...
                </>
              ) : (
                '进入系统'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-400">
              仅限团队内部使用
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
