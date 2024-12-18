import puppeteer, { Browser, Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

interface SessionInfo {
  browser: Browser;
  page: Page;
}

export class TelegramAuthService {
  private sessions = new Map<string, SessionInfo>();

  public async enterPhoneNumber(
    phoneNumber: string,
    countryName: string,
  ): Promise<string> {
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

    //点击进入号码登陆页
    await page.click(
      'button.btn-primary.btn-secondary.btn-primary-transparent.primary.rp',
    );
    // 输入国家名称
    console.log(`输入国家名称: ${countryName}`);
    await page.waitForSelector(
      'div.input-field-input[contenteditable="true"][dir="auto"][data-no-linebreaks="1"]',
    );
    await page.type(
      'div.input-field-input[contenteditable="true"][dir="auto"][data-no-linebreaks="1"]',
      countryName,
    );
    //点击确认国家
    await page.click('li img[src="assets/img/emoji/1f1e8-1f1f3.png"]');
    console.log(`输入手机号: ${phoneNumber}`);
    // 等待并输入手机号
    await page.waitForSelector(
      'div.input-field.input-field-phone div.input-field-input[contenteditable="true"][data-no-linebreaks="1"][inputmode="decimal"]',
    );
    console.log(
      'Phone number input found, entering phone number:',
      phoneNumber,
    );
    await page.waitForSelector(
      'div.input-field.input-field-phone div.input-field-input[contenteditable="true"][data-no-linebreaks="1"][inputmode="decimal"]',
    );
    // 清空输入框
    await page.evaluate(() => {
      const inputField = document.querySelector(
        'div.input-field.input-field-phone div.input-field-input[contenteditable="true"][data-no-linebreaks="1"][inputmode="decimal"]',
      ) as HTMLElement;
      if (inputField) {
        inputField.innerText = ''; // 清空输入框
      }
    });

    await page.type(
      'div.input-field.input-field-phone div.input-field-input[contenteditable="true"][data-no-linebreaks="1"][inputmode="decimal"]',
      phoneNumber,
    );
    // 点击下一步
    await page.click('button.btn-primary.btn-color-primary.rp');

    console.log('Clicked submit button for phone number');

    // 验证码输入框出现
    await page.waitForSelector('div.input-field input[type="tel"]');

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
    await page.waitForSelector('div.input-field input[type="tel"]');
    await page.type('div.input-field input[type="tel"]', code);

    // 等待登录完成
    await page.waitForNavigation({ waitUntil: 'networkidle2' });

    // 获取 cookies
    const cookies = await page.cookies();

    await browser.close();
    this.sessions.delete(sessionId);

    return cookies;
  }
}
