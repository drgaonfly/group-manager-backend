import puppeteer, { Browser, Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

interface SessionInfo {
  browser: Browser;
  page: Page;
}

export class TelegramAuthService {
  private sessions = new Map<string, SessionInfo>();

  public async enterPhoneNumber(phoneNumber: string): Promise<string> {
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox'],
      executablePath:
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    const page = await browser.newPage();
    await page.goto('https://web.telegram.org/k/', {
      waitUntil: 'networkidle2',
    });

    console.log(`Navigating to Telegram with phone number: ${phoneNumber}`);

    // 等待并输入手机号
    await page.waitForSelector('input[type="tel"]');
    console.log(
      'Phone number input found, entering phone number:',
      phoneNumber,
    );
    await page.type('input[type="tel"]', phoneNumber);

    // 点击下一步
    await page.click('button[type="submit"]');
    console.log('Clicked submit button for phone number');

    // 等待验证码输入框出现
    await page.waitForSelector('input.input-field', { timeout: 10000 });
    console.log('Verification code input found, waiting for code...');

    // 获取并记录验证码请求的反馈信息
    const verificationMessage = await page.evaluate(() => {
      const messageElement = document.querySelector('.verification-message'); // 假设有一个显示验证码请求状态的元素
      return messageElement ? messageElement.textContent : null;
    });
    console.log('Verification message:', verificationMessage);

    // 记录发送验证码的状态
    const phoneCodeHash = await page.evaluate(() => {
      const hashElement = document.querySelector(
        'input[name="phone_code_hash"]',
      ) as HTMLInputElement; // 类型断言为 HTMLInputElement
      return hashElement ? hashElement.value : null; // 获取输入框的值
    });
    console.log('Phone code hash:', phoneCodeHash);

    const sessionId = uuidv4();
    this.sessions.set(sessionId, { browser, page });
    return sessionId;
  }

  public async enterCode(sessionId: string, code: string): Promise<any[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('会话已过期');
    }

    const { page, browser } = session;

    // 等待并输入验证码
    await page.waitForSelector('input.input-field');
    await page.type('input.input-field', code);

    // 等待登录完成
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 获取 cookies
    const cookies = await page.cookies();

    await browser.close();
    this.sessions.delete(sessionId);

    return cookies;
  }
}
