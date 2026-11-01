import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { PlusIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const tagOptions = [
  { value: 'need', label: 'Need' },
  { value: 'want', label: 'Want' },
  { value: 'saving', label: 'Saving' },
];

const Budget = () => {
  const [categories, setCategories] = useState([]);
  const [entries, setEntries] = useState({}); // budgeted
  const [spentMap, setSpentMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', tag: 'need' });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, entryRes] = await Promise.all([
        axios.get('/api/budget/categories'),
        axios.get(`/api/budget/entries?month=${month}`),
      ]);
      setCategories(catRes.data.categories || []);
      const mapBudget = {}, mapSpent = {};
      (entryRes.data.entries || []).forEach((e) => {
        mapBudget[e.categoryId] = e.budgetedAmount;
        mapSpent[e.categoryId] = e.spentAmount;
      });
      setEntries(mapBudget);
      setSpentMap(mapSpent);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load budget');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAmountChange = (catId, val) => {
    setEntries((prev) => ({ ...prev, [catId]: val }));
  };

  const handleBlur = async (catId) => {
    const amt = parseFloat(entries[catId] || 0);
    if(amt<0){toast.error('Amount cannot be negative'); return;}
    try {
      await axios.post('/api/budget/entries', {
        categoryId: catId,
        month: `${month}-01`,
        budgetedAmount: amt,
      });
      toast.success('Saved');
    } catch (e) {
      console.error(e);
      toast.error('Save failed');
    }
  };

  const handleAddCategory = async () => {
    if (!newCat.name.trim()) return;
    try {
      const res = await axios.post('/api/budget/categories', {
        name: newCat.name.trim(),
        frameworkTag: newCat.tag,
      });
      setCategories((prev) => [...prev, res.data.category]);
      setNewCat({ name: '', tag: 'need' });
      setShowAdd(false);
      toast.success('Category added');
    } catch (e) {
      console.error(e);
      toast.error('Add failed');
    }
  };

  const totalBudgeted = Object.values(entries).reduce((s, v) => s + parseFloat(v || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Budget</h2>
          <p className="text-sm text-gray-600">Plan your spending for each month; monitor overspending highlighted in red.</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="form-input w-40" />
      </div>

      {loading ? (
        <div className="text-center">Loading...</div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tag</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Budgeted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Spent</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((cat) => {
                  const overspent = parseFloat(spentMap[cat.id]||0) > parseFloat(entries[cat.id]||0);
                  return (
                    <tr key={cat.id} className={overspent? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">{cat.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap capitalize">{cat.frameworkTag}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className={`form-input w-32 text-right ${parseFloat(spentMap[cat.id]||0) > parseFloat(entries[cat.id]||0)?'border-red-500':''}`}
                          value={entries[cat.id] || ''}
                          onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                          onBlur={() => handleBlur(cat.id)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className={`form-input w-32 text-right ${parseFloat(spentMap[cat.id]||0) > parseFloat(entries[cat.id]||0)?'border-red-500':''}`}
                          value={spentMap[cat.id] || ''}
                          onChange={(e) => setSpentMap(prev => ({...prev,[cat.id]:e.target.value}))}
                          onBlur={async()=>{
                            const amt = parseFloat(spentMap[cat.id]||0);
                            if(amt<0){toast.error('Amount cannot be negative'); return;}
                            await axios.post('/api/budget/entries',{categoryId:cat.id,month:`${month}-01`,budgetedAmount:entries[cat.id]||0,spentAmount:amt});
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap w-40">
                        {(()=>{ const budget=parseFloat(entries[cat.id]||0); const spent=parseFloat(spentMap[cat.id]||0); const perc = budget? (spent/budget)*100 : 0; const barColor = perc>100? 'bg-red-500': 'bg-primary-600'; return (
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`${barColor} h-2 rounded-full`} style={{width:`${Math.min(perc,100)}%`}}></div>
                          </div>
                        );})()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center space-x-4">
            <span>Total Budgeted: <span className="font-semibold">₹{totalBudgeted.toLocaleString()}</span></span>
            {(()=>{const totalSpent=Object.values(spentMap).reduce((s,v)=>s+parseFloat(v||0),0); const perc= totalBudgeted? (totalSpent/totalBudgeted)*100:0; return (
              <span className={`px-2 py-1 rounded-full text-xs ${perc>100?'bg-red-100 text-red-700':'bg-primary-100 text-primary-700'}`}>{perc.toFixed(0)}% spent</span>
            );})()}
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-primary mt-6 flex items-center"><PlusIcon className="h-5 w-5 mr-1"/>Add Category</button>
          {showAdd && (
            <div className="mt-4 bg-gray-50 p-4 rounded-lg space-y-2 w-full md:w-1/2">
              <input
                type="text"
                className="form-input w-full"
                placeholder="Category name"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              />
              <select className="form-input w-full" value={newCat.tag} onChange={(e) => setNewCat({ ...newCat, tag: e.target.value })}>
                {tagOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <div className="flex space-x-2">
                <button onClick={handleAddCategory} className="btn-primary">Save</button>
                <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Budget; 