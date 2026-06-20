'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';
import dayjs from 'dayjs';

export default function CarryOverPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const currentYear = dayjs().year();
  const [tab, setTab] = useState<'baseline' | 'carryover'>('baseline');
  const [year, setYear] = useState(currentYear - 1);
  const [fromYear, setFromYear] = useState(currentYear - 1);
  const [toYear, setToYear] = useState(currentYear);
  const [baselines, setBaselines] = useState<any>({ items: [] });
  const [enterprises, setEnterprises] = useState<any>({ items: [] });
  const [quotas, setQuotas] = useState<any[]>([]);
  const [carryRecords, setCarryRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [carryForm, setCarryForm] = useState({
    enterpriseId: '', carryRate: 1.0, customAmount: '', remark: '',
  });

  const loadBaselines = async () => {
    setLoading(true);
    const [bs, es] = await Promise.all([
      api.get(`/quota/baselines?year=${year}&pageSize=100`),
      api.get(`/enterprises?pageSize=100`),
    ]);
    const qs: any[] = [];
    for (const e of es.items) {
      try {
        const q = await api.get(`/quota/${e.id}/${year}`);
        qs.push({ ...q, enterprise: e });
      } catch {}
    }
    setBaselines(bs);
    setEnterprises(es);
    setQuotas(qs);
    setCarryRecords(await api.get('/quota/carry-over/records'));
    setLoading(false);
  };

  const loadCarryOver = async () => {
    setLoading(true);
    const [es, records] = await Promise.all([
      api.get('/enterprises?pageSize=100'),
      api.get('/quota/carry-over/records'),
    ]);
    setEnterprises(es);
    setCarryRecords(records);
    setLoading(false);
  };

  useEffect(() => { if (tab === 'baseline') loadBaselines(); else loadCarryOver(); }, [tab, year, fromYear, toYear]);

  const onLockBaseline = async (enterpriseId: string, eName: string) => {
    if (!confirm(`锁定 ${eName} ${year}年度基线？\n锁定后将作为后续年度配额分配的基准，不可修改。\n\n⚠ 请先确认该年度所有月份排放报告均已通过核证。`)) return;
    try {
      await api.post('/quota/baseline/lock', { enterpriseId, year });
      alert('基线锁定成功');
      await loadBaselines();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const onPreview = async () => {
    if (!carryForm.enterpriseId) return;
    try {
      const p = await api.get(`/quota/carry-over/preview?enterpriseId=${carryForm.enterpriseId}&fromYear=${fromYear}&carryRate=${carryForm.carryRate}`);
      setPreview(p);
    } catch (e: any) {
      alert(e.message);
    }
  };

  useEffect(() => {
    if (carryForm.enterpriseId && tab === 'carryover') onPreview();
    else setPreview(null);
  }, [carryForm.enterpriseId, fromYear, carryForm.carryRate, tab]);

  const onExecuteCarryOver = async () => {
    if (!preview?.canExecute) {
      alert('上一年度基线未锁定，无法执行结转。请先在「基线锁定」标签页锁定基线。');
      return;
    }
    if (!confirm(`确认执行 ${fromYear} → ${toYear} 年度配额结转？\n\n企业 ID: ${carryForm.enterpriseId}\n结转率: ${(carryForm.carryRate * 100).toFixed(2)}%\n结转金额: ${carryForm.customAmount || preview?.carryAmount || 0} tCO₂e\n\n此操作将同时锁定上下年度配额，不可撤销。`)) return;
    try {
      await api.post('/quota/carry-over', {
        enterpriseId: carryForm.enterpriseId,
        fromYear,
        toYear,
        carryRate: carryForm.carryRate,
        customAmount: carryForm.customAmount ? parseFloat(carryForm.customAmount) : undefined,
        remark: carryForm.remark,
      });
      alert('结转成功');
      setCarryForm({ enterpriseId: '', carryRate: 1.0, customAmount: '', remark: '' });
      setPreview(null);
      await loadCarryOver();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">基线锁定与跨年度结转</h1>
        <p className="text-gray-500 mt-1">锁定上一年度排放基线作为配额基准，执行配额余额跨年度结转</p>
      </div>

      <div className="flex border-b border-gray-200 gap-2">
        {([
          ['baseline', '🔒 基线锁定'],
          ['carryover', '🔄 跨年度结转'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              tab === k ? 'border-carbon-600 text-carbon-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'baseline' && (
        <>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="label mb-0">选择年度：</label>
            <select className="input w-auto" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {[3, 2, 1, 0].map((i) => <option key={i} value={currentYear - i}>{currentYear - i}年</option>)}
            </select>
            <div className="text-sm text-gray-500 ml-auto">
              共 {baselines.items.length} 家企业 · {baselines.items.filter((b: any) => b.isLocked).length} 家已锁定
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
                      <th>企业</th>
                      <th>企业代码</th>
                      <th>{year}年度核证排放总量 (tCO₂e)</th>
                      <th>配额余额 (tCO₂e)</th>
                      <th>基线状态</th>
                      <th>批准时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enterprises.items.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无企业数据</td></tr>}
                    {enterprises.items.map((e: any) => {
                      const baseline = baselines.items.find((b: any) => b.enterpriseId === e.id);
                      const quota = quotas.find((q: any) => q.enterprise?.id === e.id);
                      const locked = baseline?.isLocked;
                      return (
                        <tr key={e.id} className={locked ? 'bg-green-50/40' : ''}>
                          <td className="font-medium">{e.name}</td>
                          <td className="text-gray-500">{e.code}</td>
                          <td className="font-mono">{baseline ? Number(baseline.totalEmission).toFixed(2) : <span className="text-gray-400">— 数据不完整</span>}</td>
                          <td className={quota && Number(quota.balance) > 0 ? 'text-carbon-700 font-medium' : ''}>
                            {quota ? Number(quota.balance).toFixed(2) : '—'}
                          </td>
                          <td>
                            {locked ? (
                              <span className="badge bg-green-100 text-green-700">🔒 已锁定</span>
                            ) : baseline ? (
                              <span className="badge bg-amber-100 text-amber-700">待锁定</span>
                            ) : (
                              <span className="badge bg-gray-100 text-gray-600">未生成</span>
                            )}
                          </td>
                          <td className="text-xs text-gray-500">{baseline?.approvedAt ? dayjs(baseline.approvedAt).format('YYYY-MM-DD') : '—'}</td>
                          <td>
                            <button
                              className={`text-sm ${locked ? 'text-gray-400 cursor-not-allowed' : 'text-carbon-600 hover:underline font-medium'}`}
                              onClick={() => !locked && onLockBaseline(e.id, e.name)}
                              disabled={locked}
                            >
                              {locked ? '已锁定' : '锁定基线'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'carryover' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">执行结转</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">源年度</label>
                    <select className="input" value={fromYear} onChange={(e) => setFromYear(parseInt(e.target.value))}>
                      {[3, 2, 1].map((i) => <option key={i} value={currentYear - i}>{currentYear - i}年</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">目标年度</label>
                    <select className="input" value={toYear} onChange={(e) => setToYear(parseInt(e.target.value))}>
                      {[2, 1, 0].map((i) => <option key={i} value={currentYear - i + 1}>{currentYear - i + 1}年</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">选择企业</label>
                  <select className="input" value={carryForm.enterpriseId} onChange={(e) => setCarryForm({ ...carryForm, enterpriseId: e.target.value })}>
                    <option value="">— 请选择企业 —</option>
                    {enterprises.items.map((e: any) => (
                      <option key={e.id} value={e.id}>{e.name} ({e.code})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">结转率 (%)</label>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={carryForm.carryRate * 100}
                      onChange={(e) => setCarryForm({ ...carryForm, carryRate: parseFloat(e.target.value) / 100 })}
                    />
                    <p className="text-xs text-gray-500 mt-1">默认 100% 结转余额</p>
                  </div>
                  <div>
                    <label className="label">自定义金额 (可选)</label>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      placeholder="留空则按结转率自动计算"
                      value={carryForm.customAmount}
                      onChange={(e) => setCarryForm({ ...carryForm, customAmount: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">备注</label>
                  <textarea className="input min-h-[80px]" value={carryForm.remark} onChange={(e) => setCarryForm({ ...carryForm, remark: e.target.value })} placeholder="说明结转原因或特殊处理" />
                </div>

                {preview && (
                  <div className={`rounded-lg p-4 border ${preview.canExecute ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <h3 className="font-semibold mb-3 text-sm text-gray-700">结转预览</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500">{fromYear}年度余额：</span><span className="font-medium">{Number(preview.fromQuotaBalance).toFixed(2)} tCO₂e</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">结转率：</span><span className="font-medium">{(preview.carryRate * 100).toFixed(2)}%</span></div>
                      <div className="flex justify-between col-span-2"><span className="text-gray-500">预计结转金额：</span><span className="font-bold text-carbon-700">{Number(preview.carryAmount).toFixed(2)} tCO₂e</span></div>
                      <div className="flex justify-between col-span-2">
                        <span className="text-gray-500">基线状态：</span>
                        <span className={preview.baselineLocked ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>
                          {preview.baselineLocked ? '✅ 已锁定（可结转）' : '❌ 未锁定（需先锁定基线）'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  className="btn-primary w-full py-3"
                  onClick={onExecuteCarryOver}
                  disabled={!carryForm.enterpriseId || !preview?.canExecute}
                >
                  🔄 执行 {fromYear} → {toYear} 年度结转
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-semibold mb-4">历史结转记录</h2>
              {carryRecords.length === 0 ? (
                <p className="text-center py-12 text-gray-400">暂无结转记录</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {carryRecords.map((r) => {
                    const enterprise = enterprises.items.find((e: any) => e.id === r.enterpriseId);
                    return (
                      <div key={r.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{enterprise?.name || r.enterpriseId}</div>
                            <div className="text-sm text-gray-500 mt-1">{r.fromYear} → {r.toYear} 年度</div>
                          </div>
                          <span className="badge bg-purple-50 text-purple-700">{Number(r.carryAmount).toFixed(2)} tCO₂e</span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center justify-between mt-2">
                          <span>{dayjs(r.operatedAt).format('YYYY-MM-DD HH:mm')}</span>
                          <span className="badge bg-green-50 text-green-700">🔒 基线已锁定</span>
                        </div>
                        {r.remark && <div className="text-sm text-gray-600 mt-2 bg-gray-50 rounded px-3 py-2">备注：{r.remark}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
