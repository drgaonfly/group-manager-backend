// scripts/build.js
const { execSync } = require('child_process');
const glob = require('glob');
const fs = require('fs').promises;
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');
const archiver = require('archiver');
const Client = require('ssh2').Client;
const cliProgress = require('cli-progress');
require('dotenv').config();

// 远程部署目录
const REMOTE_DEPLOY_PATH = '/www/wwwroot/multi-backend';

// NVM Node路径
const NVM_NODE_PATH = '/root/.nvm/versions/node/v22.15.0/bin';

// PM2 服务名称
const PM2_SERVICE_NAME = 'multi-backend';

// 远程服务器配置
const sshConfig = {
  host: process.env.SSH_HOST,
  port: 22,
  username: 'root',
  // 检查SSH私钥路径是否存在
  privateKey: process.env.SSH_PRIVATE_KEY ? require('fs').readFileSync(process.env.SSH_PRIVATE_KEY) : undefined
};

// 清理并编译
// console.log('开始清理和编译...');
// execSync('rimraf dist && tsc -p tsconfig.json && cp -r src/templates dist/templates');
// console.log('清理和编译完成');

// 创建压缩包
async function createZipArchive() {
  await fs.mkdir('build', { recursive: true });

  const output = require('fs').createWriteStream('build/dist.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 }
  });

  console.log('开始创建压缩包...');
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(100, 0);

  return new Promise((resolve, reject) => {
    output.on('close', () => {
      progressBar.stop();
      console.log('压缩包创建完成');
      resolve();
    });
    archive.on('error', reject);
    archive.on('progress', (progress) => {
      const percent = Math.round((progress.fs.processedBytes / progress.fs.totalBytes) * 100);
      progressBar.update(percent);
    });
    archive.pipe(output);
    archive.directory('dist/', false);
    archive.finalize();
  });
}

// 混淆和压缩
async function processFiles() {
  const files = glob.sync('dist/**/*.js');
  console.log(`开始处理 ${files.length} 个文件...`);
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  progressBar.start(files.length, 0);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    let code = await fs.readFile(file, 'utf8');
    
    // 混淆
    code = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      stringArrayEncoding: ['rc4']
    }).getObfuscatedCode();

    // 压缩
    const result = await minify(code, {
      compress: true,
      mangle: true
    });
    if (result.error) throw result.error;

    await fs.writeFile(file, result.code);
    progressBar.update(i + 1);
  }
  
  progressBar.stop();
  console.log('文件处理完成');

  await createZipArchive();

  // 仅当存在SSH_HOST和SSH_PRIVATE_KEY环境变量时才执行远程部署
  if (process.env.SSH_HOST && process.env.SSH_PRIVATE_KEY) {
    await uploadAndExtract();
    // 上传并执行清理脚本
    // await uploadAndExecuteCleanScript();
  } else {
    console.log('跳过远程部署: 缺少SSH_HOST或SSH_PRIVATE_KEY环境变量');
  }
  
  // 执行完成后退出进程
  process.exit(0);
}

// 上传并解压文件到远程服务器
async function uploadAndExtract() {
  const conn = new Client();
  console.log('开始连接远程服务器...');
  
  await new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      console.log('远程服务器连接成功');
      try {
        // 先确保远程目录存在
        await new Promise((res, rej) => {
          conn.exec(
            `mkdir -p ${REMOTE_DEPLOY_PATH} ${REMOTE_DEPLOY_PATH}/tmp ${REMOTE_DEPLOY_PATH}/logs`,
            (err, stream) => {
              if (err) return rej(err);
              stream.on('close', () => res());
              stream.on('data', () => {});
              stream.stderr.on('data', (data) => console.error('STDERR: ' + data));
            }
          );
        });

        // 上传文件
        await new Promise((res, rej) => {
          conn.sftp((err, sftp) => {
            if (err) rej(err);
            const uploads = [
              { src: 'build/dist.zip', dest: `${REMOTE_DEPLOY_PATH}/dist.zip` },
              { src: 'package.json', dest: `${REMOTE_DEPLOY_PATH}/package.json` },
              { src: 'pnpm-lock.yaml', dest: `${REMOTE_DEPLOY_PATH}/pnpm-lock.yaml` },
              { src: 'ecosystem.config.js', dest: `${REMOTE_DEPLOY_PATH}/ecosystem.config.js` },
              { src: '.env', dest: `${REMOTE_DEPLOY_PATH}/.env` }
            ];
            
            console.log('开始上传文件...');
            const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
            progressBar.start(uploads.length, 0);
            
            // 串行上传所有文件
            const uploadSequentially = async () => {
              for (let i = 0; i < uploads.length; i++) {
                const file = uploads[i];
                await new Promise((resolve, reject) => {
                  sftp.fastPut(file.src, file.dest, (err) => {
                    if (err) reject(err);
                    progressBar.update(i + 1);
                    resolve();
                  });
                });
              }
              progressBar.stop();
              console.log('文件上传完成');
            };
            
            uploadSequentially()
              .then(res)
              .catch(rej);
          });
        });

        // 解压文件并安装依赖
        console.log('开始解压文件并安装依赖...');
        await new Promise((res, rej) => {
          conn.exec(
            `cd ${REMOTE_DEPLOY_PATH} && \
            rm -rf dist && \
            mkdir -p dist && \
            unzip -o dist.zip -d dist && \
            rm dist.zip && \
            PATH="${NVM_NODE_PATH}:$PATH" pnpm install && \
            PATH="${NVM_NODE_PATH}:$PATH" pm2 restart ${PM2_SERVICE_NAME} && \
            PATH="${NVM_NODE_PATH}:$PATH" node dist/bot/index.js`,
            (err, stream) => {
              if (err) rej(err);
              stream.on('close', () => {
                console.log('部署完成');
                res();
              });
              stream.on('data', (data) => console.log('STDOUT: ' + data));
              stream.stderr.on('data', (data) => console.error('STDERR: ' + data));
            }
          );
        });

        resolve();
      } catch (error) {
        reject(error);
      } finally {
        conn.end();
      }
    }).connect(sshConfig);
  });
}

// 上传并执行清理脚本
async function uploadAndExecuteCleanScript() {
  const conn = new Client();
  console.log('开始上传清理脚本...');
  
  await new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      try {
        // 上传清理脚本
        await new Promise((res, rej) => {
          conn.sftp((err, sftp) => {
            if (err) rej(err);
            sftp.fastPut('scripts/clean.sh', `${REMOTE_DEPLOY_PATH}/clean.sh`, (err) => {
              if (err) rej(err);
              console.log('清理脚本上传完成');
              res();
            });
          });
        });

        // 添加执行权限并运行清理脚本
        console.log('开始执行清理脚本...');
        await new Promise((res, rej) => {
          conn.exec(
            `cd ${REMOTE_DEPLOY_PATH} && chmod u+x clean.sh && ./clean.sh`,
            (err, stream) => {
              if (err) rej(err);
              stream.on('close', () => {
                console.log('清理脚本执行完成');
                res();
              });
              stream.on('data', (data) => console.log('清理脚本输出: ' + data));
              stream.stderr.on('data', (data) => console.error('清理脚本错误: ' + data));
            }
          );
        });

        resolve();
      } catch (error) {
        reject(error);
      } finally {
        conn.end();
      }
    }).connect(sshConfig);
  });
}

processFiles().catch(err => {
  console.error(err);
  process.exit(1);
});
