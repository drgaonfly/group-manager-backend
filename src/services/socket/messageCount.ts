import { SocketCustom } from 'socket';
import { Server } from 'socket.io';
import Chat from '../../models/chat';

export const messageCountUpdatedHandler = (
  socket: SocketCustom,
  io: Server,
) => {
  // 后台读取了客户消息或客户读取了消息
  socket.on('getUnreadMessageCount', async (data: any) => {
    try {
      const user = socket.user;

      // 查询未读消息数量
      const unreadCount = await Chat.countDocuments({
        user: user._id,
        isRead: false,
        isSoftDeleted: false,
        sender: 'customer',
      });

      // 打印未读消息数量
      console.log(`用户 ${user._id} 的未读消息数量:`, unreadCount);

      // 发送未读消息数量给客户端
      io.emit('unreadMessageCountUpdated', { count: unreadCount });
    } catch (error) {
      console.error('获取未读消息数量时发生错误:', error);
    }
  });
};
