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
const LIQUID_INVESTMENT_CATEGORIES = ['bank_account', 'stocks', 'mutual_funds', 'crypto'];
const LIQUID_ASSET_CATEGORIES = ['cash', 'stocks'];

module.exports = {
  INVESTMENT_CATEGORIES,
  ASSET_CATEGORIES,
  LIABILITY_TYPES,
  LIQUID_INVESTMENT_CATEGORIES,
  LIQUID_ASSET_CATEGORIES,
};
