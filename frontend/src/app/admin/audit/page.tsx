'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import dayjs from 'dayjs';

const actionMap: Record<string, { label: string; color: string }> = {
  CREATE: { label: '创建', color: 'bg-green-100 text-green-700' },
  UPDATE: { label: '修改', color: 'bg-blue-100 text-blue-700' },
  DELETE: { label: '删除', color: 'bg-red-100 text-red-700' },
  SUBMIT: { label: '提交', color: 'bg-indigo-100 text-indigo-700' },
  VERIFY: { label: '核证', color: 'bg-purple-100 text-purple-700' },
  ADJUST: { label: '调整', color: 'bg-amber-100 text-amber-700' },
  LOCK: { label: '锁定', color: 'bg-gray-700 text-white' },
  CARRY_OVER: { label: '结转', color: 'bg-teal-100 text-teal-700' },
};

const entityMap: Record<string, string> = {
  EnergyConsumption: '能源消耗',
  ProductionOutput: '产量数据',
  EmissionFactor: '排放因子',
  EmissionReport: '排放报告',
  VerificationTask: '核证任务',
  VerificationEvidence: '凭证抽样',
  VerificationAdjustment: '核证调整',
  Baseline: '基线',
  Quota: '配额',
  QuotaOperation: '配额操作',
  CarryOverRecord: '结转记录',
  Enterprise: '企业',
  User: '用户',
};

export default function AuditLogPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const [logs, setLogs] = useState<any>({ items: [], total: 0, page: 1, pageSize: 50 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '', entityType: '', userId: '', startDate: '', endDate: '', page: 1,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, String(v));
    });
    const res = await api.get(`/audit-logs?${params.toString()}`);
    setLogs(res);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filters]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">审计日志</h1>
        <p className="text-gray-500 mt-1">
          系统所有关键操作均写入不可覆盖的审计表，共 <span className="font-bold text-carbon-700">{logs.total}</span> 条记录
        </p>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="label">操作类型</label>
            <select className="input" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}>
              <option value="">全部</option>
              {Object.entries(actionMap).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">实体类型</label>
            <select className="input" value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value, page: 1 })}>
              <option value="">全部</option>
              {Object.entries(entityMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">操作人 ID</label>
            <input className="input" value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value, page: 1 })} placeholder="留空全部" />
          </div>
          <div>
            <label className="label">起始日期</label>
            <input className="input" type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value, page: 1 })} />
          </div>
          <div>
            <label className="label">结束日期</label>
            <input className="input" type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value, page: 1 })} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card py-16 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="table-wrap !rounded-none !border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th className="w-40">时间</th>
                  <th className="w-24">操作</th>
                  <th className="w-32">实体</th>
                  <th className="w-24">实体 ID</th>
                  <th>描述</th>
                  <th className="w-32">操作人</th>
                  <th className="w-20">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.items.length === 0 && <tr><td colSpan={8} className="text-center py-16 text-gray-400">暂无审计记录</td></tr>}
                {logs.items.map((log: any) => {
                  const action = actionMap[log.action] || { label: log.action, color: 'bg-gray-100' };
                  const changes = log.changes as any[] | null;
                  return (
                    <>
                      <tr
                        key={log.id}
                        className={expandedId === log.id ? 'bg-carbon-50' : ''}
                      >
                        <td>
                          {changes && changes.length > 0 && (
                            <button
                              className="text-gray-400 hover:text-carbon-600 font-bold"
                              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            >
                              {expandedId === log.id ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td className="text-xs text-gray-500 whitespace-nowrap font-mono">{dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                        <td><span className={`badge ${action.color} text-xs`}>{action.label}</span></td>
                        <td className="text-sm font-medium">{entityMap[log.entityType] || log.entityType}</td>
                        <td className="font-mono text-xs text-gray-500 truncate max-w-[8rem]" title={log.entityId}>{log.entityId.slice(0, 16)}…</td>
                        <td className="text-sm max-w-xl text-gray-700 truncate">{log.description || '—'}</td>
                        <td className="text-sm text-gray-600">{log.user?.displayName || log.user?.username || log.userId.slice(0, 8)}</td>
                        <td className="text-xs text-gray-500 font-mono">{log.ipAddress?.split('.').slice(0, 2).join('.')}.*.*</td>
                      </tr>
                      {expandedId === log.id && changes && changes.length > 0 && (
                        <tr>
                          <td></td>
                          <td colSpan={7} className="border-t-0 bg-gray-50">
                            <div className="p-4 max-h-96 overflow-y-auto">
                              <div className="text-xs font-semibold text-gray-600 mb-2">字段级变更详情（{changes.length} 项）</div>
                              <div className="space-y-2">
                                {changes.map((c: any, i: number) => (
                                  <div key={i} className="bg-white border border-gray-200 rounded p-3 text-sm">
                                    <div className="font-mono font-medium text-gray-800 mb-2">📌 {c.field}</div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <div className="text-xs text-gray-500 mb-1">变更前</div>
                                        <pre className="bg-red-50 text-red-700 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                                          {JSON.stringify(c.oldValue, null, 2)}
                                        </pre>
                                      </div>
                                      <div>
                                        <div className="text-xs text-gray-500 mb-1">变更后</div>
                                        <pre className="bg-green-50 text-green-700 rounded p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                                          {JSON.stringify(c.newValue, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          {logs.total > 50 && (
            <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center text-sm text-gray-600 bg-gray-50">
              <span>共 {logs.total} 条，每页 50 条</span>
              <div className="flex gap-2">
                <button
                  className="btn-secondary !py-1 !px-3"
                  disabled={filters.page <= 1}
                  onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                >
                  上一页
                </button>
                <span className="px-3 py-1">第 {filters.page} / {Math.ceil(logs.total / 50)} 页</span>
                <button
                  className="btn-secondary !py-1 !px-3"
                  disabled={filters.page >= Math.ceil(logs.total / 50)}
                  onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
