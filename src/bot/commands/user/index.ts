// src/composers/index.ts
import { Composer } from 'grammy';
import startComposer from './start';
import helpComposer from './help';
import callbackComposer from './callback';
import setExchangeRateComposer from './setExchangeRate';
import setFeeRateComposer from './setFeeRate';
import setInitiateComposer from './initiate';
import setAddOperatorComposer from './addOperator';
// import depositComposer from './deposit';
// import withdrawComposer from './withdraw';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

userComposer.use(startComposer.middleware());
userComposer.use(helpComposer.middleware());
userComposer.use(setExchangeRateComposer.middleware());
userComposer.use(setFeeRateComposer.middleware());
// userComposer.use(depositComposer.middleware());
// userComposer.use(withdrawComposer.middleware());
userComposer.use(callbackComposer.middleware());
userComposer.use(setInitiateComposer.middleware());
userComposer.use(setAddOperatorComposer.middleware());

export default userComposer;
