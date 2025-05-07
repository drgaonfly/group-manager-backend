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

export default setupDB;
