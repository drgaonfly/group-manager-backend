// scripts/build.js
const { execSync } = require('child_process');
const glob = require('glob');
const fs = require('fs').promises;
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { minify } = require('terser');
const archiver = require('archiver');

// 清理并编译
execSync('rimraf dist && tsc -p tsconfig.json');

// 混淆和压缩
async function processFiles() {
  const files = glob.sync('dist/**/*.js');
  for (const file of files) {
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
  }

  // 创建 build 目录
  await fs.mkdir('build', { recursive: true });

  // 创建 zip 文件流
  const output = require('fs').createWriteStream('build/dist.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 } // 最大压缩级别
  });

  // 监听压缩完成事件
  await new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory('dist/', false);
    archive.finalize();
  });
}

processFiles().catch(console.error);