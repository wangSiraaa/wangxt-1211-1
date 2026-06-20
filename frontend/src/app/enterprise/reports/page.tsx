'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { useAuth } from '../../store/auth';
import dayjs from 'dayjs';

const statusMap: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待核证', cls: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: '核证中', cls: 'bg-blue-100 text-blue-700' },
  VERIFIED: { label: '已核证', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: '已驳回', cls: 'bg-red-100 text-red-700' },
  ADJUSTED: { label: '已调整', cls: 'bg-purple-100 text-purple-700' },
};

export default function ReportsPage() {
  return (
    <AuthGuard allowedRoles={['ENTERPRISE']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const { user } = useAuth();
  const currentYear = dayjs().year();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [reportDetail, setReportDetail] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    setData(await api.get(`/emission-reports/summary/${user!.enterpriseId}/${year}`));
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, user]);

  const openMonth = async (month: number) => {
    setSelectedMonth(month);
    setReportDetail(await api.get(`/emission-reports/${user!.enterpriseId}/${year}/${month}`));
  };

  const months = data?.months || [];
  const total = data?.totalTotalEmission || 0;
  const verified = data?.totalVerifiedEmission || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">排放报告</h1>
          <p className="text-gray-500 mt-1">查看月度排放报告、核证进度和调整记录</p>
        </div>
        <select className="input w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {[0, 1, 2, 3].map((i) => <option key={i} value={currentYear - i}>{currentYear - i}年</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><p className="text-sm text-gray-500">{year}年度填报总量</p><p className="text-2xl font-bold mt-2">{Number(total).toFixed(2)} tCO₂e</p></div>
        <div className="card"><p className="text-sm text-gray-500">已核证总量</p><p className="text-2xl font-bold mt-2 text-carbon-700">{Number(verified).toFixed(2)} tCO₂e</p></div>
        <div className="card"><p className="text-sm text-gray-500">核证覆盖率</p><p className="text-2xl font-bold mt-2 text-indigo-700">{total > 0 ? ((verified / total) * 100).toFixed(1) : '0.0'}%</p></div>
      </div>

      {loading ? (
        <div className="card py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => {
            const m = i + 1;
            const r = months.find((x: any) => x.month === m);
            const st = r?.verificationStatus;
            const info = statusMap[st] || { label: '草稿', cls: 'bg-gray-100 text-gray-700' };
            return (
              <div
                key={m}
                className={`card p-4 cursor-pointer hover:shadow-md transition ${selectedMonth === m ? 'ring-2 ring-carbon-500' : ''}`}
                onClick={() => openMonth(m)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold">{m}月</span>
                  {r?.isLocked && <span>🔒</span>}
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-500">填报</span><span className="font-medium">{r ? Number(r.totalEmission).toFixed(1) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">核证</span><span className="font-medium text-carbon-700">{r?.verifiedEmission ? Number(r.verifiedEmission).toFixed(1) : '—'}</span></div>
                </div>
                <div className={`badge mt-3 ${info.cls}`}>{info.label}</div>
              </div>
            );
          })}
        </div>
      )}

      {selectedMonth && reportDetail && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{year}年{selectedMonth}月报告详情</h2>
            <span className={`badge ${reportDetail.isLocked ? 'bg-amber-100 text-amber-700' : 'bg-green-50 text-green-700'}`}>
              {reportDetail.isLocked ? '🔒 已锁定' : '可编辑'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">填报排放量</p><p className="text-xl font-bold">{Number(reportDetail.totalEmission).toFixed(2)} tCO₂e</p></div>
            <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">核证调整后</p><p className="text-xl font-bold text-purple-700">{reportDetail.adjustedEmission ? Number(reportDetail.adjustedEmission).toFixed(2) : '—'}</p></div>
            <div className="bg-gray-50 rounded-lg p-4"><p className="text-sm text-gray-500">最终核证量</p><p className="text-xl font-bold text-carbon-700">{reportDetail.verifiedEmission ? Number(reportDetail.verifiedEmission).toFixed(2) : '—'}</p></div>
          </div>

          {reportDetail.verificationTasks?.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">核证记录</h3>
              <div className="space-y-3">
                {reportDetail.verificationTasks.map((t: any) => (
                  <div key={t.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <div>
                        <span className="font-medium">{t.taskName}</span>
                        <span className="text-sm text-gray-500 ml-3">核证员：{t.verifier?.username}</span>
                      </div>
                      <span className={`badge ${statusMap[t.status]?.cls || ''}`}>{statusMap[t.status]?.label || t.status}</span>
                    </div>
                    <div className="text-sm text-gray-600">抽样方法：{t.samplingMethod}（{t.samplingCount}个样本）</div>
                    {t.evidences?.length > 0 && (
                      <div className="mt-3 table-wrap">
                        <table className="data-table text-xs">
                          <thead><tr><th>凭证号</th><th>类型</th><th>申报值</th><th>实际值</th><th>完整</th><th>备注</th></tr></thead>
                          <tbody>
                            {t.evidences.map((e: any) => (
                              <tr key={e.id}>
                                <td>{e.voucherNo}</td><td>{e.energyType || e.voucherType}</td>
                                <td>{Number(e.reportedValue).toFixed(2)}</td>
                                <td className={e.actualValue ? 'text-carbon-700 font-medium' : ''}>{e.actualValue ? Number(e.actualValue).toFixed(2) : '—'}</td>
                                <td>{e.isComplete ? <span className="text-green-600">✓</span> : <span className="text-red-600">✗ 扣除</span>}</td>
                                <td className="text-gray-500 max-w-xs truncate">{e.remark}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {reportDetail.adjustments?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">核证调整记录</h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>项目</th><th>原值</th><th>调整</th><th>终值</th><th>原因</th><th>核证员</th><th>时间</th></tr></thead>
                  <tbody>
                    {reportDetail.adjustments.map((a: any) => (
                      <tr key={a.id}>
                        <td className="font-medium">{a.itemName}</td>
                        <td>{Number(a.originalValue).toFixed(2)}</td>
                        <td className={a.adjustValue >= 0 ? 'text-red-600' : 'text-green-600'}>
                          {a.adjustValue >= 0 ? '+' : ''}{Number(a.adjustValue).toFixed(2)}
                        </td>
                        <td className="font-bold">{Number(a.finalValue).toFixed(2)}</td>
                        <td className="text-gray-600 max-w-xs truncate">{a.reason}</td>
                        <td>{a.adjustedBy}</td>
                        <td className="text-gray-500 text-xs">{dayjs(a.adjustedAt).format('YYYY-MM-DD HH:mm')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
