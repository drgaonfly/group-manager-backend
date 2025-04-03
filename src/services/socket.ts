import { Server } from 'socket.io';
import http from 'http';

let io: Server;

export const setupSocket = async (server: http.Server): Promise<Server> => {
  io = new Server(server);

  io.on('connection', async (socket: any) => {
    console.log('新客户端连接');

    socket.on('disconnect', () => {
      console.log('客户端断开连接');
    });
  });

  return io;
};

export const getSocketIO = (): Server => {
  return io;
};

export { io };
