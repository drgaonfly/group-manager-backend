import { Keyboard } from 'grammy';
import type { MyContext } from '../../types';
import { findBotProxy } from '../../services/findBotProxy';
import { PermissionChecker } from '../../utils/permissionChecker';

async function createMainKeyboard(ctx: MyContext) {
  const keyboard = new Keyboard();

  // 获取代理用户权限
  const { proxyUser } = await findBotProxy(ctx.currentBot);

  const isGroupChat =
    ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

  // 红包：私聊时显示
  if (!isGroupChat) {
    const frontendUrl = process.env.FRONTEND_URL;
    const botId = ctx.currentBot._id;
    const botUserId = ctx.currentBotUser?._id;

    const canRedPacket = PermissionChecker.canUseRedPacket(
      proxyUser,
      ctx.currentBot,
    );

    if (frontendUrl && botUserId && canRedPacket) {
      keyboard.row();
      if (canRedPacket) {
        const url = `${frontendUrl}/redpacket/create?botId=${botId}&botUserId=${botUserId}`;
        keyboard.webApp('🧧 发红包', url);
      }
    }
  }

  return keyboard.resized();
}

export default createMainKeyboard;
