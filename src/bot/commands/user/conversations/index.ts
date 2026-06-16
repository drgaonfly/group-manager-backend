import { Composer } from 'grammy';

import inheritComposer from './inheritConversation';

const conversationsComposer = new Composer();

conversationsComposer.use(inheritComposer.middleware());

export default conversationsComposer;
