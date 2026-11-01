import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { format } from 'date-fns';

const OverspendAlert = () => {
  const [overspent, setOverspent] = useState([]);
  const month = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: catData }, { data: entryData }] = await Promise.all([
          api.get('/api/budget/categories'),
          api.get(`/api/budget/entries?month=${month}`),
        ]);
        const catMap = {};
        (catData.categories || []).forEach((c) => {
          catMap[c.id] = c.name;
        });
        const over = (entryData.entries || []).filter((e) => (
          parseFloat(e.spentAmount) > parseFloat(e.budgetedAmount)
        )).map((e) => ({
          name: catMap[e.categoryId] || 'Unknown',
          overBy: (parseFloat(e.spentAmount) - parseFloat(e.budgetedAmount)).toFixed(2),
        }));
        setOverspent(over);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [month]);

  if (!overspent.length) return null;

  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
      <strong className="font-bold">Overspending Alert: </strong>
      <span className="block sm:inline">
        {overspent.map((o, idx) => `${o.name} by $${o.overBy}`).join(', ')} this month.
      </span>
    </div>
  );
};

export default OverspendAlert; 