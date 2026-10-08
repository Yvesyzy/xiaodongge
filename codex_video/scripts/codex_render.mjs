import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill,openBrowser} from '@remotion/renderer';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(project);
const stills=process.argv.includes('--stills'),only=process.argv.find(a=>a.startsWith('--format='))?.split('=')[1];
const version=process.argv.find(a=>a.startsWith('--version='))?.split('=')[1]??'v6';
if(version!=='v6')throw new Error('The current film is v6');
if(only&&!['portrait','landscape'].includes(only))throw new Error('Supported format: portrait or landscape');
const suffix='_v6',qa='qa/v6';
const frameCount=JSON.parse(await readFile('public/codex_timing_v6.json','utf8')).durationFrames,duration=frameCount/30;
const audio='public/codex_original_score_v6.wav';
const comment=`Real v${JSON.parse(await readFile('public/codex_theme_v5/codex_assets.json','utf8')).version} UI and actual light/dark controls; synthetic demonstration data; original 60-second brand score.`;
const requestedFrames=process.argv.find(a=>a.startsWith('--frames='))?.slice('--frames='.length);
const frames=requestedFrames?requestedFrames.split(',').map(Number):[0,18,54,72,108,126,144,180,216,252,288,324,360,378,414,450,486,504,540,558,576,594,606,612,630,642,648,666,678,684,702,720,738,750,756,774,786,792,804,810,828,840,846,852,864,900,912,918,936,954,966,972,990,1008,1044,1080,1134,1170,1188,1224,1242,1260,1296,1332,1368,1404,1422,1458,1494,1512,1548,1566,1584,1620,1656,1674,1692,1728,1764,1797];
if(frames.some(f=>!Number.isInteger(f)||f<0||f>=frameCount))throw new Error(`Frames must be integers from 0 to ${frameCount-1}`);
function encodeDelivery(format){
 const input=`output/codex_${format.toLowerCase()}${suffix}_render.mp4`;
 const output=`output/codex_xiaodongge_${format.toLowerCase()}${suffix}_1080p.mp4`;
 // Frame color fields override encoder options; normalize those after the YUV conversion.
 const deliveryFilter='scale=in_range=auto:out_range=tv:out_color_matrix=bt709,format=yuv420p,sidedata=mode=delete:type=ICC_PROFILE,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709';
 execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',input,'-i',audio,'-map','0:v:0','-map','1:a:0','-vf',deliveryFilter,'-c:v','libx264','-preset','medium','-crf','17','-profile:v','high','-level:v','4.1','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','aac','-b:a','192k','-ar','48000','-t',String(duration),'-movflags','+faststart','-metadata','title=小懂哥 — 私人音乐档案','-metadata',`comment=${comment}`,output],{stdio:'inherit',windowsHide:true});
 console.log('encoded delivery',output);
 return output;
}
if(process.argv.includes('--encode')){
 for(const format of ['Portrait','Landscape'])if(!only||only.toLowerCase()===format.toLowerCase())encodeDelivery(format);
 process.exit(0);
}
const browserExecutable=execFileSync('powershell.exe',['-NoProfile','-Command',"(Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe').'(default)'"],{encoding:'utf8',windowsHide:true}).trim();
await mkdir('output',{recursive:true});await mkdir(qa,{recursive:true});
const serveUrl=await bundle({entryPoint:path.join(project,`src/codex_index${suffix}.tsx`),publicDir:path.join(project,'public'),outDir:path.join(project,`.cache/bundle${suffix}`),onProgress:p=>{if(p===100)console.log('bundle ready');}});
const browser=await openBrowser('chrome',{browserExecutable,chromiumOptions:{gl:'angle'}});
const result=[];
try{
 for(const format of ['Portrait','Landscape']){
  if(only&&only.toLowerCase()!==format.toLowerCase())continue;
  const composition=await selectComposition({serveUrl,id:`Xiaodongge-${format}`,puppeteerInstance:browser});
  if(stills){
   for(const frame of frames){
    await renderStill({composition,serveUrl,puppeteerInstance:browser,frame,output:`${qa}/codex_${format.toLowerCase()}_${String(frame).padStart(3,'0')}.jpg`,imageFormat:'jpeg',jpegQuality:94,scale:.5});
   }
   result.push({format,frames,files:frames.map(frame=>`${qa}/codex_${format.toLowerCase()}_${String(frame).padStart(3,'0')}.jpg`)});
   console.log('stills ready',format);continue;
  }
  let last=-1;
  const silent=`output/codex_${format.toLowerCase()}${suffix}_render.mp4`;
  await renderMedia({composition,serveUrl,puppeteerInstance:browser,codec:'h264',outputLocation:silent,crf:18,pixelFormat:'yuv420p',concurrency:3,imageFormat:'jpeg',jpegQuality:96,x264Preset:'medium',audioBitrate:'192k',onProgress:p=>{const current=Math.floor(p.progress*10);if(current!==last){console.log(format,current*10+'%');last=current;}}});
  const output=encodeDelivery(format);
  result.push({format,output,composition:{width:composition.width,height:composition.height,fps:composition.fps,frames:composition.durationInFrames}});
  console.log('rendered',output);
 }
 await writeFile(`${qa}/codex_${stills?'stills':'render'}_result.json`,JSON.stringify(result,null,2));
}finally{await browser.close({silent:true});}
