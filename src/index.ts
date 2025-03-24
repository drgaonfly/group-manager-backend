import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

import { errorHandler, notFound } from './middlewares/errorMiddleware';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';

import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import authRoutes from './routes/authRoutes';
import menuRoutes from './routes/menuRoutes';
import permissionRoutes from './routes/permissionRoutes';
import permissionGroupRoutes from './routes/permissionGroupRoutes';
import setupDB from './utils/db';
// import telegramClient from './utils/telegramClient';
import uploadRoutes from './routes/uploadRoutes';
import dataPermissionRoutes from './routes/dataPermissionRoutes';
import proxyRoutes from './routes/proxyRoutes';
import employeeRoutes from './routes/employeeRoutes';
import noticeRoutes from './routes/noticeRoutes'; // 新增
import incomeRoutes from './routes/incomeRoutes'; // 新增
import activityRoutes from './routes/activityRoutes'; // 新增
import miningDataRoutes from './routes/miningDataRoutes'; // 新增
import stackingRoutes from './routes/stackingRoutes';
import translateRoutes from './routes/translateRoutes';
import miningOutputRoutes from './routes/miningOutputRoutes'; // 新增
import customerAuthRoutes from './routes/customerAuthRoutes'; // 新增
import walletShareRoutes from './routes/walletShareRoutes'; // 新增
import liquidityRoutes from './routes/liquidityRoutes'; // 新增
// 新增的路由

import http from 'http';
import { setupSocket } from './services/socket'; // 引入 socket 服务
import withdrawRoutes from './routes/withdrawRoutes';
// import instructionRoutes from './routes/instructionRoutes';
import customerRoutes from './routes/customerRoutes';
import walletRoutes from './routes/walletRoutes';
// import transactionRoutes from './routes/transactionRoutes';
import carouselRoutes from './routes/carouselRoutes';
import lotteryRecordRoutes from './routes/lotteryRecordRoutes';
import proxyCommissionRecordRoutes from './routes/proxyCommissionRecordRoutes';
import walletDealRecordRoutes from './routes/walletDealRecordRoutes';
import langueRoutes from './routes/langueRoutes';
import questionRoutes from './routes/questionRoutes';
import releaseRecordRoutes from './routes/releaseRecordRoutes';
import exchangeRoutes from './routes/exchangeRoutes';
import transferRoutes from './routes/transferRoutes';
import partnershipRoutes from './routes/partnershipRoutes';
import regulationAgencyRoutes from './routes/regulationAgencyRoutes';
import settingRoutes from './routes/settingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { scheduledtasks } from './tasks';
import { authorized } from './tasks/authorized';
import recordRoutes from './routes/recordRoutes';
import videoRoutes from './routes/videoRoutes';

// import { startWebHookBot } from './bot';
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
app.use('/api/withdraws', withdrawRoutes);
// app.use('/api/instructions', instructionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/wallets', walletRoutes);
// app.use('/api/transactions', transactionRoutes);
app.use('/api/notices', noticeRoutes); // 新增
app.use('/api/incomes', incomeRoutes); // 新增
app.use('/api/activities', activityRoutes); // 新增
app.use('/api/carousels', carouselRoutes); // 新增
app.use('/api/stackings', stackingRoutes);
app.use('/api/lottery-records', lotteryRecordRoutes);
app.use('/api/proxy-commission-records', proxyCommissionRecordRoutes);
app.use('/api/wallet-deal-records', walletDealRecordRoutes);
app.use('/api/langues', langueRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/release-records', releaseRecordRoutes);
app.use('/api/translates', translateRoutes);
app.use('/api/static', express.static(path.join(__dirname, 'uploads')));
app.use('/api/transfers', transferRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/mining-data', miningDataRoutes);
app.use('/api/partnerships', partnershipRoutes);
app.use('/api/mining-outputs', miningOutputRoutes);
app.use('/api/regulation-agencies', regulationAgencyRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customer-auth', customerAuthRoutes);
app.use('/api/wallet-shares', walletShareRoutes);
app.use('/api/liquidity', liquidityRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/videos', videoRoutes);
setupDB();
// setupRedis();
// 初始化 Socket.IO
setupSocket(server);
console.log('Socket.IO server initialized');

scheduledtasks(); // 定时任务
authorized(); // 授权用户收益率生成

process.env.NODE_ENV === 'production';

app.use(notFound);
app.use(errorHandler);
// telegramClient();

const PORT: string | number = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running at http://localhost:${PORT}`),
);
