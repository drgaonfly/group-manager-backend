// src/composers/index.ts
import { Composer } from 'grammy';
import depositCommand from './deposit';
import withdrawCommand from './withdraw';
import initiateCommand from './initiate';
import showBillCommand from './show';
import clearBillCommand from './clear';
import rollbackBillCommand from './rollback';

// 创建一个新的 Composer 实例
const billComposer = new Composer();

billComposer.use(initiateCommand.middleware());
billComposer.use(depositCommand.middleware());
billComposer.use(withdrawCommand.middleware());
billComposer.use(showBillCommand.middleware());
billComposer.use(clearBillCommand.middleware());
billComposer.use(rollbackBillCommand.middleware());

export default billComposer;
