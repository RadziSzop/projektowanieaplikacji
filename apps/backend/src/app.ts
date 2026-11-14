import express from 'express';
import { validateRequest } from './middleware/validate.js';
import { createOrderSchema } from './schemas/order.schema.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/api/orders', validateRequest(createOrderSchema), (req, res) => {
  res.status(201).json({ status: 'success', message: 'Zamówienie przyjęte do realizacji' });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});
