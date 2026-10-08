import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=process.argv.find(a=>a.startsWith('--version='))?.split('=')[1]??'v6';
if(version!=='v6')throw new Error('The current film is v6');
const suffix='_v6',qa='qa/v6',duration=60,expectedFrames=1800;
process.chdir(root);await mkdir(`${qa}/final_frames`,{recursive:true});
const report={passed:false,version,revision:'audio-continuity',generatedAt:new Date().toISOString(),files:[],playback:[]};
{
 const timing=JSON.parse(await readFile('public/codex_timing_v6.json','utf8'));
 const music=JSON.parse(await readFile('qa/v6/audio/codex_original_score_v6.qa.json','utf8'));
 assert.equal(timing.fps,30);assert.equal(timing.durationFrames,expectedFrames);assert.equal(60*timing.fps/timing.bpm,18);assert.equal(music.passed,true);
 assert.deepEqual(music.timeline_frames,timing.cues);assert.equal(music.sync_events.length,timing.accentCues.length);
 assert.deepEqual(music.sync_events.map(event=>event.name),timing.accentCues);assert.equal(music.format.duration_seconds,duration);
 for(const event of music.sync_events)assert.equal(event.onsetSample,timing.cues[event.name]*48000/timing.fps);
 assert.equal(createHash('sha256').update(await readFile('public/codex_original_score_v6.wav')).digest('hex'),music.sha256,'Master must match the checked music');
 assert(music.signal_checks.relisten_pause_relative_db>=-14&&music.signal_checks.relisten_pause_relative_db<=-6);
 assert(music.signal_checks.relisten_minimum_rms_dbfs>=-38);
 report.musicContinuity=['public/codex_original_score_v6.wav','output/codex_original_score_v6.mp3'].map(file=>({file,...checkMusicContinuity(file)}));
 const entry=await readFile(`src/codex_index${suffix}.tsx`,'utf8');
 const stages=[...entry.matchAll(/<Stage t=\{t\} start=\{cue\.(\w+)\} end=\{cue\.(\w+)\}>/g)].map(match=>[timing.cues[match[1]],timing.cues[match[2]]]);
 assert.equal(stages.length,10);assert.equal(stages[0][0],0);assert.equal(stages.at(-1)[1],expectedFrames);
 for(const [index,[start,end]] of stages.entries()){assert(start<end);if(index)assert.equal(stages[index-1][1],start);}
 report.musicSync={bpm:timing.bpm,framesPerBeat:18,cues:timing.cues,verifiedAudioEvents:music.sync_events.length,stages,masterSha256:music.sha256};
}
{
 const capture=JSON.parse(await readFile('qa/v6/codex_capture_light.json','utf8'));
 const source=JSON.parse(await readFile('public/codex_light/codex_assets.json','utf8'));
 assert.equal(capture.passed,true);assert.equal(capture.syntheticOnly,true);assert.equal(capture.errors.length,0);
 assert.equal(capture.theme,'light');assert.equal(source.theme,'light');assert.equal(source.readerTheme,'light');assert.equal(capture.version,source.version);
 assert.equal(capture.readerChecks.preferenceDark,false);assert.deepEqual(capture.readerChecks,source.readerChecks);
 assert.deepEqual(source.layout.dimensions.map(row=>row.label),['制作','词','曲','人声','原创性','共鸣']);
 report.source={version:source.version,theme:source.theme,readerTheme:source.readerTheme,readerChecks:source.readerChecks,dimensions:source.layout.dimensions.map(row=>row.label),assets:capture.assets,syntheticOnly:true};
}
{
 const capture=JSON.parse(await readFile('qa/v6/codex_capture_theme.json','utf8'));
 assert.equal(capture.passed,true);assert.equal(capture.version,report.source.version);assert.equal(capture.syntheticOnly,true);assert.equal(capture.dataIntact,true);assert.deepEqual(capture.errors,[]);assert.equal(capture.recordCount,16);
 assert.equal(Object.keys(capture.assets).length,15);assert.deepEqual(capture.globalEvents.map(event=>event.choice),['dark','light']);
 for(const event of capture.globalEvents){assert.equal(event.globalTheme,event.choice);assert.equal(event.pressed,true);assert.equal(event.dataIntact,true);}
 assert.deepEqual(capture.readerEvents.map(event=>event.dark),[true,false]);
 for(const event of capture.readerEvents){assert.equal(event.globalTheme,'light');assert.equal(event.classDark,event.dark);assert.equal(event.pressed,event.dark);}
 report.source.theme='light/dark';report.source.readerTheme='light/dark';
 report.themeSwitches={global:capture.globalEvents,reader:capture.readerEvents,recordCount:capture.recordCount,dataIntact:true};
}
{
 const capture=JSON.parse(await readFile('qa/v6/codex_capture_genre.json','utf8'));
 const genres=JSON.parse(await readFile('public/codex_genre/codex_assets.json','utf8'));
 assert(capture.passed&&capture.syntheticOnly&&capture.recordsUnchanged);assert.equal(capture.theme,'light');assert.equal(capture.version,genres.version);assert.deepEqual(capture.errors,[]);
 assert.equal(capture.majorCategories.length,16);assert.deepEqual(capture.majorCategories,genres.majorCategories);assert.deepEqual(capture.path,['电子','House','Deep House']);
 assert.equal(capture.houseChildren.length,17);assert.deepEqual(capture.houseChildren,genres.houseChildren);assert.equal(capture.selectedTags,'电子, House, Deep House');
 assert.deepEqual(Object.keys(capture.assets),['genre_overview','genre_electronic','genre_house','genre_selected']);
 report.genreHierarchy={version:capture.version,path:capture.path,majorCategories:capture.majorCategories,visibleMajorCategories:genres.visibleMajorCategories,houseChildren:capture.houseChildren,visibleHouseChildren:genres.visibleHouseChildren,selectedTags:capture.selectedTags,recordsUnchanged:true};
}
// Validate the retained manifests so cleanup cannot silently leave missing source assets.
for(const folder of ['codex_light','codex_theme_v5','codex_genre']){
 const manifest=JSON.parse(await readFile(`public/${folder}/codex_assets.json`,'utf8'));
 const sizes=JSON.parse(await readFile(`public/${folder}/codex_sizes.json`,'utf8'));
 for(const asset of Object.values(manifest.assets)){assert((await stat(`public/${folder}/${asset.file}`)).size>0);assert(sizes[asset.file]?.length===2);}
}
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});if(r.error)throw r.error;assert.equal(r.status,0,r.stderr);return r;}
function checkMusicContinuity(file){
 const scan=run('ffmpeg',['-hide_banner','-nostats','-i',file,'-vn','-af','atrim=start=0.1:end=58.8,silencedetect=noise=-45dB:d=0.5','-f','null','NUL']).stderr;
 assert(!scan.includes('silence_start:'),`Unexpected quiet music gap: ${file}\n${scan}`);
 const levels=run('ffmpeg',['-hide_banner','-nostats','-i',file,'-vn','-af','atrim=start=33.6:end=39.6,asetnsamples=n=24000:p=0,astats=reset=1:metadata=1,ametadata=print:key=lavfi.astats.Overall.RMS_level','-f','null','NUL']).stderr;
 const rms=[...levels.matchAll(/lavfi\.astats\.Overall\.RMS_level=([^\r\n]+)/g)].map(match=>Number(match[1]));
 assert.equal(rms.length,12,`Expected twelve half-second relisten windows: ${file}`);
 assert(rms.every(value=>Number.isFinite(value)&&value>=-38),`Relisten music too quiet: ${file} ${JSON.stringify(rms)}`);
 return {interiorStartSeconds:.1,interiorEndSeconds:58.8,silenceThresholdDbfs:-45,silenceDurationSeconds:.5,interiorGaps:0,relistenRmsFloorDbfs:-38,relistenMinimumRmsDbfs:Math.min(...rms),relistenRmsWindows:rms};
}
const mapped=new Map();
for(const format of ['portrait','landscape']){
 const file=path.join(root,`output/codex_xiaodongge_${format}${suffix}_1080p.mp4`);mapped.set(`/${format}.mp4`,file);
 const data=JSON.parse(run('ffprobe',['-v','error','-show_format','-show_streams','-of','json',file]).stdout);
 const video=data.streams.find(s=>s.codec_type==='video'),audio=data.streams.find(s=>s.codec_type==='audio');
 assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(video.r_frame_rate,'30/1');
 assert.equal(video.profile,'High');assert.equal(video.color_range,'tv');
 assert.equal(video.level,41);
 assert.equal(video.color_space,'bt709');
 for(const key of ['color_transfer','color_primaries'])assert.equal(video[key],'bt709');
 assert.equal(video.width,format==='portrait'?1080:1920);assert.equal(video.height,format==='portrait'?1920:1080);
 assert.equal(Number(video.nb_frames),expectedFrames);assert(Math.abs(Number(data.format.duration)-duration)<.08);assert(data.format.format_name.includes('mp4'));
 assert.equal(audio.codec_name,'aac');assert.equal(audio.channels,2);assert.equal(Number(audio.sample_rate),48000);
 const decode=run('ffmpeg',['-v','error','-i',file,'-f','null','NUL']);assert.equal(decode.stderr.trim(),'');
 const bytes=await readFile(file),boxes=[];
 for(let pos=0;pos+8<=bytes.length;){let size=bytes.readUInt32BE(pos);const type=bytes.toString('ascii',pos+4,pos+8);if(size===1)size=Number(bytes.readBigUInt64BE(pos+8));if(size===0)size=bytes.length-pos;assert(size>=8&&pos+size<=bytes.length);boxes.push(type);pos+=size;}
 assert(boxes.includes('moov')&&boxes.includes('mdat')&&boxes.indexOf('moov')<boxes.indexOf('mdat'),'MP4 faststart');
 const loud=run('ffmpeg',['-hide_banner','-i',file,'-af','loudnorm=I=-22:TP=-3.5:LRA=7:print_format=json','-f','null','NUL']).stderr;
 const loudness=JSON.parse(loud.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]??'null');assert(loudness);assert(Number(loudness.input_tp)<-1.8);assert(Number(loudness.input_i)>-19&&Number(loudness.input_i)<-17);
 const continuity=checkMusicContinuity(file);
 const black=run('ffmpeg',['-hide_banner','-i',file,'-an','-vf','blackdetect=d=0.1:pic_th=0.995:pix_th=0.015','-f','null','NUL']).stderr;
 assert(!black.includes('black_start:'),'Unexpected sustained blank frame');
 const shots=[0,.6,2.4,3.9,5.4,6.6,8.4,9.6,11.4,12.9,13.8,15.6,16.8,18.3,18.8,19.5,20.2,20.7,21.2,21.6,22.4,22.8,23.4,24,24.8,25.2,25.8,26.2,26.4,27,27.6,28.2,28.8,30,30.4,31.2,31.8,32.4,33.6,35.4,36.6,38.4,39.6,40.8,42,43.8,45.6,46.8,48.6,50.4,51.6,52.8,54.6,55.8,56.4,57.6,58.8,59.9];
 for(const sec of shots){run('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(sec),'-i',file,'-frames:v','1','-q:v','2',`${qa}/final_frames/codex_${format}_${String(Math.round(sec*10)).padStart(3,'0')}.jpg`]);}
 report.files.push({format,file,sizeBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),width:video.width,height:video.height,fps:video.r_frame_rate,frames:Number(video.nb_frames),duration:Number(data.format.duration),videoCodec:video.codec_name,pixelFormat:video.pix_fmt,videoBitrate:video.bit_rate,container:data.format.format_name,audio:{codec:audio.codec_name,sampleRate:audio.sample_rate,channels:audio.channels,loudness,continuity},faststart:true,fullDecode:true,sustainedBlankFrames:false,extractedFrames:shots});
 await writeFile(`${qa}/codex_ffprobe_${format}.json`,JSON.stringify(data,null,2));console.log('codec/decode/frames PASS',format);
}

