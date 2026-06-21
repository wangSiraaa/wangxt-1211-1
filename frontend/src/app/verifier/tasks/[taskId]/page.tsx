'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import Navbar from '../../../components/Navbar';
import api from '../../../lib/api';
import { useAuth } from '../../../store/auth';
import dayjs from 'dayjs';
import { useParams, useRouter } from 'next/navigation';

const energyLabels: Record<string, string> = {
  COAL: '煤炭', OIL: '石油', NATURAL_GAS: '天然气',
  ELECTRICITY: '电力', STEAM: '蒸汽', OTHER: '其他',
};

export default function VerifierTaskDetailPage() {
  return (
    <AuthGuard allowedRoles={['VERIFIER', 'ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.taskId as string;
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [samplingSeed, setSamplingSeed] = useState<number | undefined>();
  const [error, setError] = useState('');
  const [showAdjust, setShowAdjust] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    energyType: '', itemName: '', originalValue: '', adjustValue: '', reason: '',
  });
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [returnSelected, setReturnSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const tasks = await api.get('/verification/my-tasks?pageSize=100');
    const task = (tasks.items || []).find((t: any) => t.id === taskId);
    if (!task) {
      setError('核证任务不存在');
      return;
    }
    const report = await api.get(`/emission-reports/${task.report.enterpriseId}/${task.report.year}/${task.report.month}`);
    setTask({ ...task, reportFull: report });
    setLoading(false);
  };

  useEffect(() => { load(); }, [taskId, user]);

  const onSample = async () => {
    try {
      await api.post(`/verification/task/${taskId}/sample`, { sampleSeed: samplingSeed });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onSaveEvidence = async (ev: any, field: string, value: any) => {
    try {
      await api.put(`/verification/evidence/${ev.id}`, { [field]: value });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onCreateAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/verification/adjustment', {
        reportId: task.reportId,
        evidenceId: showAdjust,
        energyType: adjustForm.energyType || undefined,
        itemName: adjustForm.itemName,
        originalValue: parseFloat(adjustForm.originalValue),
        adjustValue: parseFloat(adjustForm.adjustValue),
        reason: adjustForm.reason,
      });
      setShowAdjust(null);
      setAdjustForm({ energyType: '', itemName: '', originalValue: '', adjustValue: '', reason: '' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const onComplete = async () => {
    const incomplete = (task.reportFull?.verificationTasks?.[0]?.evidences || [])
      .filter((e: any) => !e.isComplete).length;
    const msg = incomplete > 0
      ? `有 ${incomplete} 条凭证缺失关键凭证，对应排放量将在核证时扣除。确认完成核证并锁定报告？`
      : '完成后报告将锁定，企业端不可再修改。确认？';
    if (!confirm(msg)) return;
    try {
      await api.post(`/verification/task/${taskId}/complete`, { remark: `核证完成 - ${dayjs().format('YYYY-MM-DD')}` });
      alert('核证完成，报告已锁定');
      router.push('/verifier/tasks');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const onReject = async () => {
    const reason = prompt('请输入驳回原因：');
    if (!reason) return;
    try {
      await api.post(`/verification/task/${taskId}/reject`, { reason });
      alert('已驳回');
      router.push('/verifier/tasks');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const openReturn = () => {
    const incomplete = evidences.filter((e: any) => !e.isComplete);
    setReturnSelected(new Set(incomplete.map((e: any) => e.id)));
    setReturnReason('');
    setShowReturn(true);
  };

  const toggleReturnItem = (id: string) => {
    const next = new Set(returnSelected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setReturnSelected(next);
  };

  const onReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!returnReason.trim()) {
      setError('请填写退回说明');
      return;
    }
    const selected = evidences.filter(
      (ev: any) => !ev.isComplete && returnSelected.has(ev.id),
    );
    if (selected.length === 0) {
      setError('请至少选择一项缺失凭证');
      return;
    }
    try {
      await api.post(`/verification/task/${taskId}/return`, {
        reason: returnReason.trim(),
        items: selected.map((ev: any) => ({
          evidenceId: ev.id,
          voucherNo: ev.voucherNo,
          energyType: ev.energyType || undefined,
          itemName: ev.energyType
            ? `${energyLabels[ev.energyType] || ev.energyType} 凭证 ${ev.voucherNo}`
            : `凭证 ${ev.voucherNo}`,
          remark: ev.remark || undefined,
        })),
      });
      alert('已退回缺失凭证给企业，等待企业补传后重新提交');
      setShowReturn(false);
      router.push('/verifier/tasks');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const evidences = task?.reportFull?.verificationTasks?.[0]?.evidences || [];
  const adjustments = task?.reportFull?.adjustments || [];
  const isCompleted = task?.status === 'VERIFIED' || task?.status === 'REJECTED';

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-carbon-500 border-t-transparent"></div></div>;
  if (error && !task) return <div className="max-w-7xl mx-auto px-4 py-8"><div className="card text-red-600">{error}</div></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm text-gray-500 mb-1">核证任务详情</div>
          <h1 className="text-2xl font-bold text-gray-800">{task?.taskName}</h1>
          <p className="text-gray-500 mt-1">
            {task?.report?.enterprise?.name} | {task?.report?.year}年{task?.report?.month}月 | 抽样方式：{task?.samplingMethod}
          </p>
        </div>
        {!isCompleted && (
          <div className="flex gap-2 flex-wrap">
            <button className="btn-secondary" onClick={onReject}>驳回报告</button>
            {evidences.some((e: any) => !e.isComplete) && (
              <button className="btn-secondary !bg-amber-100 !text-amber-800 !border-amber-300 hover:!bg-amber-200" onClick={openReturn}>
                ↩ 退回缺失项给企业补传
              </button>
            )}
            <button className="btn-primary" onClick={onComplete} disabled={evidences.length === 0}>
              ✓ 完成核证并锁定报告
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card"><p className="text-sm text-gray-500">填报排放量</p><p className="text-2xl font-bold mt-2">{Number(task?.report?.totalEmission || 0).toFixed(2)}</p></div>
        <div className="card"><p className="text-sm text-gray-500">已核证调整</p><p className="text-2xl font-bold mt-2 text-purple-700">{adjustments.reduce((s: number, a: any) => s + Number(a.adjustValue), 0).toFixed(2)}</p></div>
        <div className="card"><p className="text-sm text-gray-500">缺失凭证数</p><p className="text-2xl font-bold mt-2 text-red-600">{evidences.filter((e: any) => !e.isComplete).length}</p></div>
        <div className="card bg-gradient-to-br from-carbon-50 to-emerald-50"><p className="text-sm text-gray-600">预计最终核证量</p><p className="text-2xl font-bold mt-2 text-carbon-700">{Number(task?.reportFull?.verifiedEmission || task?.report?.totalEmission || 0).toFixed(2)}</p></div>
      </div>

      {evidences.length === 0 && !isCompleted && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">凭证抽样</h2>
          <p className="text-gray-600 mb-4">点击下方按钮，从该月份能源消耗记录中按配置的抽样数量随机抽取凭证。</p>
          <div className="flex items-end gap-4">
            <div className="flex-1 max-w-xs">
              <label className="label">随机种子（可选，用于可复现抽样）</label>
              <input className="input" type="number" placeholder="留空则自动生成" value={samplingSeed || ''} onChange={(e) => setSamplingSeed(e.target.value ? parseInt(e.target.value) : undefined)} />
            </div>
            <button className="btn-primary" onClick={onSample}>开始抽样 (预计 {task?.samplingCount} 个样本)</button>
          </div>
        </div>
      )}

      {evidences.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">凭证样本核查 ({evidences.length})</h2>
            {!isCompleted && <p className="text-sm text-gray-500">点击单元格可编辑实际值和凭证完整状态</p>}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>凭证号</th><th>能源类型</th><th>申报值</th><th>实际值</th><th>关键凭证</th><th>差异说明</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {evidences.map((e: any) => (
                  <tr key={e.id} className={!e.isComplete ? 'bg-red-50/40' : ''}>
                    <td className="font-mono text-sm">{e.voucherNo}</td>
                    <td>{energyLabels[e.energyType || 'OTHER']} {e.energyType || ''}</td>
                    <td>{Number(e.reportedValue).toFixed(2)}</td>
                    <td>
                      {isCompleted ? (
                        <span className={e.actualValue ? 'font-medium text-carbon-700' : 'text-gray-400'}>
                          {e.actualValue ? Number(e.actualValue).toFixed(2) : '—'}
                        </span>
                      ) : (
                        <input
                          className="input !py-1 !w-28"
                          type="number"
                          step="0.01"
                          placeholder="输入实际值"
                          value={e.actualValue ?? ''}
                          onChange={(ev) => onSaveEvidence(e, 'actualValue', ev.target.value ? parseFloat(ev.target.value) : null)}
                        />
                      )}
                    </td>
                    <td>
                      {isCompleted ? (
                        e.isComplete ? <span className="badge bg-green-100 text-green-700">完整</span> : <span className="badge bg-red-100 text-red-700">缺失，将扣除排放量</span>
                      ) : (
                        <select
                          className="input !py-1 !w-auto"
                          value={e.isComplete ? '1' : '0'}
                          onChange={(ev) => onSaveEvidence(e, 'isComplete', ev.target.value === '1')}
                        >
                          <option value="1">完整</option>
                          <option value="0">缺失凭证</option>
                        </select>
                      )}
                    </td>
                    <td className="text-gray-500 text-xs max-w-xs truncate">{e.remark || '—'}</td>
                    <td>
                      {!isCompleted && (
                        <button
                          className="text-sm text-purple-600 hover:underline"
                          onClick={() => {
                            setShowAdjust(e.id);
                            setAdjustForm({
                              energyType: e.energyType || '',
                              itemName: `${energyLabels[e.energyType || 'OTHER']}消耗调整`,
                              originalValue: String(e.reportedValue),
                              adjustValue: String(e.actualValue ? Number(e.actualValue) - Number(e.reportedValue) : 0),
                              reason: '',
                            });
                          }}
                        >
                          + 调整
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {evidences.some((e: any) => !e.isComplete) && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ⚠ 存在缺失关键凭证的记录。完成核证时，对应排放量将按照 <b>排放因子 × 申报值</b> 计算后从核证总量中扣除。
            </div>
          )}
        </div>
      )}

      {adjustments.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">核证调整记录</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>项目</th><th>原值</th><th>调整</th><th>终值</th><th>原因</th><th>时间</th></tr></thead>
              <tbody>
                {adjustments.map((a: any) => (
                  <tr key={a.id}>
                    <td className="font-medium">{a.itemName}</td>
                    <td>{Number(a.originalValue).toFixed(2)}</td>
                    <td className={a.adjustValue >= 0 ? 'text-red-600' : 'text-green-600'}>
                      {a.adjustValue >= 0 ? '+' : ''}{Number(a.adjustValue).toFixed(2)}
                    </td>
                    <td className="font-bold">{Number(a.finalValue).toFixed(2)}</td>
                    <td className="text-gray-600">{a.reason}</td>
                    <td className="text-xs text-gray-500">{dayjs(a.adjustedAt).format('YYYY-MM-DD HH:mm')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(task?.reportFull?.reportReturns || []).length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">退回与补交记录</h2>
          <div className="space-y-3">
            {(task?.reportFull?.reportReturns || []).map((r: any) => (
              <div key={r.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={r.status === 'RESUBMITTED' ? 'badge bg-green-100 text-green-700' : 'badge bg-amber-100 text-amber-700'}>
                      {r.status === 'RESUBMITTED' ? '已补交' : '待补交'}
                    </span>
                    <span className="text-sm text-gray-600">
                      退回人：{r.returnedByUser?.displayName || r.returnedByUser?.username || '—'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {dayjs(r.returnedAt).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </div>
                  {r.resubmittedAt && (
                    <span className="text-xs text-green-600">
                      企业再次提交：{dayjs(r.resubmittedAt).format('YYYY-MM-DD HH:mm')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <span className="text-gray-500">退回说明：</span>{r.reason}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(r.items || []).map((it: any, idx: number) => (
                    <span key={it.id || idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {it.energyType ? `${energyLabels[it.energyType] || it.energyType} ` : ''}{it.itemName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdjust && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAdjust(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">新增核证调整</h3>
            <form onSubmit={onCreateAdjust} className="space-y-4">
              <div>
                <label className="label">项目名称</label>
                <input className="input" value={adjustForm.itemName} onChange={(e) => setAdjustForm({ ...adjustForm, itemName: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">原始值</label>
                  <input className="input" type="number" step="0.01" value={adjustForm.originalValue} onChange={(e) => setAdjustForm({ ...adjustForm, originalValue: e.target.value })} required />
                </div>
                <div>
                  <label className="label">调整量（+/-）</label>
                  <input className="input" type="number" step="0.01" value={adjustForm.adjustValue} onChange={(e) => setAdjustForm({ ...adjustForm, adjustValue: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="label">调整原因</label>
                <textarea className="input min-h-[80px]" value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="说明调整的依据和原因" required />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                预览终值：<span className="font-bold text-carbon-700">
                  {(parseFloat(adjustForm.originalValue || '0') + parseFloat(adjustForm.adjustValue || '0')).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowAdjust(null)}>取消</button>
                <button type="submit" className="btn-primary">确认调整</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReturn && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowReturn(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">退回缺失凭证给企业补传</h3>
            <p className="text-sm text-gray-500 mb-4">勾选需要退回的缺失凭证，企业补传后再次提交时将记录补交时间。</p>
            <form onSubmit={onReturn} className="space-y-4">
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-auto">
                {evidences.filter((e: any) => !e.isComplete).map((e: any) => (
                  <label key={e.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={returnSelected.has(e.id)}
                      onChange={() => toggleReturnItem(e.id)}
                      className="h-4 w-4 rounded border-gray-300 text-carbon-600"
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-medium">{energyLabels[e.energyType || 'OTHER']} {e.energyType || ''} · {e.voucherNo}</div>
                      {e.remark && <div className="text-xs text-gray-400">{e.remark}</div>}
                    </div>
                  </label>
                ))}
              </div>
              <div>
                <label className="label">退回说明（原因）</label>
                <textarea
                  className="input min-h-[90px]"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="说明缺失凭证的具体情况，便于企业针对性补传"
                  required
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowReturn(false)}>取消</button>
                <button type="submit" className="btn-primary">确认退回</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
