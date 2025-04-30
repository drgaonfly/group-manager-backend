import { Socket } from 'socket.io';
import { setupUserHandlers } from './user';
import { setupCustomerHandlers } from './customer';

export const setupHeartbeatHandlers = (socket: any) => {
  // 心跳检测
  const heartbeatInterval = setInterval(() => {
    socket.emit('ping', Date.now());
  }, 30000); // 每30秒发送心跳

  socket.on('pong', async (timestamp: number) => {
    const latency = Date.now() - timestamp;
    if (socket.customer) {
      console.log(`客户端延迟: ${latency}ms`);
      setupCustomerHandlers(socket, socket.nsp);
    }
    if (socket.user) {
      console.log(`后端端延迟: ${latency}ms`);
      setupUserHandlers(socket, socket.nsp);
    }
  });

  socket.on('disconnect', () => {
    clearInterval(heartbeatInterval);
  });
};
