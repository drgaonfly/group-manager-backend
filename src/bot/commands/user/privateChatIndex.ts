import { Composer } from 'grammy';
import startComposer from './start';
import contactComposer from './contact';
import helpComposer from './help';
import subscriptionComposer from './subscription';
import profileComposer from './profile';
import startingComposer from './starting';
import rechargeComposer from './recharge';
import successComposer from './success';
import auctionComposer from './auction';

// 创建私聊专用的 Composer 实例
const privateChatComposer = new Composer();

// conversations 必须最先注册，确保 createConversation 在任何 enter() 调用前生效
privateChatComposer.use(startComposer.middleware());
privateChatComposer.use(rechargeComposer.middleware());
privateChatComposer.use(successComposer.middleware());
privateChatComposer.use(profileComposer.middleware());
privateChatComposer.use(startingComposer.middleware());
privateChatComposer.use(contactComposer.middleware());
privateChatComposer.use(helpComposer.middleware());
privateChatComposer.use(auctionComposer.middleware());
privateChatComposer.use(subscriptionComposer.middleware());

export default privateChatComposer;
