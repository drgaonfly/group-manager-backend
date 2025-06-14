import { Keyboard } from 'grammy';

const mainKeyboard = new Keyboard()
  .text('▶️ 开始记账')
  .text('🆓 免费克隆')
  .row()
  .text('💱 TRX 兑换')
  .text('🏦 地址监听')
  .row()
  .text('💬 联系客服')
  .text('👤 个人信息')
  .resized();

export default mainKeyboard;
