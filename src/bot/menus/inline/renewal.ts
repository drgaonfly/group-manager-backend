// src/menus/inline/exampleInlineMenu.ts
import { InlineKeyboard } from 'grammy';

const renewal = new InlineKeyboard()
  .text('15天 (60U)', 'subscribe:biweekly')
  .row()
  .text('一个月 (100U)', 'subscribe:monthly')
  .row()
  .text('三个月 (230U)', 'subscribe:quarterly');

export default renewal;
