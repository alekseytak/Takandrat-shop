
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { paymentRouter } from './routes/paymentsRouter';
import { adminRouter } from './routes/adminRouter';

// Заглушки для роутов, которые еще не реализованы, чтобы сервер запускался
const productRouter = express.Router();
productRouter.get('/', (req, res) => res.json({ msg: 'Products API' }));
const orderRouter = express.Router(); // Можно заменить на полноценный, если есть
// ...

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}) as any);
app.use(express.json() as any);

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ROUTES
app.use('/api/products', productRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/admin', adminRouter);

// ERROR HANDLER
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
