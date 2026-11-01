const INVESTMENT_CATEGORIES = [
  'bank_account',
  'fixed_deposit',
  'recurring_deposit',
  'stocks',
  'mutual_funds',
  'provident_fund',
  'insurance',
  'gold',
  'real_estate',
  'crypto',
  'personal_loan',
  'other',
];

const ASSET_CATEGORIES = ['cash', 'real_estate', 'vehicle', 'business', 'collectible', 'stocks', 'gadgets', 'other'];

const LIABILITY_TYPES = ['loan', 'credit_card', 'mortgage', 'tax', 'other'];

// Holdings that can be turned into cash within days, used by the health score
// Retired for new entries; existing rows keep them. Personal loans belong in liabilities, shares in investments.
const RETIRED_INVESTMENT_CATEGORIES = ['personal_loan'];
const RETIRED_ASSET_CATEGORIES = ['stocks'];
const ACTIVE_INVESTMENT_CATEGORIES = INVESTMENT_CATEGORIES.filter(c => !RETIRED_INVESTMENT_CATEGORIES.includes(c));
const ACTIVE_ASSET_CATEGORIES = ASSET_CATEGORIES.filter(c => !RETIRED_ASSET_CATEGORIES.includes(c));
const RETIRED_MESSAGES = {
  personal_loan: 'Personal loans are tracked under Liabilities',
  stocks: 'Shares are tracked under Investments',
};

// express-validator custom check: known category, and not a retired one unless it is the record's existing value
const categoryCheck = (all, retired) => (value) => {
  if (!all.includes(value)) throw new Error('Invalid category');
  if (retired.includes(value)) throw new Error(RETIRED_MESSAGES[value] || 'This category is no longer available');
  return true;
};

const LIQUID_INVESTMENT_CATEGORIES = ['bank_account', 'stocks', 'mutual_funds', 'crypto'];
const LIQUID_ASSET_CATEGORIES = ['cash', 'stocks'];

module.exports = {
  INVESTMENT_CATEGORIES,
  RETIRED_INVESTMENT_CATEGORIES,
  RETIRED_ASSET_CATEGORIES,
  ACTIVE_INVESTMENT_CATEGORIES,
  ACTIVE_ASSET_CATEGORIES,
  RETIRED_MESSAGES,
  categoryCheck,
  ASSET_CATEGORIES,
  LIABILITY_TYPES,
  LIQUID_INVESTMENT_CATEGORIES,
  LIQUID_ASSET_CATEGORIES,
};
