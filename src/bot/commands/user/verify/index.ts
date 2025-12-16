import { Composer } from 'grammy';
import verifyCallback from './verify';
// 创建一个新的 Composer 实例
const verifyCamposer = new Composer();

verifyCamposer.use(verifyCallback.middleware());

export default verifyCamposer;
