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

// 新增的路由
import recordRoutes from './routes/recordRoutes';
import topicRoutes from './routes/topicRoutes';
import answerRoutes from './routes/answerRoutes';
import proxyRoutes from './routes/proxyRoutes';
import employeeRoutes from './routes/employeeRoutes';
import instructionRoutes from './routes/instructionRoutes';

import withdrawRoutes from './routes/withdrawRoutes';
import instructionRoutes from './routes/instructionRoutes';

import http from 'http';
import { setupSocket } from './services/socket'; // 引入 socket 服务

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
app.use('/api/records', recordRoutes);

app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/permission-groups', permissionGroupRoutes);
app.use('/api/data-permissions', dataPermissionRoutes);
app.use('/api/answers', answerRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/proxies', proxyRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/instructions', instructionRoutes);

app.use('/api/withdraws', withdrawRoutes);

app.use('/api/instructions', instructionRoutes);

app.use('/api/static', express.static(path.join(__dirname, 'uploads')));

setupDB();
// setupRedis();
// 初始化 Socket.IO
setupSocket(server);
console.log('Socket.IO server initialized');

process.env.NODE_ENV === 'production';

app.use(notFound);
app.use(errorHandler);
// telegramClient();

const PORT: string | number = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server is running at http://localhost:${PORT}`),
);
