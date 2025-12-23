const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Income } = require('../models');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// list incomes
router.get('/', async (req,res)=>{
  const list = await Income.findAll({where:{userId:req.user.id}, order:[['nextPayDate','ASC']]});
  res.json({incomes:list});
});

// create income
router.post('/',[
  body('name').notEmpty(),
  body('amount').isFloat({min:0}),
  body('frequency').isIn(['once','weekly','biweekly','monthly']),
  body('nextPayDate').isISO8601(),
],async(req,res)=>{
  const errors = validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
  const inc = await Income.create({...req.body,userId:req.user.id});
  res.status(201).json({income:inc});
});

// update
router.put('/:id',[param('id').isUUID()],async(req,res)=>{
  const inc = await Income.findOne({where:{id:req.params.id,userId:req.user.id}});
  if(!inc) return res.status(404).json({message:'Not found'});
  await inc.update(req.body);
  res.json({income:inc});
});

// delete
router.delete('/:id',[param('id').isUUID()],async(req,res)=>{
  const inc = await Income.findOne({where:{id:req.params.id,userId:req.user.id}});
  if(!inc) return res.status(404).json({message:'Not found'});
  await inc.destroy(); res.json({message:'Deleted'});
});

module.exports = router; 