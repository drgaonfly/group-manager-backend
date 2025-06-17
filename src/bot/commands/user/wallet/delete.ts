import { Composer } from 'grammy';
import { MyContext } from '../../../types';
import { handleWalletList } from './handleWalletList';
import { handleShow } from './show';
import Wallet from '../../../../models/wallet';
import createDebug from 'debug';

const walletDeleteComposer = new Composer<MyContext>();

const debug = createDebug('bot:wallet:delete');

walletDeleteComposer.callbackQuery('wallet_delete_address', async (ctx) => {
  debug('wallet_delete_address');

  await handleWalletList(ctx, 1, 'delete');
});

walletDeleteComposer.callbackQuery(/delete_([a-f0-9]{24})$/, async (ctx) => {
  const walletId = ctx.callbackQuery.data.split('_')[1];

  debug('delete_wallet', walletId);

  await Wallet.findByIdAndDelete(walletId, {
    isOnline: true,
  });

  await ctx.reply('✅ 删除成功');

  await handleShow(ctx, 1);
});

export default walletDeleteComposer;
