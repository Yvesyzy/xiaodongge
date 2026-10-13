import { createServer } from 'vite';
import { createSocialServer } from '../social/codex_server.mjs';
import { fileURLToPath } from 'node:url';

const social = createSocialServer({ dbPath: fileURLToPath(new URL('../social/data/social.sqlite', import.meta.url)), allowedOrigins: ['http://127.0.0.1:5173'] });
let vite;
try {
  await new Promise((resolve, reject) => { social.server.once('error', reject); social.server.listen(8787, '127.0.0.1', resolve); });
  vite = await createServer({ configFile: fileURLToPath(new URL('../mobile/vite.config.ts', import.meta.url)), server: { host: '127.0.0.1', port: 5173, strictPort: true } });
  await vite.listen();
  console.log('小懂哥好友圈本机测试版：http://127.0.0.1:5173/#/social');
  console.log('页面中填写服务地址：http://127.0.0.1:8787');
  console.log('用两个独立浏览器或一个无痕窗口注册两个账号，即可测试加好友和互动。');
  console.log('仅本机可访问；按 Ctrl+C 停止。');
} catch (error) {
  await vite?.close(); await social.close(); throw error;
}
const close = async () => { await vite.close(); await social.close(); process.exit(0); };
process.once('SIGINT', close); process.once('SIGTERM', close);
