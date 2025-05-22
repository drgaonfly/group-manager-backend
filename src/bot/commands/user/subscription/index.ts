import { Composer } from 'grammy';
import renewalCommand from './renewal';
import trialCommand from './trial';
import callback from './callback';

// 创建一个新的 Composer 实例
const subscriptionComposer = new Composer();

subscriptionComposer.use(trialCommand.middleware());
subscriptionComposer.use(renewalCommand.middleware());
subscriptionComposer.use(callback.middleware());

export default subscriptionComposer;
