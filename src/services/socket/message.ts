import { Server, Socket } from 'socket.io';
import { updateMessagesToRead } from '../../controllers/chatController';

export const setupMessageHandlers = (socket: Socket, io: Server) => {
  // 后台读取了客户消息或客户读取了消息
  socket.on('mark-read', async (data: any) => {
    try {
      const { customerId, userId, sender } = data;
      // 如果customerId或userId为空则直接返回
      if (!customerId || !userId) {
        return;
      }
      await updateMessagesToRead(customerId, userId, 'customer');
      io.emit('chatMessageRead', {
        customerId,
        userId,
        sender,
      });
      console.log(`后台读取了客户消息或客户读取了消息: ${socket.id}`);
    } catch (error) {
      console.error('Error updating messages to read:', error);
    }
  });
};
