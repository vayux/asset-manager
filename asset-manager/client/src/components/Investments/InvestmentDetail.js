import React, {useEffect,useState} from 'react';
import {useParams, Link} from 'react-router-dom';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const formatCurrency = amt=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(amt);

const InvestmentDetail=()=>{
  const {id}=useParams();
  const [history,setHistory]=useState([]);
  const [inv,setInv]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const fetch=async()=>{
      try{
        const [histRes, invRes]=await Promise.all([
          axios.get(`/api/investments/${id}/history`),
          axios.get(`/api/investments/${id}`)
        ]);
        setHistory(histRes.data.histories||[]);
        setInv(invRes.data.investment);
      }catch(e){console.error(e);}finally{setLoading(false);}
    };
    fetch();
  },[id]);

  return loading? <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"/></div> : (
    <div className="space-y-6">
      <Link to="/investments" className="text-primary-600">← Back</Link>
      <h2 className="text-2xl font-bold text-gray-900">{inv?.name}</h2>
      {history.length===0? <p className="text-gray-500">No history yet</p> : (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Monthly Value</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history.map(h=>({date:h.valuationDate,amount:parseFloat(h.amount)}))} margin={{top:20,right:20,bottom:20,left:0}}>
                <CartesianGrid strokeDasharray="3 3"/>
                <XAxis dataKey="date" tickFormatter={d=>format(new Date(d),'MMM yy')}/>
                <YAxis tickFormatter={formatCurrency}/>
                <Tooltip formatter={val=>formatCurrency(val)} labelFormatter={d=>format(new Date(d),'MMMM yyyy')}/>
                <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} dot={{r:3}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
export default InvestmentDetail; 