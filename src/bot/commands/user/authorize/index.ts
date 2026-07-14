// src/composers/authorize/index.ts
import { Composer } from 'grammy';
import authorizeCommand from './authorize';
import showAuthorizeCommand from './show';
import deleteAuthorizeCommand from './delet';

// 创建一个新的 Composer 实例
const authorizeComposer = new Composer();

authorizeComposer.use(authorizeCommand.middleware());
authorizeComposer.use(showAuthorizeCommand.middleware());
authorizeComposer.use(deleteAuthorizeCommand.middleware());

export default authorizeComposer;
