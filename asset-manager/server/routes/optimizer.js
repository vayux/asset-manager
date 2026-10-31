const express = require('express');
const { query } = require('express-validator');
const { Asset, Liability, Investment, Income, BudgetEntry } = require('../models');
const authMiddleware = require('../middleware/auth');
const { handleValidation, MONTH_REGEX } = require('../middleware/validate');
const { Op } = require('sequelize');

const router = express.Router();
router.use(authMiddleware);

const validateMonth = [query('month').optional().matches(MONTH_REGEX).withMessage('month must be YYYY-MM'), handleValidation];

// At top after imports
const healthCache = new Map();

// Financial Health Score
router.get('/health', validateMonth, async (req,res)=>{
  const userId = req.user.id;
  const month = req.query.month || new Date().toISOString().slice(0,7); // YYYY-MM
  const cacheKey = `${userId}-${month}`;
  const cached = healthCache.get(cacheKey);
  if(cached && (Date.now() - cached.timestamp < 300000)) {
    return res.json(cached.data);
  }
  try {
    // Month range for investments
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon-1, 1));
    const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

    // Assets & liabilities
    const [assetsSum, liabilitiesSum, investmentsSum] = await Promise.all([
      Asset.sum('currentValue',{where:{userId}}),
      Liability.sum('outstandingAmount',{where:{userId}}),
      Investment.sum('currentAmount',{where:{userId, investmentDate:{[Op.between]:[start,end]}}}),
    ]);

    const totalAssets = parseFloat((assetsSum||0)) + parseFloat((investmentsSum||0));
    const totalLiabilities = parseFloat(liabilitiesSum||0);
    const netWorth = totalAssets - totalLiabilities;
    const debtRatio = totalAssets>0? totalLiabilities / totalAssets : 1; // 0 good, 1 bad

    // Income / spending for month
    const incomes = await Income.sum('amount',{where:{userId}});
    const spent = await BudgetEntry.sum('spentAmount',{where:{userId, month:`${month}-01`}});
    const totalIncome = parseFloat(incomes||0);
    const totalSpent = parseFloat(spent||0);
    const savingsRate = totalIncome>0 ? Math.max(0,(totalIncome - totalSpent))/totalIncome : 0; // 0 to 1

    // Diversification (HHI) and Liquidity
    const invRows = await Investment.findAll({where:{userId, investmentDate:{[Op.between]:[start,end]}}});
    const totalInvValue = invRows.reduce((s,i)=>s+parseFloat(i.currentAmount||0),0);
    const categoryTotals = {};
    invRows.forEach(inv=>{
      categoryTotals[inv.category] = (categoryTotals[inv.category]||0)+parseFloat(inv.currentAmount||0);
    });
    const hhi = Object.values(categoryTotals).reduce((sum,amt)=>{
      const share = totalInvValue>0? amt/totalInvValue : 0;
      return sum + share*share;
    },0);
    const diversificationScore = Math.round((1 - hhi)*100); // higher better

    const liquidCats = ['bank_account','stocks','mutual_funds','crypto'];
    const liquidValue = invRows.filter(i=>liquidCats.includes(i.category)).reduce((s,i)=>s+parseFloat(i.currentAmount||0),0) + parseFloat(assetsSum||0);
    const liquidityRatio = totalAssets>0? liquidValue/totalAssets : 0;
    const liquidityScore = Math.round(Math.min(1, liquidityRatio)*100);

    // Composite score weighting (debt 35, savings 35, diversification 15, liquidity 15)
    let score = 0;
    score += (1 - Math.min(1,debtRatio))*35;
    score += Math.min(1,savingsRate)*35;
    score += diversificationScore*0.15;
    score += liquidityScore*0.15;
    score = Math.round(score);

    const result = {
      netWorth,
      totalAssets,
      totalLiabilities,
      debtRatio,
      totalIncome,
      totalSpent,
      savingsRate,
      diversificationScore,
      liquidityScore,
      score,
    };

    healthCache.set(cacheKey,{timestamp:Date.now(), data: result});

    res.json(result);
  } catch(e){
    console.error(e);
    res.status(500).json({message:'Failed to compute health'});
  }
});

// Tax loss harvesting suggestions
router.get('/tax-loss', [query('threshold').optional().isFloat({min:0,max:100}), handleValidation], async (req,res)=>{
  const userId = req.user.id;
  const threshold = parseFloat(req.query.threshold || 10); // percent decline
  try {
    const investments = await Investment.findAll({where:{userId, initialAmount:{[Op.ne]:null}}});
    const opportunities = investments.filter(inv=>{
      const current = parseFloat(inv.currentAmount||0);
      const initial = parseFloat(inv.initialAmount||0);
      if(initial<=0) return false;
      const decline = ((initial - current)/initial)*100;
      return decline >= threshold;
    }).map(inv=>({
      id: inv.id,
      name: inv.name,
      category: inv.category,
      initialAmount: inv.initialAmount,
      currentAmount: inv.currentAmount,
      declinePercent: (((inv.initialAmount - inv.currentAmount)/inv.initialAmount)*100).toFixed(2),
      potentialLoss: (inv.initialAmount - inv.currentAmount).toFixed(2),
    }));
    res.json({ opportunities });
  }catch(e){ console.error(e); res.status(500).json({message:'Failed'}); }
});

// Personalized recommendations based on budgets, goals and health
router.get('/recommendations', validateMonth, async (req,res)=>{
  const userId = req.user.id;
  const month = req.query.month || new Date().toISOString().slice(0,7);
  const recs = [];
  try {
    // Overspending check
    const overspent = await BudgetEntry.findAll({where:{userId, month:`${month}-01`}});
    overspent.forEach(e=>{
      if(parseFloat(e.spentAmount) > parseFloat(e.budgetedAmount)*1.1){
        recs.push(`You have overspent in a budget category by more than 10% (Category ID ${e.categoryId}). Consider reducing discretionary expenses.`);
      }
    });

    // Goals check
    const goals = await require('../models').Goal.findAll({where:{userId}});
    const today = new Date();
    goals.forEach(g=>{
      const months = Math.max(1, Math.round((new Date(g.targetDate) - today)/(30*24*60*60*1000)));
      const projected = parseFloat(g.currentAmount||0) + months*parseFloat(g.monthlyContribution||0);
      if(projected < g.targetAmount){
        const need = ((g.targetAmount - projected)/months).toFixed(0);
        recs.push(`Goal "${g.name}" is off track. Increase monthly contribution by about ₹${need} to hit the target.`);
      }
    });

    res.json({ recommendations: recs });
  }catch(err){ console.error(err); res.status(500).json({message:'Failed to build recommendations'}); }
});

module.exports = router; 