import { Composer } from 'grammy';

import beTeacherConversation from './beTeacher';
import writeRiviewOtherTeacherConversation from './writeRiviewOtherTeacher';
import uploadLocationComposer from './uploadLocation';
import inputLocationComposer from './inputLocation';

const conversationsComposer = new Composer();

conversationsComposer.use(beTeacherConversation.middleware());
conversationsComposer.use(writeRiviewOtherTeacherConversation.middleware());
conversationsComposer.use(uploadLocationComposer.middleware());
conversationsComposer.use(inputLocationComposer.middleware());

export default conversationsComposer;
