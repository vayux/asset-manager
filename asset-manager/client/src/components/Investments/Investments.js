import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowUpTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/currency';
import InvestmentForm, { categoryOptions } from './InvestmentForm';

const Investments = () => {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editInv, setEditInv] = useState(null);
  const [monthFilter, setMonthFilter] = useState('');

  const fetchInvestments = useCallback(async () => {
    try {
      setLoading(true);
      const query = monthFilter ? `?month=${monthFilter}` : '';
      const res = await api.get(`/api/investments${query}`);
      setInvestments(res.data.investments || []);
    } catch (error) {
      toast.error('Failed to fetch investments');
    } finally {
      setLoading(false);
    }
  }, [monthFilter]);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const handleImport = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = await api.post('/api/investments/import', text, { headers: { 'Content-Type': 'text/csv' } });
      toast.success(`Imported ${res.data.imported} investment(s)`);
      fetchInvestments();
    } catch (error) {
      const rowErrors = error.response?.data?.errors;
      toast.error(error.response?.data?.message || 'Import failed');
      (rowErrors || []).slice(0, 3).forEach(err => toast.error(`Row ${err.row}: ${err.message}`));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this investment?')) return;
    try {
      await api.delete(`/api/investments/${id}`);
      toast.success('Deleted');
      fetchInvestments();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
        <h2 className="text-2xl font-bold text-gray-900">Investments</h2>
          <p className="text-sm text-gray-600">Maintain a list of all investment holdings.</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowAddForm(true)}
            className="btn-primary flex items-center"
          >
            <PlusIcon className="h-5 w-5 mr-1" /> Add Investment
          </button>
          <label className="btn-secondary flex items-center cursor-pointer" title="CSV columns: name, category, currentAmount, initialAmount, investmentDate, institutionName">
            <ArrowUpTrayIcon className="h-5 w-5 mr-1" /> Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
          </label>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="form-input w-40"
          />
          {monthFilter && <button className="btn-secondary" onClick={() => setMonthFilter('')}>Clear</button>}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
        </div>
      ) : investments.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          No investments yet. Click "Add Investment" to get started.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount (INR)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Institution
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {investments.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{inv.name}</span>
                    {inv.subCategory && (
                      <div className="text-sm text-gray-500">{inv.subCategory}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {categoryOptions.find((c) => c.value === inv.category)?.label || inv.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(inv.currentAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {inv.institutionName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {inv.investmentDate || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <button
                      onClick={() => setEditInv(inv)}
                      className="text-primary-600 hover:text-primary-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(inv.id)}
                      className="text-danger-600 hover:text-danger-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showAddForm && (
        <InvestmentForm
          existingInvestments={investments}
          onSuccess={() => {
            setShowAddForm(false);
            fetchInvestments();
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {editInv && (
        <InvestmentForm
          mode="edit"
          investment={editInv}
          existingInvestments={investments}
          onSuccess={() => {
            setEditInv(null);
            fetchInvestments();
          }}
          onCancel={() => setEditInv(null)}
        />
      )}
    </div>
  );
};

export default Investments; 