// src/menus/keyboards/mainKeyboard.ts
import { Keyboard } from 'grammy';

const mainKeyboard = new Keyboard()
  .text('帮助')
  .text('设置')
  .row()
  .text('关于我们');

export default mainKeyboard;
