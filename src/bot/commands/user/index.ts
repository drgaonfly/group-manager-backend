// src/composers/index.ts
import { Composer } from 'grammy';
import startComposer from './start';
// import helpComposer from './help';
// import operatorComposer from './operator';
// import setComposer from './set';
import contactComposer from './contact';
import helpComposer from './help';
// import subscriptionComposer from './subscription';
import profileComposer from './profile';
import speechStaticComposer from './speechStatic';
import startingComposer from './starting';
import teachingComposer from './teaching';
import rechargeComposer from './recharge';
import successComposer from './success';
// import cloneComposer from './clone';
// import walletComposer from './wallet';
// import exchangeComposer from './exchange';
import redpacketComposer from './redpacket';
import postComposer from './post';
import veryfiyComposer from './verify';
import checkinComposer from './checkin';
import lotteryComposer from './lottery';
import auctionComposer from './auction';
import conversationsComposer from './conversations';

// import spreadComposer from './spread';
// import linkComposer from './link';
// import orderComposer from './order';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

// conversations 必须最先注册，确保 createConversation 在任何 enter() 调用前生效
userComposer.use(conversationsComposer.middleware());
userComposer.use(startComposer.middleware());
userComposer.use(redpacketComposer.middleware());
userComposer.use(rechargeComposer.middleware());
userComposer.use(successComposer.middleware());
userComposer.use(teachingComposer);
userComposer.use(speechStaticComposer.middleware());
userComposer.use(profileComposer.middleware());
userComposer.use(startingComposer.middleware());
userComposer.use(postComposer.middleware());
userComposer.use(contactComposer.middleware());
userComposer.use(helpComposer.middleware());
userComposer.use(lotteryComposer.middleware());
userComposer.use(auctionComposer.middleware());
userComposer.use(checkinComposer.middleware());
// userComposer.use(subscriptionComposer.middleware());
// userComposer.use(cloneComposer.middleware());
// userComposer.use(walletComposer.middleware());
// userComposer.use(exchangeComposer.middleware());
userComposer.use(veryfiyComposer.middleware());

// userComposer.use(spreadComposer.middleware());
// userComposer.use(linkComposer.middleware());
// userComposer.use(orderComposer.middleware());

export default userComposer;
