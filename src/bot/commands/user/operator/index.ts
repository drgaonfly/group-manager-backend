// src/composers/index.ts
import { Composer } from 'grammy';
import addOperatorCommand from './add';
import showOperatorCommand from './show';
import removeOperatorCommand from './delete';

// 创建一个新的 Composer 实例
const operatorComposer = new Composer();

operatorComposer.use(addOperatorCommand.middleware());
operatorComposer.use(showOperatorCommand.middleware());
operatorComposer.use(removeOperatorCommand.middleware());

export default operatorComposer;
