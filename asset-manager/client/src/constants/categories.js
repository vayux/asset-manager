export const investmentCategoryNames = {
  bank_account: 'Bank Account',
  fixed_deposit: 'Fixed Deposit',
  recurring_deposit: 'Recurring Deposit',
  stocks: 'Stocks',
  mutual_funds: 'Mutual Funds',
  provident_fund: 'Provident Fund',
  insurance: 'Insurance',
  gold: 'Gold',
  real_estate: 'Real Estate',
  crypto: 'Cryptocurrency',
  personal_loan: 'Personal Loan',
  other: 'Other',
};

export const getCategoryDisplayName = (cat) => investmentCategoryNames[cat] || cat; 