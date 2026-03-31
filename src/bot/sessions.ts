// src/sessions.ts
import { session } from 'grammy';
import { MyContext } from './types';

// 定义会话数据结构
export interface SessionData {
  step:
    | 'none'
    | 'collect'
    | 'register_name'
    | 'register_email'
    | 'admin_action';
  registration?: {
    name?: string;
    email?: string;
  };
  admin?: {
    targetUserId?: number;
  };
  lastTeacherMenuId?: number;
}

// 定义初始会话状态
function initial(): SessionData {
  return { step: 'none' };
}

// 创建会话中间件
export const sessionMiddleware = session<SessionData, MyContext>({
  initial,
  storage: {
    read: async (key) => {
      const value = new Map().get(key);
      return value ? JSON.parse(value) : undefined;
    },
    write: async (key, value) => {
      new Map().set(key, JSON.stringify(value));
    },
    delete: async (key) => {
      new Map().delete(key);
    },
  }, // 简单的内存存储，适合开发。生产环境建议使用持久化存储，如 Redis。
});
