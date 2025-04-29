import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user';
import Customer from '../models/customer';
import { findCustomerUser } from '../controllers/chatController';

let io: Server;

// 更新用户在线状态和最后在线时间
const updateUserStatus = async (userId: string, isOnline: boolean) => {
  return await User.findByIdAndUpdate(userId, {
    isOn: isOnline,
    lastOnline: new Date(),
  });
};

// 更新客户在线状态和最后在线时间
const updateCustomerStatus = async (customerId: string, isOnline: boolean) => {
  return await Customer.findByIdAndUpdate(customerId, {
    isOn: isOnline,
    lastOnline: new Date(),
  });
};

// 处理用户加入房间
const handleUserJoin = async (user: IUser) => {
  const updatedUser = await updateUserStatus(user._id.toString(), true);
  console.log(
    `用户 ${
      user._id
    } 加入房间, 最后在线时间: ${updatedUser.lastOnline?.toLocaleString()}, 当前在线人数: ${
      io.engine.clientsCount
    }`,
  );
};

// 处理客户加入房间
const handleCustomerJoin = async (customerId: string) => {
  const customer = await updateCustomerStatus(customerId, true);
  const user = await findCustomerUser(customer);

  // 通知对应的用户客户上线
  if (user) {
    io.emit('customer_status', {
      customerId,
      isOn: true,
      lastOnline: new Date(),
    });
  }

  console.log(
    `客户 ${customerId} 加入房间, 最后在线时间: ${customer.lastOnline?.toLocaleString()}, 当前在线人数: ${
      io.engine.clientsCount
    }`,
  );
};

// 处理用户离开房间
const handleUserLeave = async (userId: string) => {
  const user = await updateUserStatus(userId, false);
  console.log(
    `用户 ${userId} 离开房间, 最后在线时间: ${user.lastOnline?.toLocaleString()}, 当前在线人数: ${
      io.engine.clientsCount
    }`,
  );
};

// 处理客户离开房间
const handleCustomerLeave = async (customerId: string) => {
  const customer = await updateCustomerStatus(customerId, false);
  const user = await findCustomerUser(customer);

  // 通知对应的用户客户下线
  if (user) {
    io.emit('customer_status', {
      customerId,
      isOn: false,
      lastOnline: new Date(),
    });
  }

  console.log(
    `客户 ${customerId} 离开房间, 最后在线时间: ${customer.lastOnline?.toLocaleString()}, 当前在线人数: ${
      io.engine.clientsCount
    }`,
  );
};

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
    // socket.handshake.address
    console.log(`连接: ${socket.id} ${socket.handshake.auth.token}`);

    if (socket.user) {
      console.log(`用户连接: ${socket.id}, userId: ${socket.user._id}`);
      await handleUserJoin(socket.user);
    }

    if (socket.customer) {
      console.log(`客户连接: ${socket.id}, customerId: ${socket.customer._id}`);
      await handleCustomerJoin(socket.customer._id);
    }

    // 心跳检测
    const heartbeatInterval = setInterval(() => {
      socket.emit('ping', Date.now());
    }, 30000); // 每30秒发送心跳

    socket.on('pong', async (timestamp: number) => {
      const latency = Date.now() - timestamp;
      if (socket.customer) {
        console.log(`客户端延迟: ${latency}ms`);
        await handleCustomerJoin(socket.customer._id);
      }
      if (socket.user) {
        console.log(`后端端延迟: ${latency}ms`);
        await handleUserJoin(socket.user);
      }
    });

    socket.on('user-message-read', async (data: any) => {
      const { customerId, userId } = data;
      io.emit('chatMessageRead', {
        customerId,
        userId,
        sender: 'user',
      });
      console.log(`客户 ${userId} 已读消息来自用户 ${customerId}`);
    });

    // 后台读取了客户消息
    socket.on('customer-message-read', async (data: any) => {
      const { customerId, userId } = data;
      console.log(`用户 ${userId} 已读消息来自客户 ${customerId}`);
      io.emit('chatMessageRead', {
        customerId,
        userId,
        sender: 'customer',
      });
    });

    socket.on('disconnect', async () => {
      console.log(`客户端断开连接: ${socket.id}`);

      clearInterval(heartbeatInterval);

      if (socket.user) {
        await handleUserLeave(socket.user._id);
      }
      if (socket.customer) {
        await handleCustomerLeave(socket.customer._id);
      }
    });
  });

  return io;
};

export const getSocketIO = (): Server => {
  return io;
};

export { io };
