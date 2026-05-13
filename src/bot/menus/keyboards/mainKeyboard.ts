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

  // 1. 自由键盘配置（在群组和私聊中都显示）
  if (
    PermissionChecker.canUseFreeKeyboard(proxyUser, ctx.currentBot) &&
    ctx.currentBot?.keyboards &&
    ctx.currentBot.keyboards.length > 0
  ) {
    keyboard.row();
    // ... 排序和分组逻辑 ...
    const sortedKeyboards = [...ctx.currentBot.keyboards].sort(
      (a, b) => (a.row || 1) - (b.row || 1),
    );

    const groupedByRow: { [key: number]: typeof sortedKeyboards } = {};
    sortedKeyboards.forEach((item) => {
      const rowNum = item.row || 1;
      if (!groupedByRow[rowNum]) {
        groupedByRow[rowNum] = [];
      }
      groupedByRow[rowNum].push(item);
    });

    Object.keys(groupedByRow)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((rowKey) => {
        const rowButtons = groupedByRow[Number(rowKey)];
        rowButtons.forEach((item) => {
          keyboard.text(item.label || item.command);
        });
        keyboard.row();
      });
  }

  // 2. 充值余额
  keyboard.text('充值余额');

  // 3. 其它功能模块（仅在私聊中显示）
  if (!isGroupChat) {
    // 教学模块按钮
    if (PermissionChecker.canUseTeaching(proxyUser, ctx.currentBot)) {
      keyboard.row();
      keyboard.text('注册老师').text('找老师').row();
      keyboard.text('写车评').text('我的车评').row();
    }
  }

  return keyboard.resized();
}

export default createMainKeyboard;
