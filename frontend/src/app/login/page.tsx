'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../store/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, user, initialized } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialized && user) {
      const next = searchParams.get('next');
      if (next) router.replace(next);
      else router.replace('/');
    }
  }, [user, initialized, router, searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      const next = searchParams.get('next');
      if (next) router.replace(next);
      else router.replace('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: '企业用户', u: 'enterprise', p: '123456' },
    { role: '核证员', u: 'verifier', p: '123456' },
    { role: '管理员', u: 'admin', p: '123456' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-carbon-50 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-carbon-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 shadow-lg">
            C
          </div>
          <h1 className="text-2xl font-bold text-gray-800">工业园区碳资产核算系统</h1>
          <p className="text-gray-500 mt-2">请登录以继续</p>
        </div>
        <form onSubmit={onSubmit} className="card space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="label">用户名</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>
          <div>
            <label className="label">密码</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>
        <div className="mt-6 card">
          <p className="text-sm text-gray-600 mb-3 font-medium">演示账号：</p>
          <div className="space-y-2">
            {demoAccounts.map((a) => (
              <div
                key={a.u}
                className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setUsername(a.u);
                  setPassword(a.p);
                }}
              >
                <span className="text-gray-700 font-medium">{a.role}</span>
                <span className="text-gray-500">
                  {a.u} / {a.p}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
