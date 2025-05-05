// src/menus/inline/exampleInlineMenu.ts
import { InlineKeyboard } from 'grammy';

const exampleInlineMenu = new InlineKeyboard()
  // .text('按钮1', 'button1_callback')
  // .text('按钮2', 'button2_callback')
  // .row()
  .url('解除异常状态限制', 'https://spam.2024fc.xyz/')
  .row()
  .url('解除双向对话限制', 'https://spam.2024fc.xyz/');

export default exampleInlineMenu;
