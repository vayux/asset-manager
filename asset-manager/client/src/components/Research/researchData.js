// Static, educational watchlists. No live prices: each row links to its NSE quote page.
export const LAST_REVIEWED = 'October 2026';

export const LONG_TERM = [
  { symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Private bank', thesis: 'Largest private lender; long record of steady loan growth and asset quality.' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Private bank', thesis: 'High return on equity and strong retail franchise after its clean-up years.' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Conglomerate', thesis: 'Energy cash flows funding telecom (Jio) and retail growth.' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'IT services', thesis: 'Debt-free, high-margin, consistent dividends and buybacks.' },
  { symbol: 'INFY', name: 'Infosys', sector: 'IT services', thesis: 'Global IT services major with high return on capital.' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', thesis: 'One of two scaled private telcos; pricing power as tariffs rise.' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', thesis: 'Dominant consumer brands with very high return on equity.' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Paints', thesis: 'Market leader with strong distribution; watch new competition.' },
  { symbol: 'TITAN', name: 'Titan Company', sector: 'Jewellery / consumer', thesis: 'Organised jewellery leader gaining share from unorganised players.' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'NBFC', thesis: 'Fast-growing consumer lender; check credit costs each quarter.' },
];

export const MID_TERM = [
  { symbol: 'LT', name: 'Larsen & Toubro', sector: 'Infrastructure', thesis: 'Biggest beneficiary of government and private capex order books.' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'Cement', thesis: 'Largest cement maker; housing and infrastructure demand cycle.' },
  { symbol: 'NTPC', name: 'NTPC', sector: 'Power', thesis: 'Rising power demand plus renewable capacity additions.' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation', sector: 'Power transmission', thesis: 'Regulated returns and transmission build-out for renewables.' },
  { symbol: 'HAL', name: 'Hindustan Aeronautics', sector: 'Defence', thesis: 'Indigenisation of defence orders; long order backlog.' },
  { symbol: 'BEL', name: 'Bharat Electronics', sector: 'Defence electronics', thesis: 'Defence electronics orders and export push.' },
  { symbol: 'SBIN', name: 'State Bank of India', sector: 'PSU bank', thesis: 'Improved asset quality; credit growth cycle.' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', sector: 'Autos', thesis: 'Passenger-vehicle leader; SUV and export mix improving.' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'Autos / tractors', thesis: 'SUV momentum and rural recovery for tractors.' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Pharma', thesis: 'Growing specialty drug sales in the US.' },
];

export const SHORT_TERM_RULES = [
  'Trade only liquid large caps (Nifty 50 / Nifty Next 50) so you can exit at a fair price.',
  'Decide the stop-loss before you enter, and never move it further away.',
  'Risk at most 1–2% of your capital on any single trade.',
  'Avoid F&O until you have a tested strategy: SEBI found about 9 in 10 individual F&O traders lost money.',
  'Keep a trade journal; stop trading if you lose for three months in a row.',
];

export const CHECKLIST = [
  'P/E is reasonable compared with the stock’s own 5–10 year history and its peers.',
  'Earnings and revenue have grown steadily over the last 3–5 years.',
  'Return on equity above 15% (banks: return on assets above 1%).',
  'Debt/equity below 1 (not applicable to banks and NBFCs).',
  'No significant promoter pledging; no recent auditor resignations.',
  'No single stock above 5–10% of your portfolio.',
];

export const quoteUrl = (symbol) => `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(symbol)}`;
