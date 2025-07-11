// src/composers/index.ts
import { Composer } from 'grammy';
import startComposer from './start';
import helpComposer from './help';
import operatorComposer from './operator';
import setComposer from './set';
import billComposer from './bill';
import contactComposer from './contact';
import subscriptionComposer from './subscription';
import profileComposer from './profile';
import startingComposer from './starting';
import cloneComposer from './clone';
import walletComposer from './wallet';
import exchangeComposer from './exchange';
import conversationsComposer from './conversations';
import spreadComposer from './spread';
import linkComposer from './link';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

userComposer.use(startComposer.middleware());
userComposer.use(helpComposer.middleware());

// 在群里使用的
userComposer.use(operatorComposer.middleware());
userComposer.use(setComposer.middleware());
userComposer.use(billComposer.middleware());

// 在机器人使用的
userComposer.use(profileComposer.middleware());
userComposer.use(startingComposer.middleware());
userComposer.use(contactComposer.middleware());
userComposer.use(subscriptionComposer.middleware());
userComposer.use(cloneComposer.middleware());
userComposer.use(walletComposer.middleware());
userComposer.use(exchangeComposer.middleware());
userComposer.use(conversationsComposer.middleware());
userComposer.use(spreadComposer.middleware());
userComposer.use(linkComposer.middleware());

export default userComposer;
