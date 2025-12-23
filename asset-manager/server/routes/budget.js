const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { BudgetCategory, BudgetEntry } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// Get categories
router.get('/categories', async (req,res)=>{
  const cats = await BudgetCategory.findAll({where:{userId:req.user.id}, order:[['sortOrder','ASC']]});
  res.json({categories:cats});
});

// Create category
router.post('/categories',[body('name').notEmpty(),body('frameworkTag').isIn(['need','want','saving'])],async(req,res)=>{
  const errors = validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  const cat = await BudgetCategory.create({userId:req.user.id,name:req.body.name.trim(),frameworkTag:req.body.frameworkTag,sortOrder:req.body.sortOrder||0});
  res.status(201).json({category:cat});
});

// Update category
router.put('/categories/:id',[param('id').isUUID()],async(req,res)=>{
  const cat = await BudgetCategory.findOne({where:{id:req.params.id,userId:req.user.id}});
  if(!cat) return res.status(404).json({message:'Not found'});
  await cat.update(req.body);
  res.json({category:cat});
});

// Delete category
router.delete('/categories/:id',[param('id').isUUID()],async(req,res)=>{
  const cat = await BudgetCategory.findOne({where:{id:req.params.id,userId:req.user.id}});
  if(!cat) return res.status(404).json({message:'Not found'});
  await cat.destroy(); res.json({message:'Deleted'});
});

// Get budget entries for month
router.get('/entries', async(req,res)=>{
  const { month } = req.query; // YYYY-MM
  if(!month) return res.status(400).json({message:'month required'});
  const entries = await BudgetEntry.findAll({where:{userId:req.user.id,month:`${month}-01`}});
  res.json({entries});
});

// Upsert entry
router.post('/entries',[
  body('categoryId').isUUID(),body('month').isISO8601(),body('budgetedAmount').isFloat({min:0})],async(req,res)=>{
  const errors = validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  const { categoryId, month, budgetedAmount } = req.body;
  const { spentAmount } = req.body;
  const [entry] = await BudgetEntry.findOrCreate({where:{userId:req.user.id,categoryId,month},defaults:{budgetedAmount,spentAmount:spentAmount||0}});
  await entry.update({budgetedAmount, ...(spentAmount!==undefined?{spentAmount}: {})});
  res.json({entry});
});

module.exports = router; 