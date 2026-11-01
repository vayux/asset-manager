import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/currency';

const categoryOptions = [
  { value: 'loan', label: 'Loan' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'tax', label: 'Tax' },
  { value: 'other', label: 'Other' },
];


const LiabilityForm = ({ mode = 'add', liability = {}, onSuccess, onCancel }) => {
  const isEdit = mode === 'edit';
  const [assetsList, setAssetsList] = useState([]);
  const [formData, setFormData] = useState({
    name: liability?.name || '',
    category: liability?.category || 'loan',
    outstandingAmount: liability?.outstandingAmount || '',
    interestRate: liability?.interestRate || '',
    dueDate: liability?.dueDate || '',
    assetId: liability?.assetId || '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Liability name is required');
      return;
    }
    if (!formData.outstandingAmount || isNaN(formData.outstandingAmount)) {
      toast.error('Valid amount is required');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/api/liabilities/${liability.id}`, {
          name: formData.name.trim(),
          category: formData.category,
          outstandingAmount: parseFloat(formData.outstandingAmount),
          interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
          dueDate: formData.dueDate || undefined,
          assetId: formData.assetId || undefined,
        });
        toast.success('Liability updated');
      } else {
        await api.post('/api/liabilities', {
          name: formData.name.trim(),
          category: formData.category,
          outstandingAmount: parseFloat(formData.outstandingAmount),
          interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
          dueDate: formData.dueDate || undefined,
          assetId: formData.assetId || undefined,
        });
        toast.success('Liability added');
      }
      onSuccess();
    } catch (error) {
      const message = error.response?.data?.message || 'Operation failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadAssets = async () => {
      try {
        const res = await api.get('/api/assets');
        setAssetsList(res.data.assets || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadAssets();
  }, []);

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
          {isEdit ? 'Edit Liability' : 'Add Liability'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Name</label>
            <input
              type="text"
              name="name"
              className="form-input"
              value={formData.name}
              onChange={handleChange}
              required
            />
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
              <label className="form-label">Outstanding Amount (INR)</label>
              <input
                type="number"
                name="outstandingAmount"
                step="0.01"
                className="form-input"
                value={formData.outstandingAmount}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <label className="form-label">Interest Rate (%)</label>
              <input
                type="number"
                name="interestRate"
                step="0.01"
                className="form-input"
                value={formData.interestRate}
                onChange={handleChange}
              />
            </div>
          </div>
          <div>
            <label className="form-label">Due Date</label>
            <input
              type="date"
              name="dueDate"
              className="form-input"
              value={formData.dueDate}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="form-label">Finances Asset (optional)</label>
            <select name="assetId" className="form-input" value={formData.assetId} onChange={handleChange}>
              <option value="">-- None --</option>
              {assetsList.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Link the liability to the asset it finances (e.g., mortgage ↔ property).</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {isEdit ? 'Update' : 'Add'} Liability
          </button>
        </form>
      </div>
    </div>
  );
};

const Liabilities = () => {
  const [liabilities, setLiabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLiability, setEditLiability] = useState(null);

  const fetchLiabilities = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/liabilities');
      setLiabilities(data.liabilities);
    } catch (error) {
      toast.error('Failed to fetch liabilities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiabilities();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to archive this liability?')) return;
    try {
      await api.delete(`/api/liabilities/${id}`);
      toast.success('Liability archived');
      fetchLiabilities();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Liabilities</h2>
        <button
          onClick={() => { setEditLiability(null); setShowForm(true); }}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-1" /> Add Liability
        </button>
      </div>

      {loading ? (
        <div className="text-center">Loading...</div>
      ) : liabilities.length === 0 ? (
        <div className="text-center text-gray-500">No liabilities found.</div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outstanding</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Interest</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {liabilities.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{item.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap capitalize">{item.category.replace('_', ' ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(item.outstandingAmount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{item.interestRate ? `${item.interestRate}%` : '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                    <button
                      onClick={() => { setEditLiability(item); setShowForm(true); }}
                      className="text-indigo-600 hover:text-indigo-900 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <LiabilityForm
          mode={editLiability ? 'edit' : 'add'}
          liability={editLiability}
          onSuccess={() => { setShowForm(false); fetchLiabilities(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default Liabilities; 