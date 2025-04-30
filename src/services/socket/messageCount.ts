import { SocketCustom } from 'socket';
import { Server } from 'socket.io';
import Chat from '../../models/chat';

export const messageCountUpdatedHandler = (
  socket: SocketCustom,
  io: Server,
) => {
  // 后台读取了客户消息或客户读取了消息
  socket.on('getUnreadMessageCount', async () => {
    try {
      let unreadCount = 0;
      const user = socket.user;
      const customer = socket.customer;

      if (user) {
        // 查询未读消息数量
        unreadCount = await Chat.countDocuments({
          user: user._id,
          isRead: false,
          isSoftDeleted: false,
          sender: 'customer',
        });
        console.log(`用户 ${user._id} 的未读消息数量:`, unreadCount);
      }

      if (customer) {
        // 查询未读消息数量
        unreadCount = await Chat.countDocuments({
          customer: customer._id,
          isRead: false,
          isSoftDeleted: false,
          sender: 'user',
        });
        console.log(`客户 ${customer._id} 的未读消息数量:`, unreadCount);
      }

      // 发送未读消息数量给客户端
      io.emit('unreadMessageCountUpdated', { count: unreadCount });
    } catch (error) {
      console.error('获取未读消息数量时发生错误:', error);
    }
  });
};
