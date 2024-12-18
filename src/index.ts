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
import customerRoutes from './routes/customerRoutes';
import telegramsRoutes from './routes/telegramsRoutes';
import messagesRoutes from './routes/messagesRoutes';
import employeeRoutes from './routes/employeeRoutes';
import tgRoutes from './routes/tgRoutes';

import setupDB from './utils/db';
import telegramClient from './utils/telegramClient';
import uploadRoutes from './routes/uploadRoutes';
import dataPermissionRoutes from './routes/dataPermissionRoutes';
import telegramRoutes from './routes/telegramRoutes';
import proxyRoutes from './routes/proxysRoutes';
import telegramUsaerRoutes from './routes/telegramUserRoutes';
import spamRoutes from './routes/spamRoutes';

dotenv.config();

const app: Express = express();

app.use(cors());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('API is running...ok');
});

app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/permission-groups', permissionGroupRoutes);
app.use('/api/data-permissions', dataPermissionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/telegrams', telegramRoutes);
app.use('/api/proxys', proxyRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/tg', tgRoutes);

app.use('/api/two-telegrams', telegramsRoutes);
app.use('/api/telegram-users', telegramUsaerRoutes);
app.use('/api/spam', spamRoutes);

app.use('/api/static', express.static(path.join(__dirname, 'uploads')));

app.use(notFound);
app.use(errorHandler);

const PORT: string | number = process.env.PORT || 5000;
setupDB();
telegramClient();

app.listen(PORT, () =>
  console.log(`
🚀 Server ready at: http://localhost:${PORT}`),
);
