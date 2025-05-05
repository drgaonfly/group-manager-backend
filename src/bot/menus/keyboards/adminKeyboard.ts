// src/menus/keyboards/adminKeyboard.ts
import { Keyboard } from 'grammy';

const adminKeyboard = new Keyboard()
  .text('封禁用户')
  .text('查看日志')
  .row()
  .text('重启机器人');

export default adminKeyboard;
