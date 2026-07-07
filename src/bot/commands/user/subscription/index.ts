import { Composer } from 'grammy';
import subscriptionCallback from './subscription';
import refreshCallback from './refresh';
import payCallback from './pay';
import checkCallback from './check';

const subscriptionComposer = new Composer();

subscriptionComposer.use(subscriptionCallback.middleware());
subscriptionComposer.use(refreshCallback.middleware());
subscriptionComposer.use(payCallback.middleware());
subscriptionComposer.use(checkCallback.middleware());

export default subscriptionComposer;
