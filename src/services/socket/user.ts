import { Server } from 'socket.io';
import User, { IUser } from '../../models/user';

// 更新用户在线状态和最后在线时间
const updateUserStatus = async (userId: string, isOnline: boolean) => {
  return await User.findByIdAndUpdate(userId, {
    isOn: isOnline,
    lastOnline: new Date(),
  });
};

// 处理用户加入房间
const handleUserJoin = async (user: IUser, io: Server) => {
  const updatedUser = await updateUserStatus(user._id.toString(), true);
  console.log(
    `用户 ${
      user._id
    } 加入房间, 最后在线时间: ${updatedUser.lastOnline?.toLocaleString()}, 当前在线人数: ${io
      .engine?.clientsCount}`,
  );
};

// 处理用户离开房间
const handleUserLeave = async (userId: string, io: Server) => {
  const user = await updateUserStatus(userId, false);
  console.log(
    `用户 ${userId} 离开房间, 最后在线时间: ${user.lastOnline?.toLocaleString()}, 当前在线人数: ${io
      .engine?.clientsCount}`,
  );
};

export const setupUserHandlers = (socket: any, io: Server) => {
  if (socket.user) {
    console.log(`用户连接: ${socket.id}, userId: ${socket.user._id}`);
    handleUserJoin(socket.user, io);

    socket.on('disconnect', async () => {
      await handleUserLeave(socket.user._id, io);
    });
  }
};
