// src/composers/index.ts
import { Composer } from 'grammy';
import syncAdminsComposer from './syncAdmins';
import isAdmin from '../../middlewares/isAdmin';

// 创建一个新的 Composer 实例
const adminComposer = new Composer();

adminComposer.use(isAdmin);
adminComposer.use(syncAdminsComposer.middleware());

export default adminComposer;
