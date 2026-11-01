import React, { useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { XMarkIcon } from '@heroicons/react/24/outline';
import CurrencySelect from '../common/CurrencySelect';

export const categoryOptions = [
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
  { value: 'personal_loan', label: 'Personal Loan', retired: true },
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
    currency: investment.currency || 'INR',
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
        await api.put(`/api/investments/${investment.id}`, {
          name: formData.name.trim(),
          category: formData.category,
          currency: formData.currency,
          subCategory: formData.subCategory.trim() || undefined,
          currentAmount: parseFloat(formData.currentAmount),
          institutionName: formData.institutionName.trim() || undefined,
          investmentDate: formData.investmentDate || undefined,
        });
        toast.success('Investment updated');
      } else {
        await api.post('/api/investments', {
          name: formData.name.trim(),
          category: formData.category,
          currency: formData.currency,
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
              {categoryOptions.filter((opt) => !opt.retired || opt.value === investment.category).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="currency" className="form-label">Currency</label>
            <CurrencySelect value={formData.currency} onChange={handleChange} />
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

export default InvestmentForm;
