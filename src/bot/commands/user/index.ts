// src/composers/index.ts
import { Composer } from 'grammy';
import startComposer from './start';
import helpComposer from './help';
import callbackComposer from './callback';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

userComposer.use(helpComposer.middleware());
userComposer.use(startComposer.middleware());
userComposer.use(callbackComposer.middleware());

export default userComposer;
