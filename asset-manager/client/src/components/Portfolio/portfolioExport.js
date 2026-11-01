import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import api from '../../api/client';
import { formatCurrency } from '../../utils/currency';

export const exportPortfolioCsv = ({
  assetsTotal,
  investmentsTotal,
  liabilitiesTotal,
  assetsList,
  investmentRows,
  liabilitiesList,
}) => {
  const lines = [];
  lines.push('Portfolio Summary');
  lines.push('Metric,Value');
  lines.push(`Net Worth,${formatCurrency(assetsTotal + investmentsTotal - liabilitiesTotal)}`);
  lines.push(`Assets,${formatCurrency(assetsTotal)}`);
  lines.push(`Investments,${formatCurrency(investmentsTotal)}`);
  lines.push(`Liabilities,${formatCurrency(liabilitiesTotal)}`);
  lines.push('');

  const pushSection = (title, data, cols) => {
    if (data.length === 0) return;
    lines.push(title);
    lines.push(cols.join(','));
    data.forEach((item) => lines.push(cols.map((c) => `"${item[c] ?? ''}"`).join(',')));
    lines.push('');
  };
  pushSection('Assets', assetsList, ['name', 'category', 'currentValue', 'purchaseDate']);
  pushSection('Investments', investmentRows, ['name', 'category', 'currentAmount', 'institutionName']);
  pushSection('Liabilities', liabilitiesList, ['name', 'category', 'outstandingAmount', 'dueDate']);

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'portfolio.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportPortfolioPdf = async ({
  assetsTotal,
  investmentsTotal,
  liabilitiesTotal,
  assetsList,
  investmentRows,
  liabilitiesList,
  monthFilter,
}) => {
  const doc = new jsPDF('landscape');
  doc.setFontSize(16);
  doc.text('Portfolio Report', 14, 20);
  autoTable(doc, {
    startY: 30,
    head: [['Metric', 'Value']],
    body: [
      ['Net Worth', formatCurrency(assetsTotal + investmentsTotal - liabilitiesTotal)],
      ['Assets', formatCurrency(assetsTotal)],
      ['Investments', formatCurrency(investmentsTotal)],
      ['Liabilities', formatCurrency(liabilitiesTotal)],
    ],
  });
  let startY = doc.lastAutoTable.finalY + 10;

  const addSection = (title, data, columns) => {
    if (data.length === 0) return;
    doc.setFontSize(12);
    doc.text(title, 14, startY + 10);
    autoTable(doc, {
      startY: startY + 14,
      head: [columns],
      body: data.map((d) => columns.map((c) => d[c] ?? '')),
      styles: { fontSize: 8 },
    });
    startY = doc.lastAutoTable.finalY + 10;
  };

  addSection('Assets', assetsList, ['name', 'category', 'currentValue', 'purchaseDate']);
  addSection('Investments', investmentRows, ['name', 'category', 'currentAmount', 'institutionName']);
  addSection('Liabilities', liabilitiesList, ['name', 'category', 'outstandingAmount', 'dueDate']);

  // ---------- Additional Data (Budget, Goals, Optimizer) ----------
  const monthStr = monthFilter;
  try {
    const [budgetEntryRes, goalsRes, healthRes, recRes] = await Promise.all([
      api.get(`/api/budget/entries?month=${monthStr}`),
      api.get('/api/goals'),
      api.get(`/api/optimizer/health?month=${monthStr}`),
      api.get(`/api/optimizer/recommendations?month=${monthStr}`),
    ]);

    // Budget summary
    const entries = budgetEntryRes.data.entries || [];
    const totalBudgeted = entries.reduce((s, e) => s + parseFloat(e.budgetedAmount || 0), 0);
    const totalSpent = entries.reduce((s, e) => s + parseFloat(e.spentAmount || 0), 0);
    const remaining = totalBudgeted - totalSpent;
    doc.setFontSize(12);
    doc.text(`Budget Summary (${monthStr})`, 14, startY + 10);
    autoTable(doc, {
      startY: startY + 14,
      head: [['Metric', 'Amount']],
      body: [
        ['Total Budgeted', formatCurrency(totalBudgeted)],
        ['Total Spent', formatCurrency(totalSpent)],
        ['Remaining', formatCurrency(remaining)],
      ],
      theme: 'grid',
      styles: { fontSize: 8 },
    });
    startY = doc.lastAutoTable.finalY + 10;

    // Goals table
    const goals = goalsRes.data.goals || [];
    if (goals.length) {
      doc.text('Goals Overview', 14, startY + 10);
      autoTable(doc, {
        startY: startY + 14,
        head: [['Name', 'Target', 'Current', 'Monthly', 'Target Date']],
        body: goals.map((g) => [
          g.name,
          formatCurrency(g.targetAmount),
          formatCurrency(g.currentAmount),
          formatCurrency(g.monthlyContribution),
          g.targetDate,
        ]),
        styles: { fontSize: 8 },
      });
      startY = doc.lastAutoTable.finalY + 10;
    }

    // Optimizer health summary
    const h = healthRes.data;
    doc.text('Financial Health Summary', 14, startY + 10);
    autoTable(doc, {
      startY: startY + 14,
      head: [['Metric', 'Value']],
      body: [
        ['Net Worth', formatCurrency(h.netWorth)],
        ['Debt Ratio', (h.debtRatio * 100).toFixed(1) + '%'],
        ['Savings Rate', (h.savingsRate * 100).toFixed(1) + '%'],
        ['Diversification', h.diversificationScore + '%'],
        ['Liquidity', h.liquidityScore + '%'],
        ['Health Score', h.score],
      ],
      theme: 'plain',
      styles: { fontSize: 8 },
    });
    startY = doc.lastAutoTable.finalY + 10;

    // Recommendations
    const recommendations = recRes.data.recommendations || [];
    if (recommendations.length) {
      doc.text('Personalized Recommendations', 14, startY + 10);
      autoTable(doc, {
        startY: startY + 14,
        head: [['Recommendation']],
        body: recommendations.map((r) => [r]),
        styles: { fontSize: 8 },
        theme: 'plain',
      });
      startY = doc.lastAutoTable.finalY + 10;
    }
  } catch (err) {
    console.error('extra data fetch', err);
  }

  // capture charts and embed each on its own page
  const chartQueue = [
    { id: 'growthChart', title: 'Portfolio Growth' },
    { id: 'categoryChart', title: 'Category Contribution' },
    { id: 'balanceChart', title: 'Overall Balance' },
  ];
  for (const ch of chartQueue) {
    try {
      const node = document.getElementById(ch.id);
      if (node) {
        const canvas = await html2canvas(node, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgW = 260;
        const imgH = (canvas.height * imgW) / canvas.width;
        doc.addPage();
        doc.setFontSize(14);
        doc.text(ch.title, 14, 20);
        doc.addImage(imgData, 'PNG', 14, 30, imgW, imgH);
      }
    } catch (err) {
      console.error('chart capture', ch.id, err);
    }
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 40,
      doc.internal.pageSize.getHeight() - 10,
    );
  }

  doc.save('master_report.pdf');
};
