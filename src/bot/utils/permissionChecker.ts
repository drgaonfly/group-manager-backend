import { IUser } from '../../models/user';
import { IBot } from '../../models/bot';

/**
 * 检查用户权限和机器人功能配置的工具函数
 */
export class PermissionChecker {
  /**
   * 检查群内统计功能是否可用
   * @param proxyUser 代理用户
   * @param bot 机器人
   * @returns 是否可用
   */
  static canUseSpeechStatic(proxyUser: IUser | null, bot: IBot): boolean {
    return !!(proxyUser?.speech_static && bot?.canSpeechStatic);
  }

  /**
   * 检查自由键盘功能是否可用
   * @param proxyUser 代理用户
   * @param bot 机器人
   * @returns 是否可用
   */
  static canUseFreeKeyboard(proxyUser: IUser | null, bot: IBot): boolean {
    return !!(proxyUser?.keyboardConfig && bot?.canFreeKeyboard);
  }

  /**
   * 检查群发功能是否可用
   * @param proxyUser 代理用户
   * @param bot 机器人
   * @returns 是否可用
   */
  static canUseGroupMessaging(proxyUser: IUser | null, bot: IBot): boolean {
    return !!(proxyUser?.groupMessage && bot?.canGroupMessaging);
  }

  /**
   * 检查双向功能是否可用
   * @param proxyUser 代理用户
   * @param bot 机器人
   * @returns 是否可用
   */
  static canUseBidirectional(proxyUser: IUser | null, bot: IBot): boolean {
    return !!(proxyUser?.bidirectional && bot?.canBidirectional);
  }

  static canUseGroupWelcome(proxyUser: IUser | null, bot: IBot): boolean {
    return !!(proxyUser?.groupWelcome && bot?.canGroupWelcome);
  }

  static canUseChannelPost(proxyUser: IUser | null, bot: IBot): boolean {
    return !!(proxyUser?.channelPost && bot?.canOpenChannelPost);
  }

  /**
   * 获取所有功能的可用状态
   * @param proxyUser 代理用户
   * @param bot 机器人
   * @returns 功能可用状态对象
   */
  static getAllPermissions(proxyUser: IUser | null, bot: IBot) {
    return {
      speechStatic: this.canUseSpeechStatic(proxyUser, bot),
      freeKeyboard: this.canUseFreeKeyboard(proxyUser, bot),
      groupMessaging: this.canUseGroupMessaging(proxyUser, bot),
      bidirectional: this.canUseBidirectional(proxyUser, bot),
      groupWelcome: this.canUseGroupWelcome(proxyUser, bot),
      channelPost: this.canUseChannelPost(proxyUser, bot),
    };
  }
}
