// src/composers/index.ts
import { Composer } from 'grammy';

import exchangeShowComposer from './show';
import exchangeRealtiemComposer from './realtiem';

// 创建一个新的 Composer 实例
const exchangeComposer = new Composer();

exchangeComposer.use(exchangeShowComposer.middleware());
exchangeComposer.use(exchangeRealtiemComposer.middleware());

export default exchangeComposer;
