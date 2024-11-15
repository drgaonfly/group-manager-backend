import { InlineKeyboard } from 'grammy';

export const mainMenu = new InlineKeyboard()
  .text('收集数据', 'collect')
  .text('注册', 'register')
  .row()
  .text('管理员', 'admin');
