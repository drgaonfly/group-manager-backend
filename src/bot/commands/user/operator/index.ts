// src/composers/index.ts
import { Composer } from 'grammy';
import addOperatorCommand from './add';

// 创建一个新的 Composer 实例
const userComposer = new Composer();

userComposer.use(addOperatorCommand.middleware());

export default userComposer;
