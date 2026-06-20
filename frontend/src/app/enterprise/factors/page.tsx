'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import Navbar from '../../components/Navbar';
import api from '../../lib/api';

const energyLabels: Record<string, string> = {
  COAL: '煤炭', OIL: '石油', NATURAL_GAS: '天然气',
  ELECTRICITY: '电力', STEAM: '蒸汽', OTHER: '其他',
};

export default function FactorsPage() {
  return (
    <AuthGuard allowedRoles={['ENTERPRISE', 'ADMIN']}>
      <Navbar />
      <Content />
    </AuthGuard>
  );
}

function Content() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { role } = { role: 'ENTERPRISE' };

  useEffect(() => {
    (async () => {
      setList(await api.get('/emission-factors'));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">排放因子</h1>
        <p className="text-gray-500 mt-1">各类能源对应的 CO₂ 排放系数（由园区管理员维护）</p>
      </div>
      <div className="card">
        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-carbon-500 border-t-transparent"></div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>能源类型</th><th>排放因子</th><th>单位</th><th>说明</th></tr>
              </thead>
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td className="font-medium">{energyLabels[f.energyType] || f.energyType}</td>
                    <td className="font-mono text-carbon-700">{Number(f.factorValue).toFixed(6)}</td>
                    <td>{f.unit}</td>
                    <td className="text-gray-500">{f.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
