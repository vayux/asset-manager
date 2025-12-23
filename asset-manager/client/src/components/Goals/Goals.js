import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PlusIcon, TrashIcon, FunnelIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { format, addMonths } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const currencyFmt = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

const Goals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const defaultForm={ name:'', targetAmount:'', targetDate:'', currentAmount:'', monthlyContribution:'', scope:'investments' };
  const [form, setForm] = useState(defaultForm);
  const [editId,setEditId]=useState(null);
  const [selected, setSelected] = useState(null); // goal id
  const [projection, setProjection] = useState([]);
  const [slider, setSlider] = useState(0);
  const [sliderDirty, setSliderDirty] = useState(false);
  const [adv, setAdv] = useState({percentiles:[], success:null});
  const todaysMonth = format(new Date(),'yyyy-MM');
  const [investTotal,setInvestTotal]=useState(0); const [assetTotal,setAssetTotal]=useState(0); const [liabTotal,setLiabTotal]=useState(0);
  const [scopeFilter,setScopeFilter]=useState('all');

  const fetchGoals = async()=>{
    try{
      setLoading(true);
      const res = await axios.get('/api/goals');
      setGoals(res.data.goals || []);
    }catch(e){ console.error(e); toast.error('Failed to load goals'); }
    finally{ setLoading(false); }
  };

  useEffect(()=>{ fetchGoals(); },[]);

  useEffect(()=>{
    const fetchTotals=async()=>{
      try{
        const [overviewRes, assetsRes, liabRes] = await Promise.all([
          axios.get('/api/portfolio/overview'),
          axios.get('/api/assets'),
          axios.get('/api/liabilities'),
        ]);
        const inv = overviewRes.data.totalValue||0;
        const ast = (assetsRes.data.assets||[]).reduce((s,a)=>s+parseFloat(a.currentValue||0),0);
        const liab = (liabRes.data.liabilities||[]).reduce((s,l)=>s+parseFloat(l.outstandingAmount||0),0);
        setInvestTotal(inv); setAssetTotal(ast); setLiabTotal(liab);
      }catch(e){ console.error(e); }
    };
    fetchTotals();
  },[]);

  useEffect(()=>{
    const fetchPortfolioTotal = async()=>{
      try{
        const res = await axios.get('/api/portfolio/overview');
        const total = res.data.totalValue || 0;
        setForm(prev=>({...prev,currentAmount: total, scope:'investments' }));
      }catch(e){ console.error(e); }
    };
    if(showAdd){
      fetchPortfolioTotal();
    }
  },[showAdd]);

  const handleAdd=async()=>{
    if(parseFloat(form.targetAmount)<=0){toast.error('Target amount must be positive');return;}
    if(form.targetDate===''){toast.error('Choose a target date');return;}
    try{
      let res;
      const payload={
        ...form,
        targetAmount: parseFloat(form.targetAmount||0),
        currentAmount: parseFloat(form.currentAmount||0),
        monthlyContribution: parseFloat(form.monthlyContribution||0),
      };
      if(editId){
        res = await axios.put(`/api/goals/${editId}`, payload);
      }else{
        res = await axios.post('/api/goals', payload);
      }
      toast.success(editId?'Goal updated':'Goal added');
      setShowAdd(false); setForm(defaultForm); setEditId(null);
      fetchGoals();
    }catch(e){ console.error(e); toast.error('Add failed'); }
  };

  const openProjection = async(goal)=>{
    setSelected(goal);
    setSlider(parseFloat(goal.monthlyContribution||0));
    if(goal.scope==='net_worth'){
      const startAmt = investTotal + assetTotal - liabTotal;
      const contrib = parseFloat(goal.monthlyContribution||0);
      const monthsToTarget = Math.max(1, Math.round((new Date(goal.targetDate) - new Date()) / (30 * 24 * 60 * 60 * 1000)));
      const data=[];
      for(let m=0;m<=monthsToTarget;m++){
        data.push({
          monthOffset:m,
          date: new Date(new Date().getFullYear(), new Date().getMonth()+m,1),
          amount: parseFloat((startAmt + contrib*m).toFixed(2))
        });
      }
      setProjection(data);
    }else{
      await fetchProjection(goal.id, goal.monthlyContribution);
    }
  };

  const fetchProjection = async(id, contrib)=>{
    try{
      const res = await axios.get(`/api/goals/${id}/projection?contribution=${contrib}`);
      setProjection(res.data.projection || []);
    }catch(e){ console.error(e); }
  };

  const handleSliderChange=async(val)=>{
    const num = parseFloat(val);
    setSlider(num);
    setSliderDirty(true);
    if(!selected) return;
    if(selected.scope==='net_worth'){
      const startAmt = investTotal + assetTotal - liabTotal;
      const monthsToTarget = Math.max(1, Math.round((new Date(selected.targetDate) - new Date()) / (30 * 24 * 60 * 60 * 1000)));
      const data=[];
      for(let m=0;m<=monthsToTarget;m++){
        data.push({
          monthOffset:m,
          date: new Date(new Date().getFullYear(), new Date().getMonth()+m,1),
          amount: parseFloat((startAmt + num*m).toFixed(2))
        });
      }
      setProjection(data);
    }else{
      await fetchProjection(selected.id, num);
    }
  };

  const handleSaveContribution = async()=>{
    if(!selected) return;
    try{
      await axios.put(`/api/goals/${selected.id}`, { monthlyContribution: slider });
      setGoals(prev=>prev.map(g=>g.id===selected.id?{...g, monthlyContribution: slider}:g));
      toast.success('Monthly contribution updated');
      setSliderDirty(false);
    }catch(e){ console.error(e); toast.error('Update failed'); }
  };

  const handleAdvancedSim = async()=>{
    if(!selected) return;
    try{
      const res = await axios.get(`/api/goals/${selected.id}/projection/montecarlo?contribution=${slider}`);
      setAdv({percentiles: res.data.percentiles, success:res.data.successProbability});
    }catch(e){ console.error(e); toast.error('Simulation failed'); }
  };

  // NEW: Delete goal
  const handleDelete=async(id)=>{
    if(!window.confirm('Delete this goal permanently?')) return;
    try{
      await axios.delete(`/api/goals/${id}`);
      setGoals(prev=>prev.filter(g=>g.id!==id));
      toast.success('Goal deleted');
    }catch(e){ console.error(e); toast.error('Delete failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Goals</h2>
        <button onClick={()=>setShowAdd(!showAdd)} className="btn-primary flex items-center"><PlusIcon className="h-5 w-5 mr-1"/>Add Goal</button>
      </div>

      {showAdd && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3 max-w-xl">
          <input className="form-input w-full" placeholder="Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <div className="grid grid-cols-2 gap-3">
            <input className="form-input" type="number" min="0" step="100" placeholder="Target Amount" value={form.targetAmount} onChange={e=>setForm({...form,targetAmount:e.target.value})}/>
            <input className="form-input" type="date" placeholder="Target Date" value={form.targetDate} onChange={e=>setForm({...form,targetDate:e.target.value})}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="form-input" type="number" min="0" step="100" placeholder="Current Amount" value={form.currentAmount} onChange={e=>setForm({...form,currentAmount:e.target.value})}/>
            <input className="form-input" type="number" min="0" step="100" placeholder="Monthly Contribution" value={form.monthlyContribution} onChange={e=>setForm({...form,monthlyContribution:e.target.value})}/>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Progress Based On</label>
            <select className="form-input w-full" value={form.scope} onChange={e=>setForm({...form,scope:e.target.value})}>
              <option value="investments">Investments Only</option>
              <option value="net_worth">Total Net Worth</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <button onClick={handleAdd} className="btn-primary">{editId?'Update':'Save'}</button>
            <button onClick={()=>{setShowAdd(false);setForm(defaultForm);setEditId(null);}} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {loading && <div>Loading...</div>}

      {!loading && goals.length===0 && <div className="text-gray-500">No goals yet.</div>}

      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="text-sm font-medium mr-2" htmlFor="scopeFilter">Filter:</label>
          <select id="scopeFilter" className="form-input" value={scopeFilter} onChange={e=>setScopeFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="investments">Investments Only</option>
            <option value="net_worth">Net Worth</option>
          </select>
        </div>
        <span className="text-sm text-gray-500 flex items-center"><FunnelIcon className="h-4 w-4 mr-1"/>Showing {goals.filter(g=>scopeFilter==='all'||g.scope===scopeFilter).length} goals</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.filter(g=>scopeFilter==='all'||g.scope===scopeFilter).map(goal=>{
          const saved = goal.scope==='investments'?investTotal:investTotal+assetTotal-liabTotal;
          const progress = (saved / parseFloat(goal.targetAmount||1))*100;
          return (
            <div key={goal.id} className="card p-4">
              <h3 className="font-semibold text-lg mb-1">{goal.name}</h3>
              <p className="text-sm text-gray-600 mb-2">Target: {currencyFmt(goal.targetAmount)} by {format(new Date(goal.targetDate),'dd MMM yyyy')}</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div className="bg-primary-600 h-2 rounded-full" style={{width:`${Math.min(progress,100)}%`}}></div>
              </div>
              <p className="text-sm">{currencyFmt(saved)} saved ({Math.min(progress,100).toFixed(1)}%)</p>
              <div className="flex space-x-2 mt-3">
                <button onClick={()=>openProjection(goal)} className="btn-secondary">Adjust Projection</button>
                <button onClick={()=>{setShowAdd(true); setEditId(goal.id); setForm({...goal});}} className="btn-primary">Edit</button>
                <button onClick={()=>handleDelete(goal.id)} className="btn-secondary text-red-600 flex items-center"><TrashIcon className="h-4 w-4 mr-1"/>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl relative">
            <button className="absolute top-2 right-2" onClick={()=>{setSelected(null); setProjection([]);}}>&times;</button>
            <h3 className="text-xl font-semibold mb-4">{selected.name} Projection</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution: {currencyFmt(slider)}</label>
              <input type="range" min="0" max="100000" step="500" value={slider} onChange={e=>handleSliderChange(e.target.value)} className="w-full"/>
            </div>
            {sliderDirty && (
              <button onClick={handleSaveContribution} className="btn-primary mb-4">Save Contribution</button>
            )}
            {projection.length>0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projection} margin={{top:5,right:30,left:0,bottom:5}}>
                    <XAxis dataKey="date" tickFormatter={(v)=>format(new Date(v),'MM/yy')}/>
                    <YAxis tickFormatter={v=>v/1000 + 'k'}/>
                    <Tooltip formatter={(v)=>currencyFmt(v)} labelFormatter={(l)=>format(new Date(l),'MMM yyyy')}/>
                    <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} dot={false}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Advanced simulation */}
            {adv.percentiles.length>0 && (
              <div className="mt-6">
                <h4 className="font-medium mb-2">Monte Carlo Projection (p10 / p50 / p90)</h4>
                <p className="text-sm text-gray-600 mb-2">Probability of success: {(adv.success*100).toFixed(1)}%</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={adv.percentiles} margin={{top:5,right:30,left:0,bottom:5}}>
                      <XAxis dataKey="monthOffset" tickFormatter={(v)=>format(addMonths(new Date(),v),'MM/yy')}/>
                      <YAxis tickFormatter={v=> (v/1000).toFixed(0)+'k' } />
                      <Tooltip formatter={(v)=>currencyFmt(v)} labelFormatter={(l)=>'Month '+l} />
                      <Line type="monotone" dataKey="p10" stroke="#F59E0B" dot={false} />
                      <Line type="monotone" dataKey="p50" stroke="#3B82F6" dot={false} />
                      <Line type="monotone" dataKey="p90" stroke="#10B981" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <button onClick={handleAdvancedSim} className="btn-secondary mt-4">Run Advanced Simulation</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Goals; 