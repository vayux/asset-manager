import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/currency';

const categoryOptions = [
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'recurring_deposit', label: 'Recurring Deposit' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'mutual_funds', label: 'Mutual Funds' },
  { value: 'provident_fund', label: 'Provident Fund' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'gold', label: 'Gold' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'personal_loan', label: 'Personal Loan' },
  { value: 'other', label: 'Other' },
];


const InvestmentForm = ({ mode = 'add', investment = {}, onSuccess, onCancel, existingInvestments }) => {
  const isEdit = mode === 'edit';

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    name: investment.name || '',
    category: investment.category || 'bank_account',
    subCategory: investment.subCategory || '',
    currentAmount: investment.currentAmount || '',
    institutionName: investment.institutionName || '',
    investmentDate: investment.investmentDate || (isEdit ? '' : getTodayDate()),
  });
  const [isCustomName, setIsCustomName] = useState(!investment.name);
  const [loading, setLoading] = useState(false);

  // Derive distinct investment names for dropdown
  const investmentNameOptions = React.useMemo(() => {
    if (!existingInvestments) return [];
    const map = new Map();
    existingInvestments.forEach((inv) => {
      if (!map.has(inv.name.toLowerCase())) {
        map.set(inv.name.toLowerCase(), inv);
      }
    });
    return Array.from(map.values());
  }, [existingInvestments]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'name') {
      // Check if this matches an existing investment (case-insensitive)
      const match = investmentNameOptions.find(
        (inv) => inv.name.toLowerCase() === value.toLowerCase()
      );
      if (match) {
        setFormData((prev) => ({
          ...prev,
          name: value,
          category: match.category,
          subCategory: match.subCategory || '',
          institutionName: match.institutionName || '',
        }));
        return; // dont fall-through to generic set
      }
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Investment name is required');
      return;
    }
    if (!formData.currentAmount || isNaN(formData.currentAmount)) {
      toast.error('Valid amount is required');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await axios.put(`/api/investments/${investment.id}`, {
          name: formData.name.trim(),
          category: formData.category,
          subCategory: formData.subCategory.trim() || undefined,
          currentAmount: parseFloat(formData.currentAmount),
          institutionName: formData.institutionName.trim() || undefined,
          investmentDate: formData.investmentDate || undefined,
        });
        toast.success('Investment updated');
      } else {
        await axios.post('/api/investments', {
          name: formData.name.trim(),
          category: formData.category,
          subCategory: formData.subCategory.trim() || undefined,
          currentAmount: parseFloat(formData.currentAmount),
          institutionName: formData.institutionName.trim() || undefined,
          investmentDate: formData.investmentDate || undefined,
        });
        toast.success('Investment added');
      }
      onSuccess();
    } catch (error) {
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg p-6 relative animate-slide-up">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          onClick={onCancel}
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          {isEdit ? 'Edit Investment' : 'Add Investment'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Investment</label>
            <select
              name="nameSelect"
              className="form-input"
              value={isCustomName ? '__new__' : formData.name}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '__new__') {
                  setIsCustomName(true);
                  setFormData((prev) => ({ ...prev, name: '' }));
                } else {
                  setIsCustomName(false);
                  // auto-fill based on selected investment
                  const match = investmentNameOptions.find(
                    (inv) => inv.name === val
                  );
                  if (match) {
                    setFormData((prev) => ({
                      ...prev,
                      name: match.name,
                      category: match.category,
                      subCategory: match.subCategory || '',
                      institutionName: match.institutionName || '',
                    }));
                  }
                }
              }}
            >
              <option value="__new__">-- New Investment --</option>
              {investmentNameOptions.map((opt) => (
                <option key={opt.id} value={opt.name}>
                  {opt.name}
                </option>
              ))}
            </select>

            {isCustomName && (
              <input
                type="text"
                name="name"
                className="form-input mt-2"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter new investment name"
                required
              />
            )}
          </div>

          <div>
            <label className="form-label">Category</label>
            <select
              name="category"
              className="form-input"
              value={formData.category}
              onChange={handleChange}
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Sub Category</label>
              <input
                type="text"
                name="subCategory"
                className="form-input"
                value={formData.subCategory}
                onChange={handleChange}
                placeholder="e.g., Axis Bank"
              />
            </div>
            <div>
              <label className="form-label">Institution</label>
              <input
                type="text"
                name="institutionName"
                className="form-input"
                value={formData.institutionName}
                onChange={handleChange}
                placeholder="e.g., Zerodha"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Amount (INR)</label>
              <input
                type="number"
                name="currentAmount"
                className="form-input"
                value={formData.currentAmount}
                onChange={handleChange}
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="form-label">Investment Date</label>
              <input
                type="date"
                name="investmentDate"
                className="form-input"
                value={formData.investmentDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Save Investment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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
      const res = await axios.get(`/api/investments${query}`);
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

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this investment?')) return;
    try {
      await axios.delete(`/api/investments/${id}`);
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