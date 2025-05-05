import setupDB from '../utils/db';
import { checkIsOnline } from './cron/checkIsOnline';

const task = async () => {
  await setupDB();

  await checkIsOnline();
  process.exit(0);
};

task();
