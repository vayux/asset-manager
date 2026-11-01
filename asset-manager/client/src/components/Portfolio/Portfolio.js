import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { format } from 'date-fns';
import { useSearchParams, Link } from 'react-router-dom';
import { BanknotesIcon, CreditCardIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { formatCurrency } from '../../utils/currency';

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

  const fetchAll = async () => {
    try {
      setLoading(true);
      await fetchGrowth();
      if(investmentFilter==='all'){
        const [stackedRes, pieRes, assetsRes, liabilitiesRes] = await Promise.all([
          axios.get('/api/portfolio/analytics/stacked?limit=12'),
          axios.get(`/api/portfolio/overview?month=${monthFilter}`),
          axios.get('/api/assets'),
          axios.get('/api/liabilities'),
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
          acc[cat].totalAmount += parseFloat(a.currentValue||0);
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
        const assetsSum = assetsArr.reduce((s,a)=>s+parseFloat(a.currentValue||0),0);
        const liabilitiesSum = liabilitiesArr.reduce((s,l)=>s+parseFloat(l.outstandingAmount||0),0);
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
      const growthRes = await axios.get('/api/portfolio/analytics/monthly?limit=12');
      setGrowthData(growthRes.data.data||[]);
    }else{
      const hist = await axios.get(`/api/investments/${investmentFilter}/history`);
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
            axios.get(`/api/investments/${invId}/history`),
            axios.get(`/api/investments/${invId}`)
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
        const res = await axios.get('/api/investments'); // defaults to active=true
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

  const renderStatCard = (title,value,Icon,bgClass='bg-primary-100',textClass='text-primary-600')=>(
    <div className="stat-card">
      <div className="flex items-center">
        <div className={`p-3 ${bgClass} rounded-lg`}>
          <Icon className={`h-6 w-6 ${textClass}`} />
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
        </div>
      </div>
    </div>
  );

  // Export handlers
  const handleExportCSV = () => {
    const lines = [];
    lines.push('Portfolio Summary');
    lines.push('Metric,Value');
    lines.push(`Net Worth,${formatCurrency(assetsTotal + investmentsTotal - liabilitiesTotal)}`);
    lines.push(`Assets,${formatCurrency(assetsTotal)}`);
    lines.push(`Investments,${formatCurrency(investmentsTotal)}`);
    lines.push(`Liabilities,${formatCurrency(liabilitiesTotal)}`);
    lines.push('');

    const pushSection = (title,data,cols) => {
      if(data.length===0) return;
      lines.push(title);
      lines.push(cols.join(','));
      data.forEach(item=>lines.push(cols.map(c=>`"${item[c]??''}"`).join(',')));
      lines.push('');
    };
    pushSection('Assets', assetsList, ['name','category','currentValue','purchaseDate']);
    pushSection('Investments', investmentFilter==='all'?investmentList:invHistory.map(h=>({name:invObj?.name||'',category:invObj?.category||'',currentAmount:h.amount,institutionName:invObj?.institutionName||''})), ['name','category','currentAmount','institutionName']);
    pushSection('Liabilities', liabilitiesList, ['name','category','outstandingAmount','dueDate']);

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url; link.setAttribute('download','portfolio.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('Portfolio Report',14,20);
    autoTable(doc,{startY:30,head:[['Metric','Value']],body:[
      ['Net Worth', formatCurrency(assetsTotal + investmentsTotal - liabilitiesTotal)],
      ['Assets', formatCurrency(assetsTotal)],
      ['Investments', formatCurrency(investmentsTotal)],
      ['Liabilities', formatCurrency(liabilitiesTotal)],
    ]});
    let startY = doc.lastAutoTable.finalY + 10;

    const addSection = (title,data,columns) => {
      if(data.length===0) return;
      doc.setFontSize(12);
      doc.text(title,14,startY+10);
      autoTable(doc,{startY:startY+14,head:[columns],body:data.map(d=>columns.map(c=>d[c]??'')),styles:{fontSize:8}});
      startY = doc.lastAutoTable.finalY + 10;
    };

    addSection('Assets', assetsList, ['name','category','currentValue','purchaseDate']);
    addSection('Investments', investmentFilter==='all'?investmentList:invHistory.map(h=>({name:invObj?.name||'',category:invObj?.category||'',currentAmount:h.amount,institutionName:invObj?.institutionName||''})), ['name','category','currentAmount','institutionName']);
    addSection('Liabilities', liabilitiesList, ['name','category','outstandingAmount','dueDate']);

    // ---------- Additional Data (Budget, Goals, Optimizer) ----------
    const monthStr = monthFilter;
    try {
      const [budgetEntryRes, goalsRes, healthRes, recRes] = await Promise.all([
        axios.get(`/api/budget/entries?month=${monthStr}`),
        axios.get('/api/goals'),
        axios.get(`/api/optimizer/health?month=${monthStr}`),
        axios.get(`/api/optimizer/recommendations?month=${monthStr}`),
      ]);

      // Budget summary
      const entries = budgetEntryRes.data.entries || [];
      const totalBudgeted = entries.reduce((s,e)=>s+parseFloat(e.budgetedAmount||0),0);
      const totalSpent = entries.reduce((s,e)=>s+parseFloat(e.spentAmount||0),0);
      const remaining = totalBudgeted - totalSpent;
      doc.setFontSize(12);
      doc.text(`Budget Summary (${monthStr})`,14,startY+10);
      autoTable(doc,{startY:startY+14,head:[['Metric','Amount']],
        body:[
          ['Total Budgeted',formatCurrency(totalBudgeted)],
          ['Total Spent',formatCurrency(totalSpent)],
          ['Remaining',formatCurrency(remaining)],
        ],theme:'grid',styles:{fontSize:8}});
      startY = doc.lastAutoTable.finalY + 10;

      // Goals table
      const goals = goalsRes.data.goals || [];
      if(goals.length){
        doc.text('Goals Overview',14,startY+10);
        autoTable(doc,{startY:startY+14,head:[['Name','Target','Current','Monthly','Target Date']],
          body:goals.map(g=>[g.name,formatCurrency(g.targetAmount),formatCurrency(g.currentAmount),formatCurrency(g.monthlyContribution),g.targetDate]),styles:{fontSize:8}});
        startY = doc.lastAutoTable.finalY + 10;
      }

      // Optimizer health summary
      const h = healthRes.data;
      doc.text('Financial Health Summary',14,startY+10);
      autoTable(doc,{startY:startY+14,head:[['Metric','Value']],
        body:[
          ['Net Worth',formatCurrency(h.netWorth)],
          ['Debt Ratio',(h.debtRatio*100).toFixed(1)+'%'],
          ['Savings Rate',(h.savingsRate*100).toFixed(1)+'%'],
          ['Diversification',h.diversificationScore+'%'],
          ['Liquidity',h.liquidityScore+'%'],
          ['Health Score',h.score],
        ],theme:'plain',styles:{fontSize:8}});
      startY = doc.lastAutoTable.finalY + 10;

      // Recommendations
      const recommendations = recRes.data.recommendations || [];
      if(recommendations.length){
        doc.text('Personalized Recommendations',14,startY+10);
        autoTable(doc,{startY:startY+14,head:[['Recommendation']],body:recommendations.map(r=>[r]),styles:{fontSize:8},theme:'plain'});
        startY = doc.lastAutoTable.finalY + 10;
      }
    } catch(err){ console.error('extra data fetch',err); }

    // capture charts and embed each on its own page
    const chartQueue = [
      { id: 'growthChart', title: 'Portfolio Growth' },
      { id: 'categoryChart', title: 'Category Contribution' },
      { id: 'balanceChart', title: 'Overall Balance' },
    ];
    for (const ch of chartQueue){
      try{
        const node = document.getElementById(ch.id);
        if(node){
          const canvas = await html2canvas(node,{scale:2});
          const imgData = canvas.toDataURL('image/png');
          const imgW = 260;
          const imgH = (canvas.height*imgW)/canvas.width;
          doc.addPage();
          doc.setFontSize(14);
          doc.text(ch.title,14,20);
          doc.addImage(imgData,'PNG',14,30,imgW,imgH);
        }
      }catch(err){ console.error('chart capture',ch.id,err);} 
    }

    // Footer page numbers
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth()-40, doc.internal.pageSize.getHeight()-10);
    }

    doc.save('master_report.pdf');
  };

  return (
    <div className="space-y-6">
      {/* Stat summary */}
      {!invId && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {renderStatCard('Net Worth', netWorth, ChartBarIcon,'bg-primary-100','text-primary-600')}
          {renderStatCard('Assets', assetsTotal, BanknotesIcon,'bg-success-100','text-success-600')}
          {renderStatCard('Liabilities', liabilitiesTotal, CreditCardIcon,'bg-danger-100','text-danger-600')}
          {renderStatCard('Investments', investmentsTotal, ChartBarIcon,'bg-warning-100','text-warning-600')}
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
              <button onClick={handleExportCSV} className="btn-secondary text-sm">CSV</button>
              <button onClick={handleExportPDF} className="btn-secondary text-sm">PDF</button>
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