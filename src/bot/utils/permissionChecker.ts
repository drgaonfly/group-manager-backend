import { IUser } from '../../models/user';
import { IBot } from '../../models/bot';

/**
 * 检查用户权限的工具函数。
 *
 * 权限采用单层控制：只由平台授予代理用户的功能字段决定，
 * Bot 自身的 canXxx 开关不再参与判断（已废弃双重门控）。
 * bot 参数保留以维持调用兼容性，但不参与逻辑。
 */
export class PermissionChecker {
  static canUseSpeechStatic(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.speech_static;
  }

  static canUseFreeKeyboard(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.keyboardConfig;
  }

  static canUseGroupMessaging(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.groupMessage;
  }

  static canUseBidirectional(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.bidirectional;
  }

  static canUseGroupWelcome(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.groupWelcome;
  }

  static canUseChannelPost(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.channelPost;
  }

  /** 配置有效性在 resolver 层按群组检查 */
  static canUseGroupVerify(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.groupVerify;
  }

  static canReportMemberNameUpdated(
    proxyUser: IUser | null,
    _bot?: IBot,
  ): boolean {
    return !!proxyUser?.reportGroupMemberNameUpdated;
  }

  static canUseAdRemoval(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.adRemoval;
  }

  static canUseSuccess(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.success;
  }

  static canUseRedPacket(proxyUser: IUser | null, _bot?: IBot): boolean {
    return !!proxyUser?.redPacket;
  }

  /** 获取所有功能的可用状态 */
  static getAllPermissions(proxyUser: IUser | null, _bot?: IBot) {
    return {
      speechStatic: this.canUseSpeechStatic(proxyUser),
      freeKeyboard: this.canUseFreeKeyboard(proxyUser),
      groupMessaging: this.canUseGroupMessaging(proxyUser),
      bidirectional: this.canUseBidirectional(proxyUser),
      groupWelcome: this.canUseGroupWelcome(proxyUser),
      channelPost: this.canUseChannelPost(proxyUser),
      groupVerify: this.canUseGroupVerify(proxyUser),
      adRemoval: this.canUseAdRemoval(proxyUser),
      redPacket: this.canUseRedPacket(proxyUser),
    };
  }
}
