'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import dayjs from 'dayjs';

export default function AdminEnterprisesPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const [enterprises, setEnterprises] = useState<any>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', contact: '', phone: '', industry: '制造业' });

  const load = async () => {
    setLoading(true);
    setEnterprises(await api.get('/enterprises?pageSize=100'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/enterprises', form);
    setShowForm(false);
    setForm({ code: '', name: '', contact: '', phone: '', industry: '制造业' });
    await load();
  };

  const onCreateUser = async (entId: string, entName: string) => {
    const username = prompt(`为「${entName}」创建企业账号，请输入用户名（默认: ${entId.slice(0, 8)}_user）：`, `${entId.slice(0, 8)}_user`);
    if (!username) return;
    const password = prompt(`请输入密码（默认: 123456）：`, '123456');
    if (!password) return;
    try {
      await api.post('/auth/register', {
        username,
        password,
        displayName: `${entName} 填报员`,
        role: 'ENTERPRISE',
        enterpriseId: entId,
      });
      alert(`账号创建成功！\n用户名：${username}\n密码：${password}\n企业：${entName}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">企业档案管理</h1>
          <p className="text-gray-500 mt-1">管理园区内纳入碳排放核算的企业主体</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ 新增企业</button>
      </div>

      {showForm && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold mb-4">新增企业</h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">企业编码</label>
                <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="如 ENT001" required />
              </div>
              <div>
                <label className="label">企业名称</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="企业全称" required />
              </div>
            </div>
            <div>
              <label className="label">所属行业</label>
              <select className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                <option>制造业</option>
                <option>电力行业</option>
                <option>化工行业</option>
                <option>钢铁行业</option>
                <option>建材行业</option>
                <option>交通运输</option>
                <option>服务业</option>
                <option>其他</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">联系人</label>
                <input className="input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
              </div>
              <div>
                <label className="label">联系电话</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
                <tr><th>编码</th><th>企业名称</th><th>行业</th><th>联系人</th><th>电话</th><th>创建时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                {enterprises.items.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无企业数据</td></tr>}
                {enterprises.items.map((e: any) => (
                  <tr key={e.id}>
                    <td className="font-mono text-sm">{e.code}</td>
                    <td className="font-medium">{e.name}</td>
                    <td>{e.industry || '—'}</td>
                    <td>{e.contact || '—'}</td>
                    <td>{e.phone || '—'}</td>
                    <td className="text-xs text-gray-500">{dayjs(e.createdAt).format('YYYY-MM-DD')}</td>
                    <td>
                      <button className="text-carbon-600 hover:underline text-sm" onClick={() => onCreateUser(e.id, e.name)}>
                        👤 创建企业账号
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
