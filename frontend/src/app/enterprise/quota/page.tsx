'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { useAuth } from '../../store/auth';
import dayjs from 'dayjs';

const opLabels: Record<string, { label: string; cls: string; sign: string }> = {
  ALLOCATION: { label: '配额分配', cls: 'text-green-700 bg-green-50', sign: '+' },
  DEDUCTION: { label: '排放量扣除', cls: 'text-red-700 bg-red-50', sign: '-' },
  TRANSFER_IN: { label: '转入/结转', cls: 'text-blue-700 bg-blue-50', sign: '+' },
  TRANSFER_OUT: { label: '转出', cls: 'text-orange-700 bg-orange-50', sign: '-' },
  CARRY_OVER: { label: '结转至下年', cls: 'text-purple-700 bg-purple-50', sign: '-' },
  ROLLBACK: { label: '回滚', cls: 'text-gray-700 bg-gray-50', sign: '' },
};

export default function QuotaPage() {
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
  const [carryRecords, setCarryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [q, records] = await Promise.all([
      api.get(`/quota/${user!.enterpriseId}/${year}`),
      api.get('/quota/carry-over/records'),
    ]);
    setData(q);
    setCarryRecords(Array.isArray(records) ? records : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year, user]);

  const ops = data?.operations || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">配额余额</h1>
          <p className="text-gray-500 mt-1">查看年度配额分配、使用和结转记录</p>
        </div>
        <select className="input w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
          {[2, 1, 0, -1].map((i) => <option key={i} value={currentYear - i}>{currentYear - i}年</option>)}
        </select>
      </div>

      {loading ? (
        <div className="card py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card"><p className="text-xs text-gray-500">初始分配</p><p className="text-xl font-bold mt-2">{Number(data?.totalAllocation || 0).toFixed(2)}</p></div>
            <div className="card"><p className="text-xs text-gray-500">上年结转</p><p className="text-xl font-bold mt-2 text-blue-700">{Number(data?.carryInAmount || 0).toFixed(2)}</p></div>
            <div className="card"><p className="text-xs text-gray-500">已扣除</p><p className="text-xl font-bold mt-2 text-red-700">{Number(data?.usedAmount || 0).toFixed(2)}</p></div>
            <div className="card"><p className="text-xs text-gray-500">结转下年</p><p className="text-xl font-bold mt-2 text-purple-700">{Number(data?.carryOutAmount || 0).toFixed(2)}</p></div>
            <div className="card bg-gradient-to-br from-carbon-50 to-emerald-50 border-carbon-200">
              <p className="text-xs text-gray-600">当前余额</p>
              <p className="text-2xl font-bold mt-2 text-carbon-700">{Number(data?.balance || 0).toFixed(2)}</p>
              {data?.isLocked && <span className="badge bg-amber-100 text-amber-700 mt-2">🔒 已锁定</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">{year}年度配额流水</h2>
              {ops.length === 0 ? (
                <p className="text-gray-400 text-center py-8">暂无操作记录</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>时间</th><th>类型</th><th>金额</th><th>余额</th><th>备注</th></tr></thead>
                    <tbody>
                      {ops.map((o: any) => {
                        const info = opLabels[o.operationType] || { label: o.operationType, cls: '', sign: '' };
                        return (
                          <tr key={o.id}>
                            <td className="text-xs text-gray-500 whitespace-nowrap">{dayjs(o.operatedAt).format('MM-DD HH:mm')}</td>
                            <td><span className={`badge ${info.cls}`}>{info.label}</span></td>
                            <td className={info.sign === '+' ? 'text-green-700' : info.sign === '-' ? 'text-red-700' : ''}>
                              {info.sign}{Number(o.amount).toFixed(2)}
                            </td>
                            <td className="font-medium">{Number(o.balanceAfter).toFixed(2)}</td>
                            <td className="text-gray-500 text-xs max-w-xs truncate">{o.remark || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">年度结转记录</h2>
              {carryRecords.length === 0 ? (
                <p className="text-gray-400 text-center py-8">暂无结转记录</p>
              ) : (
                <div className="space-y-3">
                  {carryRecords.map((r) => (
                    <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium text-carbon-700">{r.fromYear} → {r.toYear} 年度结转</span>
                        <span className="badge bg-purple-50 text-purple-700">{Number(r.carryAmount).toFixed(2)} tCO₂e</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {dayjs(r.operatedAt).format('YYYY-MM-DD HH:mm')} · {r.remark || '无备注'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
