import { Composer } from 'grammy';

import inheritComposer from './inheritConversation';
import cloneConversationComposer from './clone';

const conversationsComposer = new Composer();

conversationsComposer.use(inheritComposer.middleware());
conversationsComposer.use(cloneConversationComposer.middleware());

export default conversationsComposer;
