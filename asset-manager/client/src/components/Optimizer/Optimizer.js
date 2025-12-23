import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const currencyFmt = (n) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);

const classifyScore = (s)=>{
  if(s>=80) return {label:'Excellent', bg:'bg-green-100', text:'text-green-700'};
  if(s>=60) return {label:'Good', bg:'bg-emerald-100', text:'text-emerald-700'};
  if(s>=40) return {label:'Fair', bg:'bg-yellow-100', text:'text-yellow-800'};
  return {label:'Needs Improvement', bg:'bg-red-100', text:'text-red-700'};
};

const Optimizer = () => {
  const [health, setHealth] = useState(null);
  const [taxOps, setTaxOps] = useState([]);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const month = format(new Date(),'yyyy-MM');
  const [threshold,setThreshold]=useState(10);

  useEffect(()=>{
    const fetchData = async()=>{
      try{
        const [healthRes, taxRes, recRes] = await Promise.all([
          axios.get(`/api/optimizer/health?month=${month}`),
          axios.get(`/api/optimizer/tax-loss?threshold=${threshold}`),
          axios.get(`/api/optimizer/recommendations?month=${month}`),
        ]);
        setHealth(healthRes.data);
        setTaxOps(taxRes.data.opportunities||[]);
        setRecs(recRes.data.recommendations||[]);
      }catch(e){ console.error(e); toast.error('Failed to load optimizer data'); }
      finally{ setLoading(false);}  
    };
    fetchData();
  },[month,threshold]);

  if(loading) return <div>Loading...</div>;

  const handleExportPDF = () => {
    const doc = new jsPDF({orientation:'landscape'});
    doc.setFontSize(16);
    doc.text('Wealth Optimizer Report',14,16);

    // Summary block
    doc.setFontSize(10);
    const summary = [
      [`Net Worth`, currencyFmt(health.netWorth)],
      [`Debt Ratio`, (health.debtRatio*100).toFixed(1)+'%'],
      [`Savings Rate`, (health.savingsRate*100).toFixed(1)+'%'],
      [`Diversification`, health.diversificationScore+'%'],
      [`Liquidity`, health.liquidityScore+'%'],
      [`Health Score`, health.score],
    ];
    autoTable(doc,{startY:22,head:[['Metric','Value']],body:summary,theme:'plain',styles:{fontSize:9}});
    const summaryY = doc.lastAutoTable?.finalY || 30;
    let y = summaryY + 6;

    // Tax loss table
    if(taxOps.length){
      doc.setFontSize(12);
      doc.text('Tax-Loss Harvest Opportunities',14,y);
      y+=4;
      const taxCols = [
        {header:'Name',dataKey:'name'},
        {header:'Decline',dataKey:'declinePercent'},
        {header:'Potential Loss',dataKey:'potentialLoss'},
      ];
      autoTable(doc,{startY:y,columns:taxCols,body:taxOps,styles:{fontSize:8},headStyles:{fillColor:[240,240,240]}});
      y = doc.previousAutoTable.finalY + 6;
    }

    // Recommendations
    if(recs.length){
      doc.setFontSize(12);
      doc.text('Personalized Recommendations',14,y);
      y+=4;
      autoTable(doc,{startY:y,head:[['Recommendation']],body:recs.map(r=>[r]),styles:{fontSize:8},theme:'plain'});
    }

    // Footer page numbers
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(8);
    for(let i=1;i<=pageCount;i++){
      doc.setPage(i);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth()-40, doc.internal.pageSize.getHeight()-10);
    }

    doc.save(`optimizer_report_${month}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Wealth Optimizer</h2>
        <button onClick={handleExportPDF} className="btn-secondary">Export PDF</button>
      </div>

      {/* Financial Health Score */}
      <div className="card p-6 flex flex-col md:flex-row md:items-center md:space-x-6">
        <div className="flex-shrink-0 w-32 h-32 rounded-full bg-primary-100 flex items-center justify-center relative">
          <span className="text-3xl font-bold text-primary-700">{health.score}</span>
          <span className="absolute bottom-2 text-xs text-gray-500">/100</span>
        </div>
        {/* Score classification */}
        {(()=>{const c=classifyScore(health.score);return (
          <span className={`${c.bg} ${c.text} inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 md:mt-0`}>{c.label}</span>
        );})()}
        <div className="flex-1 mt-4 md:mt-0">
          <div className="flex items-center mb-2">
            <h3 className="text-lg font-semibold mr-2">Financial Health Score</h3>
            <InformationCircleIcon className="h-5 w-5 text-gray-400" title="Click to expand details" />
          </div>
          <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Net Worth:</span> {currencyFmt(health.netWorth)}</p>
          <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Debt Ratio:</span> {(health.debtRatio*100).toFixed(1)}% <span className="text-gray-500" title="Total Liabilities ÷ Total Assets">(lower is better)</span></p>
          <p className="text-sm text-gray-700"><span className="font-medium">Savings Rate:</span> {(health.savingsRate*100).toFixed(1)}% <span className="text-gray-500" title="(Income − Spending) ÷ Income">(higher is better)</span></p>
          <p className="text-sm text-gray-700 mb-1"><span className="font-medium">Diversification:</span> {health.diversificationScore}% <span className="text-gray-500" title="How evenly your investments are spread across categories">(higher is better)</span></p>
          <p className="text-sm text-gray-700"><span className="font-medium">Liquidity:</span> {health.liquidityScore}% <span className="text-gray-500" title="Percentage of assets that can be quickly converted to cash">(higher is better)</span></p>

          {/* expandable explanation */}
          <details className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
            <summary className="cursor-pointer font-medium text-primary-600 outline-none">How is the score calculated?</summary>
            <p className="mt-2">The score combines two factors, each contributing up to 50 points:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><span className="font-medium">Debt Ratio (50 pts):</span> <code>(Liabilities ÷ Assets)</code>. Lower ratio yields higher score.</li>
              <li><span className="font-medium">Savings Rate (50 pts):</span> <code>((Income − Spending) ÷ Income)</code>. Higher rate yields higher score.</li>
            </ul>
            <p className="mt-2">Score bands: <strong>80+</strong> Excellent, <strong>60–79</strong> Good, <strong>40–59</strong> Fair, &lt;40 Needs Improvement.</p>
          </details>
        </div>
      </div>

      {/* Tax-Loss Harvest Opportunities */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h3 className="text-lg font-semibold mr-2">Tax-Loss Harvest Opportunities</h3>
            <InformationCircleIcon className="h-5 w-5 text-gray-400" title="Investments whose current value has fallen ≥10% below cost basis" />
          </div>
        </div>
        <div className="flex items-center space-x-4 mb-2">
          <label className="text-sm font-medium">Loss Threshold ({threshold}%)</label>
          <input type="range" min="5" max="30" step="1" value={threshold} onChange={e=>setThreshold(parseInt(e.target.value,10))} className="w-48"/>
        </div>
        {taxOps.length===0 && <p className="text-gray-500">No opportunities detected over {threshold}% decline.</p>}
        {taxOps.length>0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Initial</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Current</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Decline</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Potential Loss</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taxOps.map(op=> (
                  <tr key={op.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">{op.name}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{currencyFmt(op.initialAmount)}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">{currencyFmt(op.currentAmount)}</td>
                    <td className="px-4 py-2 text-right">{op.declinePercent}%</td>
                    <td className="px-4 py-2 text-right">{currencyFmt(op.potentialLoss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Personalized Recommendations */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">Personalized Recommendations</h3>
        {recs.length===0 && <p className="text-gray-500">No specific recommendations for this month – great job!</p>}
        <ul className="list-disc list-inside space-y-2 text-gray-700 text-sm">
          {recs.map((r,i)=>(<li key={i}>{r}</li>))}
        </ul>
      </div>
    </div>
  );
};

export default Optimizer; 