import changeMessageCommand from './commands/user/changeMessage';

// src/commandsList.ts
export const commandsList = [
  { command: 'start', description: '启动机器人' },
  { command: 'help', description: '获取帮助信息' },
  { command: 'ban', description: '封禁用户（管理员专用）' },
  { command: 'changeMessage', description: '修改消息' },
  // 其他命令
];
