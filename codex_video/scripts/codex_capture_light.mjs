import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.dirname(project), assets=path.join(project,'public/codex_light'),qa=path.join(project,'qa/v6');
await mkdir(assets,{recursive:true});
await mkdir(qa,{recursive:true});
process.chdir(root);
const server=await createServer({configFile:path.join(root,'mobile/vite.config.ts'),cacheDir:path.join(project,'.cache/vite_light'),server:{host:'127.0.0.1',port:0,strictPort:true,forwardConsole:false}});
await server.listen();
const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,timezoneId:'Asia/Shanghai',locale:'zh-CN',colorScheme:'light'});
const page=await context.newPage();
await page.clock.setFixedTime(new Date('2026-09-29T12:00:00+08:00'));
const appVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const errors=[],manifest={version:appVersion,theme:'light',readerTheme:'light',capture:'Current React mobile UI; isolated synthetic data; actual light theme',viewport:{width:390,height:844,scale:3},assets:{},layout:{}};
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(15000);
await page.route('**/*',route=>{try {if(new URL(route.request().url()).origin===origin)return route.continue();}catch{}return route.abort();});
const names=['晚风经过','潮汐记','房间里的回声','夜行列车','未完成的夏天','小岛来信','低速飞行','晴天后的房间','城市边缘','静默的河','蓝色钟摆','远处的灯','山海之间','无声散步','慢行'];
const passages=[
 '最先留住我的，是鼓点之间的空白。\n\n贝斯慢慢向前走，人声像隔着一扇半开的窗。那时我只觉得它很安静，适合把回家的路再走慢一点。\n\n听到最后一首，我没有立刻摘下耳机。风从身边过去，音乐留下了一点温度。',
 '那些克制的鼓点，把一整天的嘈杂轻轻放下。\n\n编曲并不急着铺满每一个空隙。留白里的呼吸，反而是最动人的部分。',
 '一层一层的器乐，像夜色里的灯。\n\n今天喜欢它的温柔，也想记住自己曾经听见过这样的光。'];
const entries=names.map((name,i)=>{const month=(i*2)%9+1,day=6+i;
 const date=i===0?'2026-02-18T12:00:00.000Z':`2026-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T12:00:00.000Z`;
 return {id:`codex-film-album-${i}`,type:'album',title:name,year:2026,month:i===0?2:month,albumName:name,songName:null,artistName:'林间电台',musicMetadata:null,content:passages[i%3],tags:i%2?['Ambient Pop','留白']:['Dream Pop','空间感'],moods:i===0?['平静','怀旧']:i%3?['温暖','平静']:['释然'],rating:i===0?8:9.5-(i%5)*.5,ratingModifier:null,ratingProduction:i===0?8:null,ratingSongwriting:null,ratingLyrics:i===0?8:null,ratingComposition:i===0?8:null,ratingVocals:i===0?8:null,ratingOriginality:i===0?7.5:null,ratingResonance:i===0?8.5:null,compositeRatingLocked:false,firstListenedAt:date,listenedAt:date,createdAt:date,updatedAt:date};});