// Bound to loopback, exact allowlist, no uploads or external network access.
const server=createServer(async(req,res)=>{
 const route=(req.url??'/').split('?')[0];
 if(route==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><title>小懂哥成片检查</title><body style="margin:0;background:#0b0f0d"><video style="width:100vw;height:100vh;object-fit:contain" muted playsinline></video></body>');return;}
 const file=mapped.get(route);if(!file){res.writeHead(404).end();return;}
 const {size}=await stat(file);let start=0,end=size-1;
 if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!m){res.writeHead(416).end();return;}start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;if(start>end||start>=size){res.writeHead(416).end();return;}}
 res.writeHead(req.headers.range?206:200,{'Content-Type':'video/mp4','Accept-Ranges':'bytes','Content-Length':end-start+1,...(req.headers.range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
 createReadStream(file,{start,end}).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 report.playback=await Promise.all(['portrait','landscape'].map(async format=>{
  const page=await browser.newPage({viewport:format==='portrait'?{width:540,height:960}:{width:960,height:540}});
  await page.goto(origin);const result=await page.evaluate(async({format,duration})=>{
   const video=document.querySelector('video');video.src=`/${format}.mp4`;let updates=0;video.addEventListener('timeupdate',()=>updates++);
   const finished=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Playback did not finish')),(duration+15)*1000);video.onended=()=>{clearTimeout(timer);resolve(null);};video.onerror=()=>reject(new Error(video.error?.message??'Media error'));});
   await video.play();await finished;const quality=video.getVideoPlaybackQuality();return{format,ended:video.ended,currentTime:video.currentTime,duration:video.duration,width:video.videoWidth,height:video.videoHeight,timeUpdates:updates,totalVideoFrames:quality.totalVideoFrames,droppedVideoFrames:quality.droppedVideoFrames};
  },{format,duration});
  assert(result.ended&&result.currentTime>=duration-.1&&result.timeUpdates>150);assert(result.totalVideoFrames>=expectedFrames-5);assert(result.droppedVideoFrames<Math.ceil(expectedFrames*.03));
  await page.screenshot({path:`${qa}/codex_playback_${format}.png`});await page.close();return result;
 }));
 run('python',['-B','scripts/codex_review_sheet.py','--final']);const frames=JSON.parse(await readFile(`${qa}/codex_theme_final_checks.json`,'utf8'));assert.equal(frames.passed,true);report.themeFrames=frames;
 report.passed=true;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await writeFile(`${qa}/codex_video_checks.json`,JSON.stringify(report,null,2));}
console.log(`PASS full ${duration}-second browser playback and delivery checks`);
