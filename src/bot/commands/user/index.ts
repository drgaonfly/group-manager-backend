// src/composers/index.ts
import { Composer } from 'grammy';
import startComposer from './start';
import helpComposer from './help';
// import operatorComposer from './operator';
// import setComposer from './set';
import contactComposer from './contact';
// import subscriptionComposer from './subscription';
import profileComposer from './profile';
import speechStaticComposer from './speechStatic';
import startingComposer from './starting';
// import cloneComposer from './clone';
// import walletComposer from './wallet';
// import exchangeComposer from './exchange';
import veryfiyComposer from './verify';
import conversationsComposer from './conversations';
// import spreadComposer from './spread';
// import linkComposer from './link';
// import orderComposer from './order';
import verifyComposer from './verify';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

// 验证回调处理器（需要在其他处理器之前）
userComposer.use(verifyComposer.middleware());

userComposer.use(startComposer.middleware());
userComposer.use(speechStaticComposer.middleware());

// 在群里使用的
// userComposer.use(operatorComposer.middleware());
// userComposer.use(setComposer.middleware());

// 在机器人使用的
userComposer.use(profileComposer.middleware());
userComposer.use(startingComposer.middleware());
userComposer.use(contactComposer.middleware());
// userComposer.use(subscriptionComposer.middleware());
// userComposer.use(cloneComposer.middleware());
// userComposer.use(walletComposer.middleware());
// userComposer.use(exchangeComposer.middleware());
userComposer.use(veryfiyComposer.middleware());
userComposer.use(conversationsComposer.middleware());
// userComposer.use(spreadComposer.middleware());
// userComposer.use(linkComposer.middleware());
// userComposer.use(orderComposer.middleware());

export default userComposer;
