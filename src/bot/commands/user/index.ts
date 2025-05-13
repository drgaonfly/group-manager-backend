// src/composers/index.ts
import { Composer } from 'grammy';
import startComposer from './start';
import helpComposer from './help';
import callbackComposer from './callback';
import setInitiateComposer from './initiate';
import depositCommand from './deposit';
import withdrawComposer from './withdraw';
import operatorComposer from './operator/index';
import setComposer from './set';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

userComposer.use(startComposer.middleware());
userComposer.use(helpComposer.middleware());
userComposer.use(setComposer.middleware());
userComposer.use(callbackComposer.middleware());
userComposer.use(setInitiateComposer.middleware());
userComposer.use(depositCommand.middleware());
userComposer.use(withdrawComposer.middleware());
userComposer.use(operatorComposer.middleware());

export default userComposer;
