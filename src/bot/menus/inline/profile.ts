// src/menus/inline/exampleInlineMenu.ts
import { InlineKeyboard } from 'grammy';

const profile = new InlineKeyboard()
  // .text('💰 立即充值', 'recharge:select')
  // .text('🔄 自助续费', 'auto_renew')
  // .text('📊 订阅历史', 'subscription_history')
  .row()
  .text('❌ Close', 'close')
  .text('📞 Contact Support', 'contact');

export default profile;
