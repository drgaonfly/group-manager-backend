// src/composers/index.ts
import { Composer } from 'grammy';
import meCommand from './me';
import callback from './callback';

// 创建一个新的 Composer 实例
const profileComposer = new Composer();

profileComposer.use(meCommand.middleware());
profileComposer.use(callback.middleware());

export default profileComposer;
