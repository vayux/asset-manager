import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/currency';

const categoryOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'business', label: 'Business' },
  { value: 'collectible', label: 'Collectible' },
  { value: 'other', label: 'Other' },
];


const AssetForm = ({ mode = 'add', asset = {}, onSuccess, onCancel }) => {
  const isEdit = mode === 'edit';
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    category: asset?.category || 'cash',
    currentValue: asset?.originalValue ?? asset?.currentValue ?? '',
    purchaseDate: asset?.purchaseDate || '',
    depreciationRate: asset?.depreciationRate || '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Asset name is required');
      return;
    }
    if (!formData.currentValue || isNaN(formData.currentValue)) {
      toast.error('Valid value is required');
      return;
    }
    if (formData.depreciationRate && (isNaN(formData.depreciationRate) || formData.depreciationRate < 0 || formData.depreciationRate > 100)) {
      toast.error('Depreciation % must be 0-100');
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        await api.put(`/api/assets/${asset.id}`, {
          name: formData.name.trim(),
          category: formData.category,
          currentValue: parseFloat(formData.currentValue),
          purchaseDate: formData.purchaseDate || undefined,
          depreciationRate: formData.depreciationRate ? parseFloat(formData.depreciationRate) : undefined,
        });
        toast.success('Asset updated');
      } else {
        await api.post('/api/assets', {
          name: formData.name.trim(),
          category: formData.category,
          currentValue: parseFloat(formData.currentValue),
          purchaseDate: formData.purchaseDate || undefined,
          depreciationRate: formData.depreciationRate ? parseFloat(formData.depreciationRate) : undefined,
        });
        toast.success('Asset added');
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
          {isEdit ? 'Edit Asset' : 'Add Asset'}
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
          <div>
            <label className="form-label">Current Value (INR)</label>
            <input
              type="number"
              name="currentValue"
              step="0.01"
              className="form-input"
              value={formData.currentValue}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label className="form-label">Purchase Date</label>
            <input
              type="date"
              name="purchaseDate"
              className="form-input"
              value={formData.purchaseDate}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="form-label">Depreciation Rate (% per year)</label>
            <input
              type="number"
              name="depreciationRate"
              step="0.1"
              min="0"
              max="100"
              className="form-input"
              value={formData.depreciationRate}
              onChange={handleChange}
              placeholder="e.g. 10"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {isEdit ? 'Update' : 'Add'} Asset
          </button>
        </form>
      </div>
    </div>
  );
};

const Assets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAsset, setEditAsset] = useState(null);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/assets');
      setAssets(data.assets);
    } catch (error) {
      toast.error('Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to archive this asset?')) return;
    try {
      await api.delete(`/api/assets/${id}`);
      toast.success('Asset archived');
      fetchAssets();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Assets</h2>
        <button
          onClick={() => { setEditAsset(null); setShowForm(true); }}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-1" /> Add Asset
        </button>
      </div>

      {loading ? (
        <div className="text-center">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="text-center text-gray-500">No assets found.</div>
      ) : (
        <div className="overflow-x-auto bg-white shadow rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Original Value</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Book Value</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{asset.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap capitalize">{asset.category.replace('_', ' ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(asset.originalValue ?? asset.bookValue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">{formatCurrency(asset.bookValue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                    <button
                      onClick={() => { setEditAsset(asset); setShowForm(true); }}
                      className="text-indigo-600 hover:text-indigo-900 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
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
        <AssetForm
          mode={editAsset ? 'edit' : 'add'}
          asset={editAsset}
          onSuccess={() => { setShowForm(false); fetchAssets(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

export default Assets; 