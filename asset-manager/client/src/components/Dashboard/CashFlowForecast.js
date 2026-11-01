import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import { addDays, format } from 'date-fns';
import { formatCurrency } from '../../utils/currency';


const generateIncomeDates = (inc, windowDays=30)=>{
  const today = new Date();
  const events = [];
  let date = new Date(inc.nextPayDate);
  while(date < addDays(today, windowDays)){
    if(date>=today){events.push({date:new Date(date),amount:parseFloat(inc.amount)});}
    // advance date based on frequency
    switch(inc.frequency){
      case 'once': date = addDays(date, 3650); break; // exit loop
      case 'weekly': date = addDays(date,7); break;
      case 'biweekly': date = addDays(date,14); break;
      case 'monthly': date = addDays(date,30); break;
      default: date = addDays(date,30);
    }
  }
  return events;
};

const CashFlowForecast = () => {
  const [data,setData]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const fetch=async()=>{
      try{
        setLoading(true);
        const [assetsRes, liabRes, incRes, invRes] = await Promise.all([
          axios.get('/api/assets'),
          axios.get('/api/liabilities'),
          axios.get('/api/income'),
          axios.get('/api/investments'),
        ]);
        const cashAssets = (assetsRes.data.assets||[]).filter(a=>a.category==='cash');
        const bankInv = (invRes.data.investments||[]).filter(i=>i.category==='bank_account');
        let balance = [...cashAssets, ...bankInv].reduce((s,a)=>s+parseFloat(a.currentValue||a.currentAmount||0),0);
        const today = new Date();
        const windowDays=30;
        const map={};
        for(let i=0;i<=windowDays;i++){
          const d=format(addDays(today,i),'yyyy-MM-dd');
          map[d]=0;
        }
        // liabilities outflows
        (liabRes.data.liabilities||[]).forEach(l=>{
          if(!l.dueDate) return;
          const dStr = l.dueDate;
          if(map[dStr]!==undefined){ map[dStr]-=parseFloat(l.outstandingAmount||0); }
        });
        // incomes inflows
        (incRes.data.incomes||[]).forEach(inc=>{
          generateIncomeDates(inc).forEach(ev=>{
            const dStr=format(ev.date,'yyyy-MM-dd');
            if(map[dStr]!==undefined){map[dStr]+=ev.amount;}
          });
        });
        // build series
        const series=[];
        Object.keys(map).sort().forEach(d=>{
          balance += map[d];
          series.push({date:d,balance});
        });
        setData(series);
      }catch(e){console.error(e);}finally{setLoading(false);}  
    };
    fetch();
  },[]);

  if(loading) return <div className="text-center">Loading Cash Flow...</div>;
  const negativeZone = data.some(pt=>pt.balance<0);
  return (
    <div className="card">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">30-Day Cash-Flow Forecast</h3>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{top:20,right:20,bottom:20,left:0}}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={d=>format(new Date(d),'MMM d')} />
            <YAxis tickFormatter={formatCurrency}/>
            <Tooltip formatter={v=>formatCurrency(v)} labelFormatter={d=>format(new Date(d),'EEEE, MMM d')}/>
            <Line type="monotone" dataKey="balance" stroke="#3B82F6" strokeWidth={2} dot={false}/>
            {negativeZone && <ReferenceArea y1={-999999} y2={0} fill="#FECACA" fillOpacity={0.4}/>}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CashFlowForecast; 