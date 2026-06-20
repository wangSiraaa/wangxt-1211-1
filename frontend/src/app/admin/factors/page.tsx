'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

const energyTypes = ['COAL', 'OIL', 'NATURAL_GAS', 'ELECTRICITY', 'STEAM', 'OTHER'];
const energyLabels: Record<string, string> = {
  COAL: '煤炭', OIL: '石油', NATURAL_GAS: '天然气', ELECTRICITY: '电力', STEAM: '蒸汽', OTHER: '其他',
};

export default function AdminFactorsPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const [factors, setFactors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    energyType: 'COAL', unit: '吨', factorValue: '', factorUnit: 'tCO₂e/t', source: '', effectiveYear: new Date().getFullYear(),
  });

  const load = async () => {
    setLoading(true);
    const res = await api.get('/emission-factors?pageSize=100');
    setFactors(res.items || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/emission-factors', { ...form, factorValue: parseFloat(form.factorValue) });
    setShowForm(false);
    setForm({ energyType: 'COAL', unit: '吨', factorValue: '', factorUnit: 'tCO₂e/t', source: '', effectiveYear: new Date().getFullYear() });
    await load();
  };

  const onToggle = async (id: string, current: boolean) => {
    await api.put(`/emission-factors/${id}`, { isActive: !current });
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">排放因子管理</h1>
          <p className="text-gray-500 mt-1">维护各能源类型的官方排放因子数据（企业端只读，仅管理员可编辑）</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ 新增排放因子</button>
      </div>

      {showForm && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold mb-4">新增排放因子</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">能源类型</label>
                <select className="input" value={form.energyType} onChange={(e) => setForm({ ...form, energyType: e.target.value })}>
                  {energyTypes.map((t) => <option key={t} value={t}>{energyLabels[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">计量单位</label>
                <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="如 吨 / MWh / m³" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">排放因子数值</label>
                <input className="input" type="number" step="0.0001" value={form.factorValue} onChange={(e) => setForm({ ...form, factorValue: e.target.value })} required />
              </div>
              <div>
                <label className="label">因子单位</label>
                <input className="input" value={form.factorUnit} onChange={(e) => setForm({ ...form, factorUnit: e.target.value })} placeholder="如 tCO₂e/t" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">来源依据</label>
                <input className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="如：GB/T 2589-2020" />
              </div>
              <div>
                <label className="label">生效年度</label>
                <input className="input" type="number" value={form.effectiveYear} onChange={(e) => setForm({ ...form, effectiveYear: parseInt(e.target.value) })} required />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>取消</button>
              <button type="submit" className="btn-primary">保存</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>能源类型</th><th>计量单位</th><th>排放因子</th><th>因子单位</th><th>来源</th><th>生效年度</th><th>状态</th><th>操作</th></tr>
              </thead>
              <tbody>
                {factors.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">暂无排放因子数据</td></tr>}
                {factors.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium ${
                        f.energyType === 'COAL' ? 'bg-gray-100 text-gray-700' :
                        f.energyType === 'OIL' ? 'bg-amber-50 text-amber-700' :
                        f.energyType === 'NATURAL_GAS' ? 'bg-blue-50 text-blue-700' :
                        f.energyType === 'ELECTRICITY' ? 'bg-yellow-50 text-yellow-700' :
                        f.energyType === 'STEAM' ? 'bg-purple-50 text-purple-700' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {energyLabels[f.energyType] || f.energyType}
                      </span>
                    </td>
                    <td>{f.unit}</td>
                    <td className="font-mono font-bold text-carbon-700">{Number(f.factorValue).toFixed(4)}</td>
                    <td className="text-sm text-gray-500">{f.factorUnit}</td>
                    <td className="text-sm text-gray-500">{f.source || '—'}</td>
                    <td>{f.effectiveYear}</td>
                    <td>
                      {f.isActive ? <span className="badge bg-green-100 text-green-700">启用</span> : <span className="badge bg-gray-100 text-gray-600">停用</span>}
                    </td>
                    <td>
                      <button
                        className={`text-sm hover:underline font-medium ${f.isActive ? 'text-red-600' : 'text-green-600'}`}
                        onClick={() => onToggle(f.id, f.isActive)}
                      >
                        {f.isActive ? '停用' : '启用'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
