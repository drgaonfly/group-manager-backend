import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

import { errorHandler, notFound } from './middlewares/errorMiddleware';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path'

import userRoutes from './routes/userRoutes';
import roleRoutes from './routes/roleRoutes';
import authRoutes from './routes/authRoutes';
import menuRoutes from './routes/menuRoutes';
import permissionRoutes from './routes/permissionRoutes';
import permissionGroupRoutes from './routes/permissionGroupRoutes';

import setupDB from "./utils/db";
import uploadRoutes from './routes/uploadRoutes';
import dataPermissionRoutes from './routes/dataPermissionRoutes';


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
app.use('/api/permissions',permissionRoutes);
app.use('/api/permission-groups',permissionGroupRoutes);
app.use('/api/data-permissions',dataPermissionRoutes);


app.use('/api/static', express.static(path.join(__dirname, 'uploads')));

app.use(notFound);
app.use(errorHandler);

const PORT: string | number = process.env.PORT || 5000;
setupDB()

app.listen(PORT, () =>
  console.log(`
🚀 Server ready at: http://localhost:${PORT}`),
);