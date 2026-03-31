import { Composer } from 'grammy';

import beTeacherConversation from './beTeacher';
import writeRiviewOtherTeacherConversation from './writeRiviewOtherTeacher';

const conversationsComposer = new Composer();

conversationsComposer.use(beTeacherConversation.middleware());
conversationsComposer.use(writeRiviewOtherTeacherConversation.middleware());

export default conversationsComposer;
