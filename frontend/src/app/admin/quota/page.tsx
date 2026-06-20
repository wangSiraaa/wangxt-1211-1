'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import dayjs from 'dayjs';

const opTypeMap: Record<string, string> = {
  ALLOCATION: '初始分配 / 调整',
  DEDUCTION: '扣减 / 清缴',
  TRANSFER_IN: '结转转入',
  TRANSFER_OUT: '结转转出',
  CARRY_OVER: '跨年度结转',
  ROLLBACK: '回滚',
};

const opTypeColor: Record<string, string> = {
  ALLOCATION: 'text-green-600',
  DEDUCTION: 'text-red-600',
  TRANSFER_IN: 'text-blue-600',
  TRANSFER_OUT: 'text-gray-600',
  CARRY_OVER: 'text-teal-600',
  ROLLBACK: 'text-amber-600',
};

export default function AdminQuotaPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const currentYear = dayjs().year();
  const [year, setYear] = useState(currentYear);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllocate, setShowAllocate] = useState(false);
  const [allocateForm, setAllocateForm] = useState({
    enterpriseId: '', totalAllocation: '', remark: '', operationType: 'ALLOCATION',
  });
  const [enterprises, setEnterprises] = useState<any>({ items: [] });

  const load = async () => {
    setLoading(true);
    const [es, qs, ops] = await Promise.all([
      api.get('/enterprises?pageSize=100'),
      api.get(`/quota?year=${year}&pageSize=100`),
      api.get(`/quota/operations?year=${year}&pageSize=100`),
    ]);
    setEnterprises(es);
    setQuotas(qs.items || []);
    setOperations(ops.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [year]);

  const onAllocate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/quota/adjust', {
        enterpriseId: allocateForm.enterpriseId,
        year,
        amount: parseFloat(allocateForm.totalAllocation),
        operationType: allocateForm.operationType,
        remark: allocateForm.remark,
      });
      alert('操作成功');
      setShowAllocate(false);
      setAllocateForm({ enterpriseId: '', totalAllocation: '', remark: '', operationType: 'ALLOCATION' });
      await load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">配额管理</h1>
          <p className="text-gray-500 mt-1">为企业分配年度碳排放配额，处理调整和清缴</p>
        </div>
        <div className="flex gap-3">
          <select className="input w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {[3, 2, 1, 0, -1].map((i) => <option key={i} value={currentYear - i}>{currentYear - i}年</option>)}
          </select>
          <button className="btn-primary" onClick={() => setShowAllocate(true)}>+ 配额分配 / 调整</button>
        </div>
      </div>

      {showAllocate && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold mb-4">配额操作</h2>
          <form onSubmit={onAllocate} className="space-y-4">
            <div>
              <label className="label">企业</label>
              <select
                className="input"
                value={allocateForm.enterpriseId}
                onChange={(e) => setAllocateForm({ ...allocateForm, enterpriseId: e.target.value })}
                required
              >
                <option value="">— 请选择 —</option>
                {enterprises.items?.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">操作类型</label>
              <select
                className="input"
                value={allocateForm.operationType}
                onChange={(e) => setAllocateForm({ ...allocateForm, operationType: e.target.value })}
              >
                <option value="ALLOCATION">初始分配</option>
                <option value="ADJUSTMENT">人工调整</option>
                <option value="SURRENDER">履约清缴</option>
              </select>
            </div>
            <div>
              <label className="label">操作金额 (tCO₂e) 正数增加 / 负数扣减</label>
              <input
                className="input"
                type="number"
                step="0.01"
                placeholder="如 10000 / -500"
                value={allocateForm.totalAllocation}
                onChange={(e) => setAllocateForm({ ...allocateForm, totalAllocation: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">备注</label>
              <textarea className="input min-h-[80px]" value={allocateForm.remark} onChange={(e) => setAllocateForm({ ...allocateForm, remark: e.target.value })} placeholder="说明操作原因" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowAllocate(false)}>取消</button>
              <button type="submit" className="btn-primary">确认操作</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <>
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">{year}年度企业配额概览</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>企业</th>
                    <th>初始配额</th>
                    <th>结转转入</th>
                    <th>人工调整</th>
                    <th>总分配量</th>
                    <th>已用额度</th>
                    <th>当前余额</th>
                    <th>使用率</th>
                  </tr>
                </thead>
                <tbody>
                  {quotas.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">暂无配额数据，请点击「配额分配」初始化</td></tr>}
                  {quotas.map((q) => {
                    const used = Number(q.usedAmount || 0);
                    const total = Number(q.totalAllocation || 0);
                    const rate = total > 0 ? (used / total) * 100 : 0;
                    return (
                      <tr key={q.id}>
                        <td className="font-medium">{q.enterprise?.name}</td>
                        <td className="font-mono">{Number(q.initialAmount || 0).toFixed(2)}</td>
                        <td className="font-mono text-blue-600">{Number(q.carryInAmount || 0).toFixed(2)}</td>
                        <td className="font-mono text-purple-600">{Number(q.adjustAmount || 0).toFixed(2)}</td>
                        <td className="font-mono font-bold">{total.toFixed(2)}</td>
                        <td className="font-mono text-amber-600">{used.toFixed(2)}</td>
                        <td className={`font-mono font-bold ${Number(q.balance) < 0 ? 'text-red-600' : 'text-carbon-700'}`}>
                          {Number(q.balance).toFixed(2)}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${rate > 100 ? 'bg-red-500' : rate > 80 ? 'bg-amber-500' : 'bg-carbon-500'}`}
                                style={{ width: `${Math.min(100, rate)}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm ${rate > 100 ? 'text-red-600 font-bold' : 'text-gray-600'}`}>{rate.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold mb-4">配额操作流水</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>时间</th><th>企业</th><th>类型</th><th>变动金额</th><th>操作前</th><th>操作后</th><th>备注</th></tr></thead>
                <tbody>
                  {operations.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无操作记录</td></tr>}
                  {operations.map((op) => (
                    <tr key={op.id}>
                      <td className="text-xs text-gray-500 whitespace-nowrap">{dayjs(op.createdAt).format('YYYY-MM-DD HH:mm')}</td>
                      <td>{op.quota?.enterprise?.name || '—'}</td>
                      <td>
                        <span className={`badge font-medium ${opTypeColor[op.operationType]}`} style={{ background: 'transparent' }}>
                          {opTypeMap[op.operationType] || op.operationType}
                        </span>
                      </td>
                      <td className={`font-mono ${op.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {op.amount >= 0 ? '+' : ''}{Number(op.amount).toFixed(2)}
                      </td>
                      <td className="font-mono text-gray-500">{Number(op.balanceBefore).toFixed(2)}</td>
                      <td className="font-mono font-bold">{Number(op.balanceAfter).toFixed(2)}</td>
                      <td className="text-sm text-gray-600">{op.remark || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
