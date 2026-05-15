import { Composer } from 'grammy';

import beTeacherConversation from './beTeacher';
import writeRiviewOtherTeacherConversation from './writeRiviewOtherTeacher';
import updateLocationConversation from './updateLocation';

const conversationsComposer = new Composer();

conversationsComposer.use(beTeacherConversation.middleware());
conversationsComposer.use(writeRiviewOtherTeacherConversation.middleware());
conversationsComposer.use(updateLocationConversation.middleware());

export default conversationsComposer;
