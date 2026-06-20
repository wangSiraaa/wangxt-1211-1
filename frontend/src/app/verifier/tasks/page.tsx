'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';

const statusMap: Record<string, { label: string; cls: string }> = {
  PENDING: { label: '待创建任务', cls: 'bg-amber-100 text-amber-700' },
  IN_PROGRESS: { label: '核证中', cls: 'bg-blue-100 text-blue-700' },
  VERIFIED: { label: '已核证', cls: 'bg-green-100 text-green-700' },
  REJECTED: { label: '已驳回', cls: 'bg-red-100 text-red-700' },
  ADJUSTED: { label: '已调整', cls: 'bg-purple-100 text-purple-700' },
};

export default function VerifierTasksPage() {
  return (
    <AuthGuard allowedRoles={['VERIFIER', 'ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const router = useRouter();
  const [tab, setTab] = useState<'tasks' | 'reports'>('tasks');
  const [tasks, setTasks] = useState<any>({ items: [] });
  const [reports, setReports] = useState<any>({ items: [] });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    reportId: '', taskName: '', samplingMethod: '随机抽样', samplingCount: 5,
  });
  const [pendingReports, setPendingReports] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const [t, r] = await Promise.all([
      api.get('/verification/my-tasks'),
      api.get('/emission-reports?verificationStatus=PENDING&pageSize=50'),
    ]);
    setTasks(t);
    setReports(r);
    setPendingReports(r.items.filter((x: any) => x.verificationStatus === 'PENDING'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const onCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/verification/task', createForm);
    setShowCreate(false);
    setCreateForm({ reportId: '', taskName: '', samplingMethod: '随机抽样', samplingCount: 5 });
    await load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">核证工作台</h1>
          <p className="text-gray-500 mt-1">审核排放报告、抽取凭证样本、出具核证调整意见</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>+ 创建核证任务</button>
      </div>

      <div className="flex border-b border-gray-200 gap-2">
        {(['tasks', 'reports'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              tab === t ? 'border-carbon-600 text-carbon-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'tasks' ? `我的核证任务 (${tasks.items?.length || 0})` : `待核证报告 (${pendingReports.length})`}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold mb-4">创建核证任务</h2>
          <form onSubmit={onCreateTask} className="space-y-4">
            <div>
              <label className="label">选择排放报告</label>
              <select
                className="input"
                value={createForm.reportId}
                onChange={(e) => {
                  const rpt = pendingReports.find((x) => x.id === e.target.value);
                  setCreateForm({
                    ...createForm,
                    reportId: e.target.value,
                    taskName: rpt
                      ? `${rpt.enterprise.name} ${rpt.year}年${rpt.month}月核证`
                      : createForm.taskName,
                  });
                }}
                required
              >
                <option value="">— 请选择 —</option>
                {pendingReports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.enterprise.name} | {r.year}年{r.month}月 | 填报量 {Number(r.totalEmission).toFixed(2)} tCO₂e
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">任务名称</label>
              <input className="input" value={createForm.taskName} onChange={(e) => setCreateForm({ ...createForm, taskName: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">抽样方式</label>
                <select className="input" value={createForm.samplingMethod} onChange={(e) => setCreateForm({ ...createForm, samplingMethod: e.target.value })}>
                  <option>随机抽样</option>
                  <option>分层抽样</option>
                  <option>金额单位抽样</option>
                  <option>全量核查</option>
                </select>
              </div>
              <div>
                <label className="label">样本数量</label>
                <input className="input" type="number" min={1} value={createForm.samplingCount} onChange={(e) => setCreateForm({ ...createForm, samplingCount: parseInt(e.target.value || '1') })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>取消</button>
              <button type="submit" className="btn-primary">创建任务</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <div className="card">
          {tab === 'tasks' ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>任务</th><th>企业</th><th>期间</th><th>抽样</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
                <tbody>
                  {tasks.items.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无核证任务，点击右上角「创建核证任务」开始</td></tr>
                  ) : tasks.items.map((t: any) => {
                    const info = statusMap[t.status] || statusMap.IN_PROGRESS;
                    return (
                      <tr key={t.id}>
                        <td className="font-medium">{t.taskName}</td>
                        <td>{t.report?.enterprise?.name || '—'}</td>
                        <td>{t.report?.year}年{t.report?.month}月</td>
                        <td>{t.samplingMethod}（{t.samplingCount}个）</td>
                        <td><span className={`badge ${info.cls}`}>{info.label}</span></td>
                        <td className="text-xs text-gray-500">{dayjs(t.createdAt).format('YYYY-MM-DD')}</td>
                        <td>
                          <button className="text-sm text-carbon-600 hover:underline" onClick={() => router.push(`/verifier/tasks/${t.id}`)}>
                            {t.status === 'IN_PROGRESS' ? '进入核证 →' : '查看详情 →'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>企业</th><th>期间</th><th>填报排放量</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  {pendingReports.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-gray-400">暂无待核证报告</td></tr>
                  ) : pendingReports.map((r: any) => {
                    const info = statusMap[r.verificationStatus] || statusMap.PENDING;
                    return (
                      <tr key={r.id}>
                        <td className="font-medium">{r.enterprise?.name}</td>
                        <td>{r.year}年{r.month}月</td>
                        <td className="font-mono">{Number(r.totalEmission).toFixed(2)} tCO₂e</td>
                        <td><span className={`badge ${info.cls}`}>{info.label}</span></td>
                        <td>
                          <button className="text-carbon-600 hover:underline text-sm" onClick={() => {
                            setCreateForm({
                              reportId: r.id,
                              taskName: `${r.enterprise.name} ${r.year}年${r.month}月核证`,
                              samplingMethod: '随机抽样',
                              samplingCount: 5,
                            });
                            setShowCreate(true);
                          }}>快速创建任务</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
