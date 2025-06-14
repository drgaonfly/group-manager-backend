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
import cloneConversationComposer from './conversations';
import walletComposer from './wallet';

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

userComposer.use(cloneConversationComposer.middleware());
export default userComposer;
