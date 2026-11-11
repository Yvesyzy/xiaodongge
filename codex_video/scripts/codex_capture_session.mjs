import {createServer as createSocket} from 'node:net';
import path from 'node:path';
import {chromium} from 'playwright';
import {createServer} from 'vite';

// Keep this helper inside the film project so it travels with its source package.
export async function openCaptureSession(root, project, cacheName) {
 const socket=createSocket();
 await new Promise((resolve,reject)=>{socket.once('error',reject);socket.listen(0,'127.0.0.1',resolve);});
 const port=socket.address().port;
 await new Promise((resolve,reject)=>socket.close(error=>error?reject(error):resolve()));
 const server=await createServer({configFile:path.join(root,'mobile/vite.config.ts'),cacheDir:path.join(project,'.cache',cacheName),server:{host:'127.0.0.1',port,strictPort:true,forwardConsole:false}});
 let browser;
 const close=async()=>{
  const results=await Promise.allSettled([browser?.close(),server.close()]);
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
 };
 try{
  await server.listen();
  const address=server.httpServer.address();
  if(!address||typeof address==='string')throw new Error('Capture server has no TCP address');
  const origin=`http://127.0.0.1:${address.port}`;
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,timezoneId:'Asia/Shanghai',locale:'zh-CN',colorScheme:'light'});
  const page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-29T12:00:00+08:00'));
  await page.route('**/*',route=>{try{if(new URL(route.request().url()).origin===origin)return route.continue();}catch{}return route.abort();});
  return {page,origin,errors,close};
 }catch(error){
  try{await close();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Capture setup and cleanup failed');}
  throw error;
 }
}
