'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { useAuth } from '../../store/auth';
import dayjs from 'dayjs';

const energyTypes = [
  { value: 'COAL', label: '煤炭' },
  { value: 'OIL', label: '石油' },
  { value: 'NATURAL_GAS', label: '天然气' },
  { value: 'ELECTRICITY', label: '电力' },
  { value: 'STEAM', label: '蒸汽' },
  { value: 'OTHER', label: '其他' },
];

const unitMap: Record<string, string> = {
  COAL: '吨',
  OIL: '吨',
  NATURAL_GAS: '万m³',
  ELECTRICITY: 'MWh',
  STEAM: '吨',
  OTHER: '单位',
};

export default function EnergyPage() {
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
  const currentMonth = dayjs().month() + 1;
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [list, setList] = useState<any[]>([]);
  const [factors, setFactors] = useState<any[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    energyType: 'COAL',
    quantity: '',
    voucherNo: '',
    hasVoucher: false,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, rpt] = await Promise.all([
        api.get(`/energy-consumption/month/${user!.enterpriseId}/${year}/${month}`),
        api.get(`/emission-reports/${user!.enterpriseId}/${year}/${month}`),
      ]);
      setList(Array.isArray(res) ? res : []);
      setFactors(await api.get('/emission-factors'));
      setLocked(rpt?.isLocked || false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, month, user]);

  const factorMap: Record<string, number> = {};
  factors.forEach((f) => (factorMap[f.energyType] = Number(f.factorValue)));

  const previewEmission = (t: string, q: number) =>
    q && factorMap[t] ? (q * factorMap[t]).toFixed(4) : '—';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        energyType: form.energyType,
        quantity: parseFloat(form.quantity),
        unit: unitMap[form.energyType] || '单位',
        voucherNo: form.voucherNo || undefined,
        hasVoucher: form.hasVoucher,
      };
      if (editing) {
        await api.put(`/energy-consumption/${editing}`, payload);
      } else {
        await api.post('/energy-consumption', payload);
      }
      setForm({ energyType: 'COAL', quantity: '', voucherNo: '', hasVoucher: false });
      setShowForm(false);
      setEditing(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const onEdit = (r: any) => {
    setEditing(r.id);
    setForm({
      energyType: r.energyType,
      quantity: r.quantity,
      voucherNo: r.voucherNo || '',
      hasVoucher: r.hasVoucher,
    });
    setShowForm(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm('确认删除该记录？')) return;
    await api.delete(`/energy-consumption/${id}`);
    await loadData();
  };

  const onSubmitReport = async () => {
    if (!confirm(`确认提交${year}年${month}月排放报告？提交后将进入核证流程。`)) return;
    await api.post(`/emission-reports/submit/${user!.enterpriseId}/${year}/${month}`);
    await loadData();
    alert('提交成功');
  };

  const total = list.reduce((s, r) => s + Number(r.emissionAmount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">能源消耗填报</h1>
          <p className="text-gray-500 mt-1">
            录入各能源类型消耗量，系统自动计算排放量
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-auto"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {[0, 1, 2, 3].map((i) => (
              <option key={i} value={currentYear - i}>
                {currentYear - i}年
              </option>
            ))}
          </select>
          <select
            className="input w-auto"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}月
              </option>
            ))}
          </select>
        </div>
      </div>

      {locked && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <span>🔒</span>
          <span>
            {year}年{month}月数据已通过核证并锁定，企业端无法修改。如有疑问请联系核证员。
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {year}年{month}月能源消耗记录
              </h2>
              <div className="flex gap-2">
                <button
                  className="btn-secondary text-sm"
                  onClick={() => {
                    setEditing(null);
                    setForm({ energyType: 'COAL', quantity: '', voucherNo: '', hasVoucher: false });
                    setShowForm((v) => !v);
                  }}
                  disabled={locked}
                >
                  {showForm ? '取消' : '+ 新增记录'}
                </button>
                <button
                  className="btn-primary text-sm"
                  onClick={onSubmitReport}
                  disabled={locked || list.length === 0}
                >
                  提交报告
                </button>
              </div>
            </div>
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>能源类型</th>
                      <th>消耗量</th>
                      <th>排放因子</th>
                      <th>排放量 (tCO₂e)</th>
                      <th>凭证</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-400 py-12">
                          暂无数据，点击「新增记录」开始填报
                        </td>
                      </tr>
                    )}
                    {list.map((r) => {
                      const label = energyTypes.find((e) => e.value === r.energyType)?.label || r.energyType;
                      return (
                        <tr key={r.id}>
                          <td className="font-medium">{label}</td>
                          <td>
                            {Number(r.quantity).toFixed(2)} {r.unit}
                          </td>
                          <td>{Number(r.factorValue).toFixed(4)}</td>
                          <td className="text-carbon-700 font-medium">
                            {Number(r.emissionAmount).toFixed(4)}
                          </td>
                          <td>
                            {r.hasVoucher ? (
                              <span className="badge bg-green-50 text-green-700">
                                ✓ {r.voucherNo}
                              </span>
                            ) : (
                              <span className="badge bg-red-50 text-red-700">⚠ 缺失凭证</span>
                            )}
                          </td>
                          <td className="flex gap-2">
                            <button
                              className="text-sm text-carbon-600 hover:underline"
                              onClick={() => onEdit(r)}
                              disabled={locked}
                            >
                              编辑
                            </button>
                            <button
                              className="text-sm text-red-600 hover:underline"
                              onClick={() => onDelete(r.id)}
                              disabled={locked}
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {list.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td colSpan={3} className="text-right px-4 py-3">
                          合计排放量：
                        </td>
                        <td className="text-carbon-700 px-4 py-3">{total.toFixed(4)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {showForm && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">
                {editing ? '编辑记录' : '新增记录'}
              </h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label className="label">能源类型</label>
                  <select
                    className="input"
                    value={form.energyType}
                    onChange={(e) => setForm({ ...form, energyType: e.target.value })}
                    disabled={!!editing}
                  >
                    {energyTypes.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">
                    消耗量 ({unitMap[form.energyType]})
                  </label>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="请输入数量"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    预计排放量：
                    <span className="text-carbon-700 font-medium ml-1">
                      {previewEmission(form.energyType, parseFloat(form.quantity || '0'))}{' '}
                      tCO₂e
                    </span>
                  </p>
                </div>
                <div>
                  <label className="label">凭证号（发票/原始单据号）</label>
                  <input
                    className="input"
                    value={form.voucherNo}
                    onChange={(e) =>
                      setForm({ ...form, voucherNo: e.target.value, hasVoucher: !!e.target.value })
                    }
                    placeholder="有凭证请填写，缺失将在核证时扣除对应排放量"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn-primary flex-1">
                    保存
                  </button>
                  <button
                    type="button"
                    className="btn-secondary flex-1"
                    onClick={() => {
                      setShowForm(false);
                      setEditing(null);
                    }}
                  >
                    取消
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="card">
            <h3 className="font-semibold mb-3">排放因子参考</h3>
            <div className="space-y-2 text-sm">
              {factors.map((f) => {
                const label = energyTypes.find((e) => e.value === f.energyType)?.label || f.energyType;
                return (
                  <div key={f.energyType} className="flex justify-between border-b border-gray-100 py-2 last:border-0">
                    <span className="text-gray-700">{label}</span>
                    <span className="font-mono text-carbon-700">{Number(f.factorValue).toFixed(4)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
