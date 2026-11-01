export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'JPY', 'AUD', 'CAD', 'CHF'];

const formatters = {};
const formatterFor = (currency) => {
  if (!formatters[currency]) {
    formatters[currency] = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: currency === 'INR' ? 0 : 2 });
  }
  return formatters[currency];
};

// Also used directly as a callback (e.g. chart tickFormatter(value, index)), so ignore anything that isn't a known code
export const formatCurrency = (amount, currency) => {
  const code = CURRENCIES.includes(currency) ? currency : 'INR';
  return formatterFor(code).format(Number(amount) || 0);
};

// Amount in its own currency, plus the INR equivalent when they differ
export const formatWithInr = (amount, currency, inrAmount) => (
  !currency || currency === 'INR' || inrAmount === undefined || inrAmount === null
    ? formatCurrency(amount, currency)
    : `${formatCurrency(amount, currency)} (≈ ${formatCurrency(inrAmount)})`
);
