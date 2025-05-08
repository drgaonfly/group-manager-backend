// src/menus/inline/exampleInlineMenu.ts
import { InlineKeyboard } from 'grammy';

const bill = new InlineKeyboard()
  .text('按钮1', 'button1_callback')
  .text('按钮2', 'button2_callback')
  .row();

export default bill;
