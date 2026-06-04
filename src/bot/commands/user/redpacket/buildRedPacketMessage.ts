import RedPacketClaim from '../../../../models/redPacketClaim';

/**
 * 构建红包群消息文本（HTML）
 * 每次有人领取后调用，实时更新消息内容
 */
export async function buildRedPacketMessage(
  redPacket: any,
  creatorName: string,
): Promise<string> {
  const claims = await RedPacketClaim.find({ redPacket: redPacket._id })
    .sort('createdAt')
    .populate('botUser', 'userName firstName lastName')
    .lean();

  const hasBombs = redPacket.bombNumbers?.length > 0;
  const isFinished = redPacket.status !== 'active';

  // ── 头部 ──────────────────────────────────────────────────────
  const lines: string[] = [
    `<b>${creatorName} 发送了一个扫雷红包</b>`,
    ``,
    `🧧 红包金额：<b>${redPacket.totalPoints}.00 积分</b>`,
    `💰 红包倍数：<b>${redPacket.bombMultiplier}</b>`,
    hasBombs
      ? `💥 炸弹数字：<b>${(redPacket.bombNumbers as number[]).join('、')}</b>`
      : `😊 无炸弹，安心领取`,
  ];

  // ── 领取详情 ──────────────────────────────────────────────────
  if (claims.length > 0) {
    lines.push(``, `——领取详情——`);
    for (const c of claims) {
      const u = c.botUser as any;
      const fullName = `${u?.firstName ?? ''}${
        u?.lastName ? ' ' + u.lastName : ''
      }`.trim();
      const name = fullName || (u?.userName ? `@${u.userName}` : '匿名');
      const delta = c.pointsDelta as number;
      const sign = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
      const bomb = c.isBomb ? `💣` : `🎁`;
      lines.push(`${bomb} <b>${sign}</b> 积分  ${name}`);
    }
  }

  // ── 盈亏汇总（全部领完或过期时显示） ─────────────────────────
  if (isFinished && claims.length > 0) {
    const totalOut = redPacket.totalPoints as number; // 发出总额
    const totalBombDeducted = claims
      .filter((c: any) => c.isBomb)
      .reduce((s: number, c: any) => s + Math.abs(c.pointsDelta as number), 0);

    // 发起人实际净成本 = 总发出 - 炸弹收回（全炸时全退）
    const allBombed = redPacket.allBombed as boolean;
    const creatorNet = allBombed
      ? 0
      : totalOut - (allBombed ? totalBombDeducted : 0);
    const profitable = totalBombDeducted > 0 && !allBombed;

    lines.push(``);
    lines.push(`💰 本包盈利：<b>${profitable ? '盈利' : '未盈利'}</b>`);
    lines.push(`💰 发包成本：<b>-${totalOut.toFixed(2)}</b>`);
    lines.push(
      `💰 包主实收：<b>${
        allBombed ? '0.00（全炸退还）' : `-${creatorNet.toFixed(2)}`
      }</b>`,
    );
  }

  return lines.join('\n');
}
