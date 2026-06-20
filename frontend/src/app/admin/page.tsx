'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import dayjs from 'dayjs';

export default function AdminDashboard() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentYear = dayjs().year();

  useEffect(() => {
    (async () => {
      const [enterprises, quotas, baselines, reports] = await Promise.all([
        api.get('/enterprises?pageSize=100'),
        api.get(`/quota?year=${currentYear}&pageSize=100`),
        api.get(`/quota/baselines?year=${currentYear}&pageSize=100`),
        api.get(`/emission-reports?year=${currentYear}&pageSize=200`),
      ]);
      const totalQuota = (quotas.items || []).reduce((s: number, q: any) => s + Number(q.totalAllocation || 0), 0);
      const totalUsed = (quotas.items || []).reduce((s: number, q: any) => s + Number(q.usedAmount || 0), 0);
      const totalEmission = (reports.items || []).reduce((s: number, r: any) => s + Number(r.verifiedEmission || r.totalEmission || 0), 0);
      const pendingReports = (reports.items || []).filter((r: any) => r.verificationStatus === 'PENDING').length;
      const lockedBaselines = (baselines.items || []).filter((b: any) => b.isLocked).length;
      setStats({
        enterpriseCount: enterprises.total || 0,
        totalQuota,
        totalUsed,
        totalEmission,
        pendingReports,
        baselineCount: baselines.total || 0,
        lockedBaselines,
        recentReports: reports.items?.slice(0, 10) || [],
      });
      setLoading(false);
    })();
  }, [currentYear]);

  const statusMap: Record<string, { label: string; cls: string }> = {
    PENDING: { label: '待核证', cls: 'bg-amber-100 text-amber-700' },
    IN_PROGRESS: { label: '核证中', cls: 'bg-blue-100 text-blue-700' },
    VERIFIED: { label: '已核证', cls: 'bg-green-100 text-green-700' },
    REJECTED: { label: '已驳回', cls: 'bg-red-100 text-red-700' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">园区管理员控制台</h1>
        <p className="text-gray-500 mt-1">{currentYear}年度碳资产管理全景</p>
      </div>

      {loading ? (
        <div className="card py-20 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card"><p className="text-sm text-gray-500">企业总数</p><p className="text-3xl font-bold mt-2">{stats.enterpriseCount}</p></div>
            <div className="card"><p className="text-sm text-gray-500">{currentYear}年度配额总量</p><p className="text-3xl font-bold mt-2 text-carbon-700">{stats.totalQuota.toFixed(1)} <span className="text-sm font-normal text-gray-500">tCO₂e</span></p></div>
            <div className="card"><p className="text-sm text-gray-500">已核证排放</p><p className="text-3xl font-bold mt-2 text-indigo-700">{stats.totalEmission.toFixed(1)} <span className="text-sm font-normal text-gray-500">tCO₂e</span></p></div>
            <div className="card"><p className="text-sm text-gray-500">待核证报告</p><p className="text-3xl font-bold mt-2 text-amber-600">{stats.pendingReports}</p></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-carbon-50"><p className="text-sm text-gray-600">基线已锁定 / 总数</p><p className="text-2xl font-bold mt-2 text-carbon-700">{stats.lockedBaselines} / {stats.baselineCount}</p></div>
            <div className="card bg-gradient-to-br from-blue-50"><p className="text-sm text-gray-600">配额使用率</p><p className="text-2xl font-bold mt-2 text-blue-700">{stats.totalQuota > 0 ? ((stats.totalUsed / stats.totalQuota) * 100).toFixed(1) : '0.0'}%</p></div>
            <div className="card bg-gradient-to-br from-amber-50"><p className="text-sm text-gray-600">剩余可用配额</p><p className="text-2xl font-bold mt-2 text-amber-700">{(stats.totalQuota - stats.totalUsed).toFixed(1)} tCO₂e</p></div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">最新报告动态</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>企业</th><th>期间</th><th>填报排放</th><th>核证后排放</th><th>状态</th><th>更新时间</th></tr></thead>
                <tbody>
                  {stats.recentReports.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无数据</td></tr>}
                  {stats.recentReports.map((r: any) => {
                    const info = statusMap[r.verificationStatus] || { label: '草稿', cls: 'bg-gray-100' };
                    return (
                      <tr key={r.id}>
                        <td className="font-medium">{r.enterprise?.name}</td>
                        <td>{r.year}年{r.month}月</td>
                        <td>{Number(r.totalEmission).toFixed(2)}</td>
                        <td className={r.verifiedEmission ? 'text-carbon-700 font-medium' : 'text-gray-400'}>
                          {r.verifiedEmission ? Number(r.verifiedEmission).toFixed(2) : '—'}
                        </td>
                        <td><span className={`badge ${info.cls}`}>{info.label}</span></td>
                        <td className="text-xs text-gray-500">{dayjs(r.updatedAt).format('YYYY-MM-DD HH:mm')}</td>
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
