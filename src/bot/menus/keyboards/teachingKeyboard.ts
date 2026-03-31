// src/menus/keyboards/adminKeyboard.ts
import { Keyboard } from 'grammy';

const teachingKeyboard = new Keyboard()
  .text('注册成为老师')
  .text('找老师')
  .row()
  .text('写车评')
  .text('我的车评')
  .row();

teachingKeyboard.resized();

export default teachingKeyboard;
