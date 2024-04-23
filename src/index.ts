import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

import { errorHandler, notFound } from './middlewares/errorMiddleware';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path'

import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import billRoutes from './routes/billRoutes';
import emptyPackageRoutes from './routes/emptyPackageRoutes';
import accountLibraryRoutes from './routes/accountLibraryRoutes';

import setupDB from "./utils/db";
import uploadRoutes from './routes/uploadRoutes';

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
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/empty-packages', emptyPackageRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/accounts', accountLibraryRoutes);

app.use('/api/static', express.static(path.join(__dirname, 'uploads')));

app.use(notFound);
app.use(errorHandler);

const PORT: string | number = process.env.PORT || 5000;
setupDB()

app.listen(PORT, () =>
  console.log(`
🚀 Server ready at: http://localhost:${PORT}`),
);