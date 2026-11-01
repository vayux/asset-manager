import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { format } from 'date-fns';
import { formatCurrency } from '../../utils/currency';


const MonthlySummary = () => {
  const [text,setText]=useState('');

  useEffect(()=>{
    const fetch=async()=>{
      try{
        const res = await api.get('/api/portfolio/analytics/monthly?limit=2');
        const arr = res.data.data||[];
        if(arr.length<2) return;
        const last=arr[arr.length-1];
        const prev=arr[arr.length-2];
        const diff = last.total - prev.total;
        const pct = ((diff/prev.total)*100).toFixed(1);
        const monthName = format(new Date(last.month+'-01'),'MMMM');
        const trend = diff>=0 ? 'increased' : 'decreased';
        setText(`In ${monthName}, your net worth ${trend} by ${formatCurrency(Math.abs(diff))} (${pct}% compared to the previous month). Keep up the good work!`);
      }catch(e){console.error(e);}  
    };
    fetch();
  },[]);

  if(!text) return null;
  return (
    <div className="bg-primary-50 p-4 rounded-lg shadow mb-4">
      <p className="text-sm text-primary-800">{text}</p>
    </div>
  );
};

export default MonthlySummary; 