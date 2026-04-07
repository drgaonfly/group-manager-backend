import { Composer } from 'grammy';
import { MyContext } from '../bot/types';
import { getGramClient } from '../bot/services/gramClient';
import { Api } from 'telegram';

export const addOperatorCommand = new Composer<MyContext>();

// 通过 username 获取用户信息
export async function getUserByUsername(botToken: string, username: string) {
  console.log('username', username);
  const gramClient = await getGramClient(botToken);
  try {
    const user = await gramClient.invoke(
      new Api.contacts.ResolveUsername({ username }),
    );
    const { id, username: uname, firstName, lastName } = user.users[0] as any;
    console.log('用户信息:', { id, username: uname, firstName, lastName });
    console.log('id', id.value);
    console.log('处理 @username 提及:', uname);

    return {
      id,
      username: uname,
      first_name: firstName,
      last_name: lastName,
    };
  } catch (error) {
    console.log('获取用户信息失败:', error);
    throw error;
  }
}
