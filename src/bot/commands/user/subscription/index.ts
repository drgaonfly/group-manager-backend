// src/composers/index.ts
import { Composer } from 'grammy';
import renewalCommand from './renewal';
import trialCommand from './trial';

// 创建一个新的 Composer 实例
const subscriptionComposer = new Composer();

subscriptionComposer.use(renewalCommand.middleware());
subscriptionComposer.use(trialCommand.middleware());

export default subscriptionComposer;
