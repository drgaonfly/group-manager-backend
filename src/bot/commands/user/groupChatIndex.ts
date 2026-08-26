import { Composer } from 'grammy';
import startComposer from './start';
import speechStaticComposer from './speechStatic';
import redpacketComposer from './redpacket';
import veryfiyComposer from './verify';
import checkinComposer from './checkin';
import lotteryComposer from './lottery';

// 创建群聊专用的 Composer 实例
const groupChatComposer = new Composer();

// conversations 必须最先注册，确保 createConversation 在任何 enter() 调用前生效

groupChatComposer.use(startComposer.middleware());
groupChatComposer.use(redpacketComposer.middleware());
groupChatComposer.use(speechStaticComposer.middleware());
groupChatComposer.use(lotteryComposer.middleware());
groupChatComposer.use(checkinComposer.middleware());
groupChatComposer.use(veryfiyComposer.middleware());

export default groupChatComposer;
