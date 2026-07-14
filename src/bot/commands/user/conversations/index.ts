import { Composer } from 'grammy';

import inheritComposer from './inherit';
import cloneConversationComposer from './clone';
import authorizeConversationComposer from './authorize';

const conversationsComposer = new Composer();

conversationsComposer.use(inheritComposer.middleware());
conversationsComposer.use(cloneConversationComposer.middleware());
conversationsComposer.use(authorizeConversationComposer.middleware());

export default conversationsComposer;
