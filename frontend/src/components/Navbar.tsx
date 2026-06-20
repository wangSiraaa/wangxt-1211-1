'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../store/auth';
import clsx from 'clsx';

const navItems: Record<string, { label: string; path: string; roles: string[] }[]> = {
  ENTERPRISE: [
    { label: '首页概览', path: '/enterprise', roles: ['ENTERPRISE'] },
    { label: '能源消耗填报', path: '/enterprise/energy', roles: ['ENTERPRISE'] },
    { label: '产量填报', path: '/enterprise/output', roles: ['ENTERPRISE'] },
    { label: '排放因子', path: '/enterprise/factors', roles: ['ENTERPRISE'] },
    { label: '排放报告', path: '/enterprise/reports', roles: ['ENTERPRISE'] },
    { label: '配额余额', path: '/enterprise/quota', roles: ['ENTERPRISE'] },
  ],
  VERIFIER: [
    { label: '核证任务', path: '/verifier/tasks', roles: ['VERIFIER'] },
    { label: '排放报告列表', path: '/verifier/reports', roles: ['VERIFIER'] },
  ],
  ADMIN: [
    { label: '首页概览', path: '/admin', roles: ['ADMIN'] },
    { label: '企业管理', path: '/admin/enterprises', roles: ['ADMIN'] },
    { label: '排放因子配置', path: '/admin/factors', roles: ['ADMIN'] },
    { label: '配额管理', path: '/admin/quota', roles: ['ADMIN'] },
    { label: '基线锁定与结转', path: '/admin/carryover', roles: ['ADMIN'] },
    { label: '审计日志', path: '/admin/audit', roles: ['ADMIN'] },
  ],
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  if (!user) return null;
  const items = navItems[user.role] || [];
  const roleLabel = {
    ENTERPRISE: '企业用户',
    VERIFIER: '第三方核证员',
    ADMIN: '园区管理员',
  }[user.role];
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-carbon-600 rounded-lg flex items-center justify-center text-white font-bold">
                C
              </div>
              <span className="font-bold text-lg text-gray-800">碳资产核算系统</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {items.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={clsx(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    pathname === item.path || pathname.startsWith(item.path + '/')
                      ? 'bg-carbon-50 text-carbon-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-sm">
              <span className="text-gray-800 font-medium">{user.username}</span>
              <span className="text-xs text-gray-500">{roleLabel}</span>
            </div>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="btn-secondary text-sm"
            >
              退出
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
