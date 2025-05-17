import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

import { errorHandler, notFound } from './middlewares/errorMiddleware';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import http from 'http';
import { setupRedis } from './utils/redis';
import setupDB from './utils/db';
import initExecutor from 'express-command-executor';

import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import authRoutes from './routes/authRoutes';
import menuRoutes from './routes/menuRoutes';
import permissionRoutes from './routes/permissionRoutes';
import permissionGroupRoutes from './routes/permissionGroupRoutes';
import uploadRoutes from './routes/uploadRoutes';
import dataPermissionRoutes from './routes/dataPermissionRoutes';
import proxyRoutes from './routes/proxyRoutes';
import employeeRoutes from './routes/employeeRoutes';
import customerRoutes from './routes/customerRoutes';
import botRoutes from './routes/botRoutes';
import botUserRoutes from './routes/botUserRoutes';
import transactionRoutes from './routes/transactionRoutes';
import botWebhooksRoutes from './routes/botWebhooksRoutes';
import groupRoutes from './routes/groupRoutes';

dotenv.config();

const app: Express = express();
const server = http.createServer(app);

app.use(cors());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('API is running...ok');
});

initExecutor(app);

// 使用新路由
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/permission-groups', permissionGroupRoutes);
app.use('/api/data-permissions', dataPermissionRoutes);
app.use('/api/proxies', proxyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bots', botRoutes);
app.use('/api/bot-users', botUserRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/bot-webhooks', botWebhooksRoutes);
app.use('/api/groups', groupRoutes);

app.use('/api/static', express.static(path.join(__dirname, 'uploads')));

setupDB();
setupRedis();
// 初始化 Socket.IO

console.log('Socket.IO server initialized');

// scheduledtasks(); // 定时任务
// authorized(); // 授权用户收益率生成
// stacking(); // 质押用户收益率生成

// process.env.NODE_ENV === 'production' && startWebHookBot();

app.use(notFound);
app.use(errorHandler);
// telegramClient();

const PORT: string | number = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running at http://localhost:${PORT}`),
);
