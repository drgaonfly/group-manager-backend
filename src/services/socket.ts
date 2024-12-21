import { Server } from 'socket.io';
import http from 'http';

let io: Server;

export async function setupSocket(server: http.Server) {
  io = new Server(server);

  io.on('connection', async (socket: any) => {
    console.log('新客户端连接');

    // // 初始化未处理任务数量
    // await updateTodoCount(socket);

    // // 初始化未激活订单数量
    // await updateInactiveOrderCount(socket);

    // // 监听任务状态变更
    // socket.on('todoStatusChanged', async () => {
    //   await updateTodoCount(io);
    // });

    // // 监听订单状态变更
    // socket.on('orderStatusChanged', async () => {
    //   console.log('orderStatusChanged event triggered');
    //   await updateInactiveOrderCount(io);
    // });
    // 监听新用户添加事件
    socket.on('newCustomerAdded', (data: any) => {
      console.log('New customer added:', data);
      io.emit('newCustomerAdded', data); // 确保事件被广播到所有客户端
    });

    socket.on('disconnect', () => {
      console.log('客户端断开连接');
    });

    // 日志记录
    socket.on('todoListUpdated', (data: any) => {
      console.log('Received todoListUpdated event:', data);
    });

    socket.on('inactiveOrdersUpdated', (data: any) => {
      console.log('Received inactiveOrdersUpdated event:', data);
    });
  });

  return io;
}

// // 通用更新方法
// async function updateTodoCount(target: Server | any) {
//   try {
//     const count = await TodoList.countDocuments({ type: 'unprocessed' });
//     console.log('Unprocessed count from database:', count);
//     target.emit('todoListUpdated', { type: 'unprocessed', count });
//   } catch (error) {
//     console.error('Error fetching todo count:', error);
//   }
// }

// async function updateInactiveOrderCount(target: Server | any) {
//   try {
//     const inactiveCount = await Order.countDocuments({
//       accountStatus: 'inactive',
//       status: { $nin: ['active', 'unpaid'] },
//     });
//     console.log('Inactive count from database:', inactiveCount);
//     target.emit('inactiveOrdersUpdated', {
//       accountStatus: 'inactive',
//       count: inactiveCount,
//     });
//   } catch (error) {
//     console.error('Error fetching inactive count:', error);
//   }
// }

export { io };
