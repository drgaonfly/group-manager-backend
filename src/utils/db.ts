import dotenv from 'dotenv';
import mongoose, { ConnectOptions } from 'mongoose';

dotenv.config();

const setupDB = async (): Promise<void | null> => {
  console.log('尝试初始化数据库连接...');

  if (mongoose.connection.readyState === 1) {
    // 1 = connected
    console.log('MongoDB 已经连接');
    return;
  }

  try {
    // Connect to MongoDB
    // 如果你正在使用Mongoose 6.x或更高版本，简单地移除
    // mongoose.set('useCreateIndex', true);

    const options: ConnectOptions = {
      // useNewUrlParser: true,
      // useUnifiedTopology: true,
    };

    if (
      process.env.NODE_ENV === 'development' &&
      process.env.MONGODB_PROXYPORT
    ) {
      options.proxyHost = '127.0.0.1';
      options.proxyPort = Number(process.env.MONGODB_PROXYPORT);
    }

    // 打印数据库连接字符串
    console.log('MongoDB URL:', process.env.MONGODB_URL);

    await mongoose.connect(process.env.MONGODB_URL, options);
    // isConnected = true;
    console.log('MongoDB Connected');
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};

const closeDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    try {
      await mongoose.connection.close();
      console.log('MongoDB 连接已关闭');
    } catch (error) {
      console.error('关闭 MongoDB 连接时出错:', error);
    }
  }
};

// 监听进程退出信号，优雅关闭数据库连接
process.on('SIGINT', async () => {
  console.log('收到 SIGINT 信号，正在关闭数据库连接...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('收到 SIGTERM 信号，正在关闭数据库连接...');
  await closeDB();
  process.exit(0);
});

export default setupDB;
export { closeDB };
