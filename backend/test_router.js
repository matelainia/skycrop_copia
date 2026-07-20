import { evaluationRouter } from './src/modules/evaluation/infrastructure/adapters/inbound/ExpressEvaluationRouter.js';
console.log('Router:', evaluationRouter);
console.log('Stack:', evaluationRouter.stack.map(s => s.route ? s.route.path : s.name));
