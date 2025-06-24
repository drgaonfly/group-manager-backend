// src/composers/index.ts
import { Composer } from 'grammy';

import exchangeShowComposer from './show';
import exchangeRealtiemComposer from './realtiem';
import exchangeCancelComposer from './cancel';

// 创建一个新的 Composer 实例
const exchangeComposer = new Composer();

exchangeComposer.use(exchangeShowComposer.middleware());
exchangeComposer.use(exchangeRealtiemComposer.middleware());
exchangeComposer.use(exchangeCancelComposer.middleware());

export default exchangeComposer;
