'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { useAuth } from '../../store/auth';
import dayjs from 'dayjs';

export default function EnterpriseDashboard() {
  return (
    <AuthGuard allowedRoles={['ENTERPRISE']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentYear = dayjs().year();
  const currentMonth = dayjs().month() + 1;

  useEffect(() => {
    (async () => {
      try {
        const [reports, factors] = await Promise.all([
          api.get(`/emission-reports/summary/${user!.enterpriseId}/${currentYear}`),
          api.get('/emission-factors'),
        ]);
        const quota = await api.get(`/quota/${user!.enterpriseId}/${currentYear}`);
        setSummary({ reports, factors, quota });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, currentYear]);

  const months = summary?.reports?.months || [];
  const total = summary?.reports?.totalTotalEmission || 0;
  const verified = summary?.reports?.totalVerifiedEmission || 0;
  const quotaBalance = summary?.quota?.balance ?? '—';

  const statusMap: Record<string, { label: string; cls: string }> = {
    PENDING: { label: '待核证', cls: 'bg-amber-100 text-amber-700' },
    IN_PROGRESS: { label: '核证中', cls: 'bg-blue-100 text-blue-700' },
    VERIFIED: { label: '已核证', cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: '已驳回', cls: 'bg-red-100 text-red-700' },
    ADJUSTED: { label: '已调整', cls: 'bg-purple-100 text-purple-700' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">企业工作台</h1>
          <p className="text-gray-500 mt-1">
            欢迎回来，{user?.username} | {currentYear}年{currentMonth}月
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-carbon-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-gray-500">{currentYear}年度填报排放总量</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {Number(total).toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-1">tCO₂e</span>
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">已核证排放量</p>
              <p className="text-3xl font-bold text-carbon-700 mt-2">
                {Number(verified).toFixed(2)}
                <span className="text-sm font-normal text-gray-500 ml-1">tCO₂e</span>
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">{currentYear}年度配额余额</p>
              <p className="text-3xl font-bold text-indigo-700 mt-2">
                {typeof quotaBalance === 'number' ? quotaBalance.toFixed(2) : quotaBalance}
                <span className="text-sm font-normal text-gray-500 ml-1">tCO₂e</span>
              </p>
            </div>
            <div className="card">
              <p className="text-sm text-gray-500">排放因子已配置</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {summary?.factors?.length || 0}
                <span className="text-sm font-normal text-gray-500 ml-1">项</span>
              </p>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {currentYear}年度月度排放报告
            </h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>月份</th>
                    <th>填报排放量 (tCO₂e)</th>
                    <th>核证后排放量 (tCO₂e)</th>
                    <th>状态</th>
                    <th>是否锁定</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const m = i + 1;
                    const rpt = months.find((x: any) => x.month === m);
                    const st = rpt?.verificationStatus || 'DRAFT';
                    const info =
                      statusMap[st] ||
                      (st === 'DRAFT'
                        ? { label: '草稿', cls: 'bg-gray-100 text-gray-700' }
                        : { label: st, cls: 'bg-gray-100' });
                    return (
                      <tr key={m}>
                        <td className="font-medium">{m}月</td>
                        <td>{rpt ? Number(rpt.totalEmission).toFixed(2) : '—'}</td>
                        <td className="text-carbon-700 font-medium">
                          {rpt?.verifiedEmission ? Number(rpt.verifiedEmission).toFixed(2) : '—'}
                        </td>
                        <td>
                          <span className={`badge ${info.cls}`}>{info.label}</span>
                        </td>
                        <td>
                          {rpt?.isLocked ? (
                            <span className="badge bg-gray-100 text-gray-700">🔒 已锁定</span>
                          ) : (
                            <span className="badge bg-green-50 text-green-700">可编辑</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
