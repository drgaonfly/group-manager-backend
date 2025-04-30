import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import User from '../../models/user';
import Customer from '../../models/customer';
// 导入用户处理程序
import { setupUserHandlers } from './user';
import { setupCustomerHandlers } from './customer';
import { setupHeartbeatHandlers } from './heartbeat';
import { setupMessageHandlers } from './message';

let io: Server;

export const setupSocket = async (server: http.Server): Promise<Server> => {
  io = new Server(server);

  // 添加认证中间件
  io.use(async (socket: any, next) => {
    let token = socket.handshake.auth.token;

    if (!token || token === 'undefined') {
      return;
    }

    if (token && token.startsWith('Bearer ')) {
      token = token.split(' ')[1];
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET as string,
      ) as jwt.JwtPayload & { type: 'user' | 'customer' };
    } catch (error) {
      // JWT验证失败
      console.error('JWT验证失败:', error);
      return;
    }

    if (decoded?.type === 'user') {
      const user = await User.findById(decoded.sub).exec();

      if (!user || !user.live) {
        return;
      }

      socket.user = user;
    } else if (decoded?.type === 'customer') {
      const customer = await Customer.findById(decoded.sub);
      if (!customer) {
        return;
      }
      socket.customer = customer;
    }

    next();
  });

  io.on('connection', async (socket: any) => {
    console.log(`连接: ${socket.id} ${socket.handshake.auth.token}`);

    // 设置各个模块的处理器
    setupUserHandlers(socket, io);
    setupCustomerHandlers(socket, io);
    setupHeartbeatHandlers(socket);
    setupMessageHandlers(socket, io);

    socket.on('disconnect', () => {
      console.log(`客户端断开连接: ${socket.id}`);
    });
  });

  return io;
};

export const getSocketIO = (): Server => {
  return io;
};

export { io };
