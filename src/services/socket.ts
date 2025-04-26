import { Server } from 'socket.io';
import http from 'http';
import User from '../models/user';
import Customer from '../models/customer';

let io: Server;

export const setupSocket = async (server: http.Server): Promise<Server> => {
  io = new Server(server);

  io.on('connection', async (socket: any) => {
    const token = socket.handshake.auth.token;

    console.log(`用户连接: ${socket.id}, token: ${token}`);

    const userId = socket.handshake.query.userId as string;

    console.log(`用户连接: ${socket.id}, userId: ${userId}`);
    // 后台用户加入房间
    if (userId !== undefined) {
      socket.join(`user-${userId}`);
      const user = await User.findByIdAndUpdate(userId, {
        isOn: true,
        lastOnline: new Date(),
      });
      console.log(
        `客户 ${userId} 加入房间, 最后在线时间: ${new Date().toLocaleString()}, 当前在线人数: ${
          io.engine.clientsCount
        }`,
      );
    }

    const customerId = socket.handshake.query.customerId as string;
    console.log(`客户连接: ${socket.id}, customerId: ${customerId}`);
    // 前端客户加入房间
    if (customerId !== undefined) {
      socket.join(`customer-${customerId}`);
      const customer = await Customer.findByIdAndUpdate(customerId, {
        isOn: true,
        lastOnline: new Date(),
      });
      console.log(
        `客户 ${customerId} 加入房间, 最后在线时间: ${new Date().toLocaleString()}, 当前在线人数: ${
          io.engine.clientsCount
        }`,
      );
    }

    socket.on('disconnect', async () => {
      console.log('客户端断开连接');
      if (userId !== undefined) {
        socket.leave(`user-${userId}`);
        await User.findByIdAndUpdate(userId, {
          isOn: false,
          lastOnline: new Date(),
        });
      }

      if (customerId !== undefined) {
        socket.leave(`customer-${customerId}`);
        await Customer.findByIdAndUpdate(customerId, {
          isOn: false,
          lastOnline: new Date(),
        });
      }
    });
  });

  return io;
};

export const getSocketIO = (): Server => {
  return io;
};

export { io };
