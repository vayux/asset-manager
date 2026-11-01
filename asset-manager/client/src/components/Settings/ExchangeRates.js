import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api/client';

const sourceLabel = (source) => (source === 'manual' ? 'Your rate' : source);

const ExchangeRates = () => {
  const queryClient = useQueryClient();
  const [currency, setCurrency] = useState('USD');
  const [rate, setRate] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['fx-rates'],
    queryFn: async () => (await api.get('/api/fx/rates')).data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['fx-rates'] });
  const onError = (err) => toast.error(err.response?.data?.errors?.[0]?.msg || err.response?.data?.message || 'Could not save rate');

  const save = useMutation({
    mutationFn: () => api.put(`/api/fx/rates/${currency}`, { rate: Number(rate) }),
    onSuccess: () => { toast.success(`Saved ${currency} rate`); setRate(''); refresh(); },
    onError,
  });
  const remove = useMutation({
    mutationFn: (code) => api.delete(`/api/fx/rates/${code}`),
    onSuccess: () => { toast.success('Manual rate removed'); refresh(); },
    onError,
  });

  if (isLoading) return <p className="text-sm text-gray-500">Loading rates…</p>;
  if (error) return <p className="text-sm text-danger-600">Exchange rates are unavailable right now.</p>;

  const rows = Object.entries(data.rates).filter(([code]) => code !== data.base);
  const foreign = data.supported.filter((c) => c !== data.base);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Totals are shown in ₹. Live rates come from Yahoo Finance, then the ECB feed; your own rate is used only when neither is reachable.
      </p>
      {data.missing.length > 0 && (
        <div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-800">
          No rate for {data.missing.join(', ')}; those amounts are counted unconverted. Add a manual rate below.
        </div>
      )}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500"><th className="py-2">Currency</th><th>1 unit in ₹</th><th>Source</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={3} className="py-2 text-gray-500">Everything you hold is in ₹.</td></tr>
          )}
          {rows.map(([code, r]) => (
            <tr key={code} className="border-t">
              <td className="py-2 font-medium">{code}</td>
              <td>₹{Number(r.rate).toFixed(4)}</td>
              <td>{sourceLabel(r.source)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div>
          <label htmlFor="fx-currency" className="form-label">Currency</label>
          <select id="fx-currency" className="form-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {foreign.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fx-rate" className="form-label">Manual rate (₹ per unit)</label>
          <input id="fx-rate" type="number" step="0.0001" min="0" className="form-input" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary" disabled={!rate || save.isPending}>Save rate</button>
      </form>

      {data.manual.length > 0 && (
        <ul className="space-y-2 text-sm">
          {data.manual.map((m) => (
            <li key={m.currency} className="flex items-center justify-between">
              <span>{m.currency}: ₹{m.rate.toFixed(4)} (manual)</span>
              <button type="button" className="text-danger-600 hover:underline" onClick={() => remove.mutate(m.currency)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ExchangeRates;
