// src/composers/index.ts
import { Composer } from 'grammy';
import chargingBalanceCommand from './chargingBalance';
import specificRechargeCallback from './callback/specificRecharge';
// import customRechargeCallback from '../conversations/customRecharge';
import cancelRechargeCallback from './callback/cancelRecharget';

// 创建一个新的 Composer 实例
const rechargeComposer = new Composer();

rechargeComposer.use(chargingBalanceCommand.middleware());
rechargeComposer.use(specificRechargeCallback.middleware());
// rechargeComposer.use(customRechargeCallback.middleware());
rechargeComposer.use(cancelRechargeCallback.middleware());

export default rechargeComposer;
