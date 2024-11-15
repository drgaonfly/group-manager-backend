import { InlineKeyboard } from 'grammy';

export const adminMenu = new InlineKeyboard()
  .text('封禁用户', 'admin_ban')
  .text('提升用户权限', 'admin_promote')
  .row()
  .text('返回主菜单', 'main_menu');
