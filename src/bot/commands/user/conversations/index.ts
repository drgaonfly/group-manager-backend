import { Composer } from 'grammy';

import beTeacherConversation from './beTeacher';
import writeRiviewOtherTeacherConversation from './writeRiviewOtherTeacher';
import uploadLocationComposer from './uploadLocation';
import inputLocationComposer from './inputLocation';
import inheritComposer from './inheritConversation';

const conversationsComposer = new Composer();

conversationsComposer.use(beTeacherConversation.middleware());
conversationsComposer.use(writeRiviewOtherTeacherConversation.middleware());
conversationsComposer.use(uploadLocationComposer.middleware());
conversationsComposer.use(inputLocationComposer.middleware());
conversationsComposer.use(inheritComposer.middleware());

export default conversationsComposer;
