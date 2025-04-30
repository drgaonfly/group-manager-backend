import { Server } from 'socket.io';
import Customer from '../../models/customer';
import { findCustomerUser } from '../../controllers/chatController';

// 更新客户在线状态和最后在线时间
const updateCustomerStatus = async (customerId: string, isOnline: boolean) => {
  return await Customer.findByIdAndUpdate(customerId, {
    isOn: isOnline,
    lastOnline: new Date(),
  });
};

// 处理客户加入房间
const handleCustomerJoin = async (customerId: string, io: Server) => {
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
    `客户 ${customerId} 加入房间, 最后在线时间: ${customer.lastOnline?.toLocaleString()}, 当前在线人数: ${io
      .engine?.clientsCount}`,
  );
};

// 处理客户离开房间
const handleCustomerLeave = async (customerId: string, io: Server) => {
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
    `客户 ${customerId} 离开房间, 最后在线时间: ${customer.lastOnline?.toLocaleString()}, 当前在线人数: ${io
      .engine?.clientsCount}`,
  );
};

export const setupCustomerHandlers = (socket: any, io: Server) => {
  if (socket.customer) {
    console.log(`客户连接: ${socket.id}, customerId: ${socket.customer._id}`);
    handleCustomerJoin(socket.customer._id, io);

    socket.on('disconnect', async () => {
      await handleCustomerLeave(socket.customer._id, io);
    });
  }
};
