import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// 本地启动脚本：一个 wrangler 进程同时提供前端页面和后端 /api/*
// 用法：
//   npm run dev        → 按 .dev.vars 的配置启动（默认 Mock）
//   npm run dev:real   → 真实密钥模式（要求 MOCK_MODE=0）

const root = path.resolve(import.meta.dirname, '..');
const devVarsPath = path.join(root, '.dev.vars');
const examplePath = path.join(root, '.dev.vars.example');
const modeArg = process.argv[2] || 'mock';

if (!fs.existsSync(devVarsPath)) {
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, devVarsPath);
    console.log('[理想的自己] 没有找到 .dev.vars，已从 .dev.vars.example 创建（默认 Mock 模式）。');
  } else {
    console.error('[理想的自己] 缺少 .dev.vars，也没有 .dev.vars.example，无法启动。');
    process.exit(1);
  }
}

const devVars = fs.readFileSync(devVarsPath, 'utf8');
const mockEnabled = /^\s*MOCK_MODE\s*=\s*["']?1["']?\s*$/m.test(devVars);

if (modeArg === 'real' && mockEnabled) {
  console.warn('[理想的自己] 当前 .dev.vars 里 MOCK_MODE="1"。');
  console.warn('           要用真实密钥，请把 MOCK_MODE 改成 "0" 并填入 SUPABASE / DeepSeek 密钥。');
  console.warn('           现在仍按当前配置启动。');
}

console.log('');
console.log('  理想的自己 · 本地开发');
console.log('  ----------------------');
console.log(`  模式：${mockEnabled ? 'Mock（不连数据库、不调 AI）' : '真实（使用 .dev.vars 里的密钥）'}`);
console.log('  地址：http://127.0.0.1:8788');
console.log('  说明：本地一个进程同时提供前端页面和后端 /api/*，不需要分别启动。');
console.log('  退出：Ctrl+C');
console.log('');

const child = spawn(
  'npx',
  ['wrangler', 'pages', 'dev', 'app', '--port', '8788'],
  { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }
);

child.on('exit', code => process.exit(code ?? 0));
