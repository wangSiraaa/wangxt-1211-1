'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import { useAuth } from '../../store/auth';
import dayjs from 'dayjs';

export default function OutputPage() {
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
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productName: '', quantity: '', unit: '吨' });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, rpt] = await Promise.all([
        api.get(`/production-output/month/${user!.enterpriseId}/${year}/${month}`),
        api.get(`/emission-reports/${user!.enterpriseId}/${year}/${month}`),
      ]);
      setList(Array.isArray(res) ? res : []);
      setLocked(rpt?.isLocked || false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year, month, user]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        productName: form.productName,
        quantity: parseFloat(form.quantity),
        unit: form.unit,
      };
      if (editing) await api.put(`/production-output/${editing}`, payload);
      else await api.post('/production-output', payload);
      setForm({ productName: '', quantity: '', unit: '吨' });
      setShowForm(false);
      setEditing(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const onEdit = (r: any) => {
    setEditing(r.id);
    setForm({ productName: r.productName, quantity: r.quantity, unit: r.unit });
    setShowForm(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm('确认删除？')) return;
    await api.delete(`/production-output/${id}`);
    await loadData();
  };

  const total = list.reduce((s, r) => s + Number(r.quantity || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">产量填报</h1>
          <p className="text-gray-500 mt-1">录入各产品月度产量数据</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {[0, 1, 2].map((i) => (
              <option key={i} value={currentYear - i}>{currentYear - i}年</option>
            ))}
          </select>
          <select className="input w-auto" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i + 1}>{i + 1}月</option>
            ))}
          </select>
        </div>
      </div>

      {locked && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <span>🔒</span>
          <span>{year}年{month}月产量数据已锁定，无法修改</span>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{year}年{month}月产量记录</h2>
              <button
                className="btn-secondary text-sm"
                onClick={() => {
                  setEditing(null);
                  setForm({ productName: '', quantity: '', unit: '吨' });
                  setShowForm((v) => !v);
                }}
                disabled={locked}
              >
                {showForm ? '取消' : '+ 新增产品'}
              </button>
            </div>
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>产品名称</th><th>产量</th><th>单位</th><th>操作</th></tr>
                  </thead>
                  <tbody>
                    {list.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-gray-400 py-12">暂无数据</td></tr>
                    )}
                    {list.map((r) => (
                      <tr key={r.id}>
                        <td className="font-medium">{r.productName}</td>
                        <td>{Number(r.quantity).toFixed(2)}</td>
                        <td>{r.unit}</td>
                        <td className="flex gap-2">
                          <button className="text-sm text-carbon-600 hover:underline" onClick={() => onEdit(r)} disabled={locked}>编辑</button>
                          <button className="text-sm text-red-600 hover:underline" onClick={() => onDelete(r.id)} disabled={locked}>删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {list.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 font-semibold">
                        <td className="text-right px-4 py-3">合计：</td>
                        <td className="px-4 py-3">{total.toFixed(2)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>

        {showForm && (
          <div className="card h-fit">
            <h2 className="text-lg font-semibold mb-4">{editing ? '编辑产量' : '新增产量'}</h2>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">产品名称</label>
                <input className="input" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} placeholder="如：特种钢材A" required disabled={!!editing} />
              </div>
              <div>
                <label className="label">产量</label>
                <input className="input" type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="请输入数量" required />
              </div>
              <div>
                <label className="label">计量单位</label>
                <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="吨/件/米" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1">保存</button>
                <button type="button" className="btn-secondary flex-1" onClick={() => { setShowForm(false); setEditing(null); }}>取消</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
