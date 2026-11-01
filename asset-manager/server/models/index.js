const User = require('./User');
const Investment = require('./Investment');
const InvestmentHistory = require('./InvestmentHistory');
const PortfolioSnapshot = require('./PortfolioSnapshot');
const Asset = require('./Asset');
const Liability = require('./Liability');
const AssetValuation = require('./AssetValuation');
const BudgetCategory = require('./BudgetCategory');
const BudgetEntry = require('./BudgetEntry');
const Income = require('./Income');
const Goal = require('./Goal');
const Session = require('./Session');
const UserToken = require('./UserToken');
const ExchangeRate = require('./ExchangeRate');

// Define associations
User.hasMany(ExchangeRate, { foreignKey: 'userId', as: 'exchangeRates', onDelete: 'CASCADE' });
ExchangeRate.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Investment, { foreignKey: 'userId', as: 'investments' });
Investment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(PortfolioSnapshot, { foreignKey: 'userId', as: 'portfolioSnapshots' });
PortfolioSnapshot.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Investment.hasMany(InvestmentHistory, { foreignKey: 'investmentId', as: 'history' });
InvestmentHistory.belongsTo(Investment, { foreignKey: 'investmentId', as: 'investment' });

User.hasMany(Asset, { foreignKey: 'userId', as: 'assets' });
Asset.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Liability, { foreignKey: 'userId', as: 'liabilities' });
Liability.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Asset.hasMany(AssetValuation, { foreignKey: 'assetId', as: 'valuations' });
AssetValuation.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Liability.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

// Budget relations
User.hasMany(BudgetCategory,{foreignKey:'userId',as:'budgetCategories'});
BudgetCategory.belongsTo(User,{foreignKey:'userId',as:'user'});

User.hasMany(BudgetEntry,{foreignKey:'userId',as:'budgetEntries'});
BudgetEntry.belongsTo(User,{foreignKey:'userId',as:'user'});

BudgetCategory.hasMany(BudgetEntry,{foreignKey:'categoryId',as:'entries'});
BudgetEntry.belongsTo(BudgetCategory,{foreignKey:'categoryId',as:'category'});

// Income
User.hasMany(Income,{foreignKey:'userId',as:'incomes'});
Income.belongsTo(User,{foreignKey:'userId',as:'user'});

// Goals
User.hasMany(Goal,{foreignKey:'userId',as:'goals'});
Goal.belongsTo(User,{foreignKey:'userId',as:'user'});

// Sessions and emailed tokens
User.hasMany(Session,{foreignKey:'userId',as:'sessions',onDelete:'CASCADE'});
Session.belongsTo(User,{foreignKey:'userId',as:'user'});
User.hasMany(UserToken,{foreignKey:'userId',as:'tokens',onDelete:'CASCADE'});
UserToken.belongsTo(User,{foreignKey:'userId',as:'user'});

module.exports = {
  User,
  Session,
  UserToken,
  Investment,
  InvestmentHistory,
  PortfolioSnapshot,
  Asset,
  Liability,
  AssetValuation,
  BudgetCategory,
  BudgetEntry,
  Income,
  Goal,
  ExchangeRate,
}; 