const top={albums:entries.map((e,i)=>({albumName:e.albumName,artistName:e.artistName,note:i===0?'今年反复回到的一张。每次重听，都多听见一点自己。':'把那些舍不得忘记的声音，留在这一年的档案里。'}))};
const png=async(name,locator)=>{
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
 await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(250);
 const dest=path.join(assets,`codex_${name}.png`);
 if(locator){await locator.screenshot({path:dest,animations:'disabled',style:'.app-header,.bottom-nav,.codex-reader-toolbar,.entry-save-actions{visibility:hidden!important}'});}else await page.screenshot({path:dest,animations:'disabled'});
 manifest.assets[name]={file:`codex_${name}.png`,route:page.url().replace(origin,''),source:locator?'Current DOM crop; fixed header, bottom navigation, reading toolbar and save actions hidden only while capturing':'Unmodified current mobile DOM',...(locator?{selector:locator.toString()}:{} )};
 console.log('captured',name);
};
const goto=async(route,selector)=>{await page.goto(origin+'/#'+route);await page.locator(selector).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(350);};
try {
 await page.goto(origin+'/#/privacy');
 await page.evaluate(({entries,top})=>{
  localStorage.setItem('music-feelings-mobile-entries',JSON.stringify(entries));
  localStorage.setItem('music-feelings-mobile-app-data',JSON.stringify({'top-albums:2026':JSON.stringify(top)}));
  localStorage.setItem('abu-theme-choice-v1','light');
  localStorage.setItem('codex-reading-preferences-v1',JSON.stringify({size:'normal',dark:false}));
 },{entries,top});
 await page.reload();
 const generated=await page.evaluate(async({entries})=>{
  const {store}=await import('/src/store.ts');
  const css=getComputedStyle(document.documentElement);
  const palette=Object.fromEntries(['--paper-soft','--paper','--ink','--muted','--amber','--amber-ink','--line','--neu-ink','--on-deep','--green-900'].map(k=>[k,css.getPropertyValue(k).trim()]));
  const colors=[palette['--paper-soft'],palette['--paper'],palette['--line'],palette['--amber'],palette['--neu-ink']];
  const covers=[];
  for(let i=0;i<entries.length;i++){
   const c=document.createElement('canvas');c.width=c.height=768;const x=c.getContext('2d');
   x.fillStyle=colors[0];x.fillRect(0,0,768,768);
   const g=x.createLinearGradient(0,0,768,768);g.addColorStop(0,colors[i%2?2:1]);g.addColorStop(1,colors[0]);x.fillStyle=g;x.fillRect(0,0,768,768);
   x.save();x.translate(384,335);x.rotate((i%5-2)*.12);
   if(i%3===0){for(let n=0;n<72;n++){x.strokeStyle=colors[n%9===0?3:4];x.globalAlpha=.30+n/170;x.lineWidth=n%9===0?2.8:1.2;x.beginPath();x.ellipse(0,0,46+n*3.5,46+n*2.3,0,0,Math.PI*2);x.stroke();}}
   if(i%3===1){for(let n=0;n<17;n++){x.globalAlpha=.15+n/30;x.fillStyle=colors[n%2?3:4];x.fillRect(-260+n*18,-240+n*18,40,400-n*12);}}
   if(i%3===2){for(let n=0;n<45;n++){x.globalAlpha=.4;x.strokeStyle=colors[n%5?4:3];x.lineWidth=1.4;x.beginPath();for(let j=-300;j<=300;j+=4){const y=Math.sin(j/100+n*.09)*90+(n-22)*7;j===-300?x.moveTo(j,y):x.lineTo(j,y);}x.stroke();}}
   x.restore();x.globalAlpha=1;x.fillStyle=colors[4];x.font='500 42px "Microsoft YaHei", sans-serif';x.fillText(entries[i].albumName,56,638);
   x.globalAlpha=.68;x.font='18px sans-serif';x.fillText('LINJIAN RADIO   /   STUDY '+String(i+1).padStart(2,'0'),58,684);
   x.strokeStyle=colors[3];x.lineWidth=1;x.strokeRect(25,25,718,718);
   const data=c.toDataURL('image/png');await store.setCover('album',entries[i],c.toDataURL('image/jpeg',.87));covers.push(data); // ponytail: 15 covers fit Web Storage; PNG masters stay outside storage.
  }
  return {palette,covers};
 },{entries});
 manifest.palette=generated.palette;
 for(let i=0;i<generated.covers.length;i++){
  const name=`cover_${String(i).padStart(2,'0')}`,file=`codex_${name}.png`;
  await writeFile(path.join(assets,file),Buffer.from(generated.covers[i].split(',')[1],'base64'));
  manifest.assets[name]={file,source:'Original light geometric cover generated by scripts/codex_capture_light.mjs; fictional demonstration artwork',size:[768,768]};
 }
 await writeFile(path.join(assets,'codex_demo_data.json'),JSON.stringify({disclosure:'Fictional demonstration only; all works, artist names and reviews are synthetic.',entries,top},null,2));
 await copyFile(path.join(root,'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'),path.join(assets,'codex_app_icon.png'));
 manifest.assets.app_icon={file:'codex_app_icon.png',source:'Unmodified project icon: android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',size:[192,192]};
 await copyFile(path.join(root,'mobile/src/assets/fonts/codex_noto_sans_sc.woff2'),path.join(assets,'codex_noto_sans_sc.woff2'));
 await copyFile(path.join(root,'mobile/public/codex_font_licenses.txt'),path.join(assets,'codex_font_licenses.txt'));

 await goto('/entries/'+entries[0].id,'.detail-hero');
 await page.locator('.detail-hero img').evaluate(img=>img.decode());
 manifest.layout.archiveCover=await page.locator('.detail-hero').evaluate(el=>{const parent=el.getBoundingClientRect(),image=el.querySelector('img').getBoundingClientRect();return{x:Math.round((image.x-parent.x)*3),y:Math.round((image.y-parent.y)*3),width:Math.round(image.width*3)};});
 manifest.layout.readerHeroTop=Math.round((await page.locator('.detail-hero').boundingBox()).y*3);
 manifest.readerChecks=await page.locator('.codex-reader').evaluate(el=>({preferenceDark:JSON.parse(localStorage.getItem('codex-reading-preferences-v1')).dark,paper:getComputedStyle(el).getPropertyValue('--paper').trim(),ink:getComputedStyle(el).getPropertyValue('--ink').trim()}));
 assert.equal(manifest.readerChecks.preferenceDark,false);
 await png('reader');await png('archive_card',page.locator('.detail-hero'));

 await goto('/capture','.quick-capture-page');
 await page.locator('details.quick-extras > summary').click();
 await page.getByLabel('标题',{exact:true}).fill('风停以后');
 await page.getByLabel('歌手',{exact:true}).fill('林间电台');
 await page.getByLabel('专辑',{exact:true}).fill('风停以后');
 await page.locator('details.quick-extras > summary').click();
 await page.evaluate(()=>window.scrollTo(0,0));await png('quick_empty');
 await page.getByLabel('一句话感受',{exact:true}).fill('风停了，耳机里的那一点温柔还在。');
 await page.locator('textarea').blur();await page.evaluate(()=>window.scrollTo(0,0));await png('quick_filled');
 const saveBox=await page.getByRole('button',{name:'保存专辑听感',exact:true}).boundingBox();
 assert(saveBox.y>=0&&saveBox.y+saveBox.height<=844,'Save button must fit the real capture');
 manifest.layout.quickSaveButton={centerX:Math.round((saveBox.x+saveBox.width/2)*3),centerY:Math.round((saveBox.y+saveBox.height/2)*3)};
 await page.getByRole('button',{name:'保存专辑听感',exact:true}).click();
 await page.locator('.codex-reader').waitFor();await png('quick_saved');
 manifest.layout.quickSavedTop=Math.round((await page.locator('.codex-reader-resume').boundingBox()).y*3);

 await goto('/entries/'+entries[0].id+'/edit','.writing-form');
 manifest.layout.dimensions=await page.locator('.multi-dimension-grid').evaluate(el=>{const parent=el.getBoundingClientRect();return [...el.querySelectorAll('.rating-slider-section')].map(node=>{const rect=node.getBoundingClientRect();return{y:Math.round((rect.y-parent.y)*3),height:Math.round(rect.height*3),label:node.querySelector('strong').textContent};});});
 assert.deepEqual(manifest.layout.dimensions.map(row=>row.label),['制作','词','曲','人声','原创性','共鸣']);
 await png('dimensions',page.locator('.multi-dimension-grid'));
 await png('rating',page.locator('.rating-slider-section').first());
 await png('moods',page.locator('.choice-panel').filter({has:page.locator('[aria-label="二级情绪"]')}));
 await page.getByLabel('搜索曲风',{exact:true}).fill('Dream');
 await png('genre_result',page.locator('.genre-search-groups'));
 await page.locator('.multi-dimension-grid').getByRole('slider').first().press('ArrowRight');await page.locator('.multi-dimension-grid').getByRole('slider').first().evaluate(el=>el.blur());await png('dimensions_after',page.locator('.multi-dimension-grid'));

 await goto('/relisten/'+entries[0].id,'.relisten-form');
 const blind=await page.locator('.relisten-page').innerText();assert(!blind.includes(entries[0].content),'Old review hidden before submit');
 await page.getByRole('slider').first().focus();await page.keyboard.press('End');await page.keyboard.press('ArrowLeft');
 await page.getByRole('button',{name:'温暖',exact:true}).click();
 await page.getByRole('button',{name:'释然',exact:true}).click();
 await page.getByLabel('一句话感受',{exact:true}).fill('从前听见孤独，现在听见陪伴。音乐没变，走过的路多了一些。');
 await page.evaluate(()=>window.scrollTo(0,0));await png('relisten_blind');
 const blindBox=await page.locator('.relisten-page').boundingBox(),blindRating=await page.locator('.relisten-form .rating-slider-section').first().boundingBox();
 manifest.layout.relisten={top:Math.round(blindBox.y*3),introHeight:Math.round((blindRating.y-blindBox.y)*3),ratingHeight:Math.round((blindRating.y+blindRating.height-blindBox.y)*3)};
 assert(blindRating.y+blindRating.height<=844,'Blind rating must fit the real capture');
 await page.getByRole('button',{name:'保存并揭晓',exact:true}).click();await page.locator('.relisten-reveal').waitFor();
 await page.evaluate(()=>window.scrollTo(0,0));
 await png('comparison_score',page.locator('.relisten-rating-change'));await png('relisten_words',page.locator('.relisten-quotes blockquote').last());

 await goto('/summary?year=2026&view=months','.journal-month-grid');await png('months_grid',page.locator('.journal-month-grid'));
 manifest.layout.months=await page.locator('.journal-month-grid').evaluate(el=>{const parent=el.getBoundingClientRect();return [...el.children].map(node=>{const rect=node.getBoundingClientRect();return{y:Math.round((rect.y-parent.y)*3),height:Math.round(rect.height*3)};});});
 assert.equal(manifest.layout.months.length,12);
 await goto('/summary?year=2026&view=cover&cover='+entries[0].id,'.journal-cover');await png('yearbook');await png('year_facts',page.locator('.journal-facts').first());
 await goto('/summary?year=2026&view=rank','.journal-rank-list');
 const posters=await page.evaluate(async({entries,top})=>{const {planJournalPages,renderJournalPage}=await import('/src/codex_yearbookPages.ts');const options={topAlbums:top,theme:'paper'};const plan=await planJournalPages(2026,entries,'rank',options);const result=[];for(let i=0;i<plan.length;i++){const blob=await renderJournalPage(2026,entries,plan[i],i,plan.length,new Date('2026-09-29T12:00:00+08:00'),options);result.push(await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);}));}return result;},{entries,top});
 for(let i=0;i<posters.length;i++){await writeFile(path.join(assets,`codex_poster_${i+1}.png`),Buffer.from(posters[i].split(',')[1],'base64'));manifest.assets[`poster_${i+1}`]={file:`codex_poster_${i+1}.png`,source:'Current planJournalPages + renderJournalPage; no layout changes',size:[1080,1680]};}
 assert.equal(posters.length,3);assert.deepEqual(errors,[]);
 manifest.errors=errors;manifest.generatedAt=new Date().toISOString();
 await writeFile(path.join(assets,'codex_assets.json'),JSON.stringify(manifest,null,2));
 await writeFile(path.join(qa,'codex_capture_light.json'),JSON.stringify({passed:true,version:appVersion,theme:'light',readerChecks:manifest.readerChecks,layout:manifest.layout,errors,assets:Object.keys(manifest.assets),syntheticOnly:true},null,2));
 execFileSync('python',[path.join(project,'scripts/codex_contact.py'),'--light'],{stdio:'inherit',windowsHide:true});
 console.log('PASS real UI capture',Object.keys(manifest.assets).length);
} catch(error) {
 await writeFile(path.join(qa,'codex_capture_light_error.txt'),String(error.stack));
 await page.screenshot({path:path.join(qa,'codex_capture_light_error.png')});
 throw error;
} finally {await browser.close();await server.close();}
