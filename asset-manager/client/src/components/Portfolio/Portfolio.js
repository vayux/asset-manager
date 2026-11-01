import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { useSearchParams, Link } from 'react-router-dom';
import { BanknotesIcon, CreditCardIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '../../utils/currency';
import StatCard from './StatCard';
import { exportPortfolioCsv, exportPortfolioPdf } from './portfolioExport';

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#84CC16','#F97316'];


const Portfolio = () => {
  const [growthData, setGrowthData] = useState([]);
  const [stackedData, setStackedData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [searchParams] = useSearchParams();
  const invId = searchParams.get('inv');
  const [invHistory,setInvHistory]=useState([]);
  const [invObj,setInvObj]=useState(null);
  const [investmentFilter] = useState('all');
  const [investmentList, setInvestmentList] = useState([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [liabilitiesTotal, setLiabilitiesTotal] = useState(0);
  const [investmentsTotal,setInvestmentsTotal] = useState(0);
  const [assetsList, setAssetsList] = useState([]);
  const [liabilitiesList, setLiabilitiesList] = useState([]);
  const [netWorthSeries, setNetWorthSeries] = useState([]);
  const [returns, setReturns] = useState(null);

  const loadNetWorth = useCallback(async () => {
    try {
      const [series, ret] = await Promise.all([
        api.get('/api/portfolio/net-worth?limit=90'),
        api.get('/api/portfolio/returns'),
      ]);
      setNetWorthSeries(series.data.data || []);
      setReturns(ret.data);
    } catch (error) {
      // Charts stay empty if analytics are unavailable
    }
  }, []);

  useEffect(() => {
    loadNetWorth();
  }, [loadNetWorth]);

  const takeSnapshot = async () => {
    try {
      await api.post('/api/portfolio/snapshot', { snapshotDate: format(new Date(), 'yyyy-MM-dd') });
      toast.success('Snapshot saved');
      loadNetWorth();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not save snapshot');
    }
  };

  const pct = (value) => (value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`);

  const fetchAll = async () => {
    try {
      setLoading(true);
      await fetchGrowth();
      if(investmentFilter==='all'){
        const [stackedRes, pieRes, assetsRes, liabilitiesRes] = await Promise.all([
          api.get('/api/portfolio/analytics/stacked?limit=12'),
          api.get(`/api/portfolio/overview?month=${monthFilter}`),
          api.get('/api/assets'),
          api.get('/api/liabilities'),
        ]);
        const map = {};
        stackedRes.data.data.forEach(r=>{
          const m=r.month.substring(0,7);
          if(!map[m]) map[m]={month:m};
          map[m][r.category]=parseFloat(r.total);
        });

        // Ensure the currently selected month (monthFilter) is present.
        const invCatBreak = pieRes.data.categoryBreakdown || {};
        const invTotal = parseFloat(pieRes.data.totalValue || 0);
        // Build combined category breakdown (investments + assets)
        const assetsArr = assetsRes.data.assets || [];
        const liabilitiesArr = liabilitiesRes.data.liabilities || [];

        setAssetsList(assetsArr);
        setLiabilitiesList(liabilitiesArr);

        const assetBreak = assetsArr.reduce((acc,a)=>{
          const cat=a.category;
          if(!acc[cat]) acc[cat] = { totalAmount:0, count:0 };
          acc[cat].totalAmount += parseFloat(a.valueInr ?? a.currentValue ?? 0);
          acc[cat].count += 1;
          return acc;
        },{});

        const combinedBreak = {...invCatBreak};
        Object.entries(assetBreak).forEach(([cat,data])=>{
          if(!combinedBreak[cat]) combinedBreak[cat]={ totalAmount:0, count:0 };
          combinedBreak[cat].totalAmount += data.totalAmount;
          combinedBreak[cat].count += data.count;
        });

        // Totals for assets/liabilities
        const assetsSum = assetsArr.reduce((s,a)=>s+parseFloat(a.valueInr ?? a.currentValue ?? 0),0);
        const liabilitiesSum = liabilitiesArr.reduce((s,l)=>s+parseFloat(l.outstandingInr ?? l.outstandingAmount ?? 0),0);
        setAssetsTotal(assetsSum);
        setLiabilitiesTotal(liabilitiesSum);

        if(!map[monthFilter]){
          map[monthFilter] = { month: monthFilter };
          Object.entries(combinedBreak).forEach(([category, data])=>{
            map[monthFilter][category] = data.totalAmount;
          });
        }

        // Determine full category list across months
        const allCats = new Set();
        Object.values(map).forEach(obj => {
          Object.keys(obj).forEach(k => {
            if(k !== 'month') allCats.add(k);
          });
        });
        // Fill missing categories with 0 to keep consistent keys
        Object.values(map).forEach(obj => {
          allCats.forEach(cat => {
            if(!(cat in obj)) obj[cat] = 0;
          });
        });

        const monthKeys = growthData.map(g=>g.month);
        // ensure map has every month from growth chart timeline
        monthKeys.forEach(m=>{
          if(!map[m]) map[m]={month:m};
          allCats.forEach(cat=>{ if(!(cat in map[m])) map[m][cat]=0; });
        });

        setStackedData(Object.values(map).sort((a,b)=>a.month.localeCompare(b.month)));

        setPieData(Object.entries(combinedBreak).map(([k,v])=>({name:k,value:v.totalAmount})));
        setInvestmentsTotal(invTotal);
      } else {
        setStackedData([]); setPieData([]);
      }
    }catch(e){console.error(e);}finally{setLoading(false);}
  };

  const fetchGrowth = async () => {
    if(investmentFilter==='all'){
      const growthRes = await api.get('/api/portfolio/analytics/monthly?limit=12');
      setGrowthData(growthRes.data.data||[]);
    }else{
      const hist = await api.get(`/api/investments/${investmentFilter}/history`);
      const map={};
      hist.data.histories.forEach(h=>{
        const m=h.valuationDate.substring(0,7);
        map[m]=(parseFloat(h.amount));
      });
      const arr=Object.entries(map).map(([month,total])=>({month,total})).sort((a,b)=>a.month.localeCompare(b.month));
      setGrowthData(arr);
    }
  };

  useEffect(()=>{
    if(!invId) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[monthFilter,investmentFilter,invId]);

  useEffect(()=>{
    if(invId){
      const fetch=async()=>{
        try{
          const [h,i]=await Promise.all([
            api.get(`/api/investments/${invId}/history`),
            api.get(`/api/investments/${invId}`)
          ]);
          setInvHistory(h.data.histories||[]);
          setInvObj(i.data.investment);
        }catch(e){console.error(e);}finally{setLoading(false);}
      };
      setLoading(true);
      fetch();
    }
  },[invId]);

  useEffect(()=>{
    const loadInv=async()=>{
      try{
        // Fetch only active investments and deduplicate by label (name + subCategory)
        const res = await api.get('/api/investments'); // defaults to active=true
        const raw = res.data.investments || [];
        const seen = new Set();
        const unique = [];
        raw.forEach(inv => {
          const label = inv.name + (inv.subCategory ? ` (${inv.subCategory})` : '');
          if(!seen.has(label)){
            seen.add(label);
            unique.push(inv);
          }
        });
        setInvestmentList(unique);
      }catch(e){console.error(e);}
    };
    loadInv();
  },[]);

  const netWorth = assetsTotal + investmentsTotal - liabilitiesTotal;


  const exportData = {
    assetsTotal, investmentsTotal, liabilitiesTotal, assetsList, liabilitiesList, monthFilter,
    investmentRows: investmentFilter==='all'?investmentList:invHistory.map(h=>({name:invObj?.name||'',category:invObj?.category||'',currentAmount:h.amount,institutionName:invObj?.institutionName||''})),
  };
  const handleExportCSV = () => exportPortfolioCsv(exportData);
  const handleExportPDF = () => exportPortfolioPdf(exportData);

  return (
    <div className="space-y-6">
      {/* Stat summary */}
      {!invId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Net Worth" value={netWorth} Icon={ChartBarIcon} bgClass="bg-primary-100" textClass="text-primary-600" />
          <StatCard title="Assets" value={assetsTotal} Icon={BanknotesIcon} bgClass="bg-success-100" textClass="text-success-600" />
          <StatCard title="Liabilities" value={liabilitiesTotal} Icon={CreditCardIcon} bgClass="bg-danger-100" textClass="text-danger-600" />
          <StatCard title="Investments" value={investmentsTotal} Icon={ChartBarIcon} bgClass="bg-warning-100" textClass="text-warning-600" />
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
        </div>
      ) : invId ? (
        <>
          <Link to="/portfolio" className="text-primary-600 mb-4 inline-block">← Back to Portfolio</Link>
          <h2 className="text-2xl font-bold mb-2">{invObj?.name}</h2>
          {invHistory.length===0? <p className="text-gray-500">No history yet</p> : (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Monthly Value</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={invHistory.map(h=>({date:h.valuationDate,amount:parseFloat(h.amount)}))} margin={{top:20,right:20,bottom:20,left:0}}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={d=>format(new Date(d),'MMM yy')}/>
                    <YAxis tickFormatter={formatCurrency}/>
                    <Tooltip formatter={v=>formatCurrency(v)} labelFormatter={d=>format(new Date(d),'MMMM yyyy')}/>
                    <Line type="monotone" dataKey="amount" stroke="#3B82F6" strokeWidth={2} dot={{r:3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold text-gray-900">Portfolio Analytics</h2>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
            <input type="month" value={monthFilter} onChange={(e)=>setMonthFilter(e.target.value)} className="form-input w-40"/>
            </div>
            <div className="space-x-2">
              <button onClick={takeSnapshot} className="btn-secondary text-sm">Snapshot</button>
              <button onClick={handleExportCSV} className="btn-secondary text-sm">CSV</button>
              <button onClick={handleExportPDF} className="btn-secondary text-sm">PDF</button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="card lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Net worth over time</h3>
              {netWorthSeries.length ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={netWorthSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis tickFormatter={val => formatCurrency(val)} width={90} />
                      <Tooltip formatter={val => formatCurrency(val)} />
                      <Line type="monotone" dataKey="netWorth" name="Net worth" stroke="#3B82F6" dot={false} />
                      <Line type="monotone" dataKey="investments" name="Investments" stroke="#10B981" dot={false} />
                      <Line type="monotone" dataKey="liabilities" name="Liabilities" stroke="#EF4444" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Snapshots are taken automatically once a day; the chart fills in as they accumulate.</p>
              )}
            </div>
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Returns</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-500">Invested</dt><dd>{formatCurrency(returns?.portfolio.invested)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Current value</dt><dd>{formatCurrency(returns?.portfolio.current)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Absolute return</dt><dd>{pct(returns?.portfolio.absoluteReturn)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">XIRR (annualised)</dt><dd className="font-semibold">{pct(returns?.portfolio.xirr)}</dd></div>
              </dl>
              {returns?.investments?.length > 0 && (
                <table className="w-full mt-4 text-xs">
                  <thead><tr className="text-gray-500 text-left"><th>Holding</th><th className="text-right">CAGR</th></tr></thead>
                  <tbody>
                    {returns.investments.slice(0, 8).map(inv => (
                      <tr key={inv.id}><td className="truncate">{inv.name}</td><td className="text-right">{pct(inv.cagr)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div className="card mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Overall Balance &amp; Category Split ({format(new Date(monthFilter+'-01'),'MMM yyyy')})</h3>
            <div className="flex flex-col md:flex-row md:space-x-6 items-center justify-center">
              {/* Donut Overall Balance */}
              <div className="w-full md:w-1/2 h-72 flex items-center justify-center" id="balanceChart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{name:'Assets',value:assetsTotal},{name:'Investments',value:investmentsTotal},{name:'Liabilities',value:Math.abs(liabilitiesTotal)}]} cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                      <Cell fill="#10B981" />
                      <Cell fill="#3B82F6" />
                      <Cell fill="#EF4444" />
                    </Pie>
                    <Tooltip formatter={val=>formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Pie Category Split */}
              <div className="w-full md:w-1/2 h-72 flex items-center justify-center">
                {pieData.length===0 ? (
                  <div className="text-center text-gray-500">No data</div>
                ) : (
              <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} labelLine={false} label={({name,percent})=> percent>0.05 ? `${name} ${(percent*100).toFixed(0)}%` : ''}>
                        {pieData.map((entry,idx)=><Cell key={`c${idx}`} fill={COLORS[idx%COLORS.length]}/>) }
                      </Pie>
                      <Tooltip formatter={val=>formatCurrency(val)}/>
                    </PieChart>
              </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Combined Growth + Category Contribution */}
          {investmentFilter==='all' && (
              <div className="card mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Growth & Category Contribution</h3>
              <div className="h-96" id="categoryChart">
                  <ResponsiveContainer width="100%" height="100%">
                  {(() => {
                    // Merge stackedData with total from growthData
                    const totalMap = new Map(growthData.map(g=>[g.month,g.total]));
                    const combined = stackedData.map(row=>({ ...row, total: totalMap.get(row.month)||0 }));
                    const keys = Array.from(new Set(stackedData.flatMap(o=>Object.keys(o)).filter(k=>k!=='month')));
                    return (
                      <ComposedChart data={combined} margin={{top:20,right:20,bottom:20,left:60}}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tickFormatter={(m)=>format(new Date(m+'-01'),'MMM yy')}/>
                      <YAxis tickFormatter={formatCurrency}/>
                      <Tooltip formatter={val=>formatCurrency(val)} labelFormatter={m=>format(new Date(m+'-01'),'MMMM yyyy')}/>
                        {keys.map((cat,idx)=>(
                          <Area key={cat} type="monotone" dataKey={cat} stackId="1" stroke={COLORS[idx%COLORS.length]} fill={COLORS[idx%COLORS.length]} />
                      ))}
                        <Line type="monotone" dataKey="total" stroke="#000000" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    );
                  })()}
                  </ResponsiveContainer>
              </div>
              </div>
          )}
        </>
      )}
    </div>
  );
};

export default Portfolio; 