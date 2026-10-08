import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createServer} from 'vite';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),root=path.dirname(project);
const assets=path.join(project,'public/codex_theme_v5'),qa=path.join(project,'qa/v6');
await mkdir(assets,{recursive:true});await mkdir(qa,{recursive:true});process.chdir(root);
const demo=JSON.parse(await readFile(path.join(project,'public/codex_light/codex_demo_data.json'),'utf8'));
const previous=JSON.parse(await readFile(path.join(project,'public/codex_light/codex_assets.json'),'utf8'));
const version=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
assert.equal(version,previous.version,'Base UI and theme capture must use the same App version');
const covers=await Promise.all(demo.entries.map(async(_,i)=>'data:image/png;base64,'+(await readFile(path.join(project,`public/codex_light/codex_cover_${String(i).padStart(2,'0')}.png`))).toString('base64')));
const server=await createServer({configFile:path.join(root,'mobile/vite.config.ts'),cacheDir:path.join(project,'.cache/vite_theme_v5'),server:{host:'127.0.0.1',port:0,strictPort:true,forwardConsole:false}});
await server.listen();const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,timezoneId:'Asia/Shanghai',locale:'zh-CN',colorScheme:'light'});
const page=await context.newPage();page.setDefaultTimeout(15000);
await page.clock.setFixedTime(new Date('2026-09-29T12:00:00+08:00'));
const errors=[],manifest={version,viewport:{width:390,height:844,scale:3},capture:'Actual theme buttons; isolated synthetic data and original light covers',assets:{},palette:{},layout:{},globalEvents:[],readerEvents:[]};
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/*',route=>{try{if(new URL(route.request().url()).origin===origin)return route.continue();}catch{}return route.abort();});
const goto=async(route,selector)=>{await page.goto(origin+'/#'+route);await page.locator(selector).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);};
const palette=()=>page.evaluate(()=>{const css=getComputedStyle(document.documentElement);return Object.fromEntries(['--paper-soft','--paper','--ink','--muted','--amber','--amber-ink','--line','--neu-ink','--on-deep','--green-900'].map(key=>[key,css.getPropertyValue(key).trim()]));});
const snapshot=()=>page.evaluate(()=>({entries:localStorage.getItem('music-feelings-mobile-entries'),appData:localStorage.getItem('music-feelings-mobile-app-data')}));
const readerCheck=()=>page.locator('.codex-reader').evaluate(el=>({globalTheme:document.documentElement.dataset.theme,dark:JSON.parse(localStorage.getItem('codex-reading-preferences-v1')).dark,classDark:el.classList.contains('codex-reader-dark'),paper:getComputedStyle(el).getPropertyValue('--paper').trim(),ink:getComputedStyle(el).getPropertyValue('--ink').trim()}));
const png=async(name,globalTheme,locator)=>{
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),globalTheme);
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
 const file=`codex_${name}.png`,dest=path.join(assets,file);
 if(locator)await locator.screenshot({path:dest,animations:'disabled',style:'.app-header,.bottom-nav{visibility:hidden!important}'});
 else await page.screenshot({path:dest,animations:'disabled'});
 manifest.assets[name]={file,globalTheme,route:page.url().replace(origin,''),source:locator?'Actual DOM crop; only app header and bottom navigation hidden during capture':'Unmodified current mobile DOM',...(locator?{selector:locator.toString()}:{} )};
 console.log('captured',name);
};
try{
 await page.goto(origin+'/#/privacy');
 await page.evaluate(({demo})=>{localStorage.setItem('music-feelings-mobile-entries',JSON.stringify(demo.entries));localStorage.setItem('music-feelings-mobile-app-data',JSON.stringify({'top-albums:2026':JSON.stringify(demo.top)}));localStorage.setItem('abu-theme-choice-v1','light');localStorage.setItem('codex-reading-preferences-v1',JSON.stringify({size:'normal',dark:false}));},{demo});
 await page.reload();
 await page.evaluate(async({entries,covers})=>{const {store}=await import('/src/store.ts');for(let i=0;i<entries.length;i++){const image=new Image();image.src=covers[i];await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=768;canvas.getContext('2d').drawImage(image,0,0);await store.setCover('album',entries[i],canvas.toDataURL('image/jpeg',.87));}},{entries:demo.entries,covers});
 // Reproduce the preceding saved quick note so the film retains the same 16 records.
 await goto('/capture','.quick-capture-page');await page.locator('details.quick-extras > summary').click();
 for(const [label,value] of [['标题','风停以后'],['歌手','林间电台'],['专辑','风停以后']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.locator('details.quick-extras > summary').click();await page.getByLabel('一句话感受',{exact:true}).fill('风停了，耳机里的那一点温柔还在。');
 await page.getByRole('button',{name:'保存专辑听感',exact:true}).click();await page.locator('.codex-reader').waitFor();
 manifest.palette.light=await palette();
 await goto('/','.home-page');await png('theme_home_light','light');
 const original=await snapshot(); // Home initializes its daily resurfacing state before theme-only comparisons.
 manifest.recordCount=JSON.parse(original.entries).length;assert.equal(manifest.recordCount,demo.entries.length+1);
 await goto('/more','.theme-choice');
 const choice=page.locator('.theme-choice'),panel=choice.locator('..');
 await choice.scrollIntoViewIfNeeded();
 manifest.layout.appearance=await panel.evaluate(el=>{const box=el.getBoundingClientRect();return Object.fromEntries([...el.querySelectorAll('.theme-choice button')].map(button=>{const rect=button.getBoundingClientRect();return[button.textContent,{centerX:Math.round((rect.x+rect.width/2-box.x)*3),centerY:Math.round((rect.y+rect.height/2-box.y)*3)}];}));});
 await png('theme_appearance_light','light',panel);
 for(const [value,label] of [['dark','深色'],['light','浅色']]){
  if(value==='light'){await goto('/more','.theme-choice');await choice.scrollIntoViewIfNeeded();}
  await choice.getByRole('button',{name:label,exact:true}).click();
  assert.equal(await choice.getByRole('button',{name:label,exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>localStorage.getItem('abu-theme-choice-v1')),value);
  assert.deepEqual(await snapshot(),original,'Theme change must preserve records and ranking data');
  const event={choice:value,label,globalTheme:await page.evaluate(()=>document.documentElement.dataset.theme),pressed:true,dataIntact:true};assert.equal(event.globalTheme,value);manifest.globalEvents.push(event);
  if(value==='dark')manifest.palette.dark=await palette();
  await png(value==='dark'?'theme_appearance_dark':'theme_appearance_light_after',value,panel);
  await goto('/','.home-page');await png(value==='dark'?'theme_home_dark':'theme_home_light_after',value);
 }
 await goto('/entries/'+demo.entries[0].id,'.codex-reader');
 manifest.layout.readerHeroTop=Math.round((await page.locator('.detail-hero').boundingBox()).y*3);
 const initial=await readerCheck();assert.equal(initial.dark,false);assert.equal(initial.classDark,false);manifest.readerInitial=initial;
 await png('theme_reader_light','light');
 const menu=page.locator('.codex-reader-menu'),summary=menu.locator('summary'),settings=page.locator('.codex-reader-settings');
 await summary.click();
 manifest.layout.readerControl=await settings.evaluate(el=>{const box=el.getBoundingClientRect(),button=el.querySelector('button').getBoundingClientRect();return{centerX:Math.round((button.x+button.width/2-box.x)*3),centerY:Math.round((button.y+button.height/2-box.y)*3)};});
 await png('theme_reader_menu_light','light');await png('theme_reader_controls_light','light',settings);
 await settings.getByRole('button',{name:'深色',exact:true}).click();
 const dark=await readerCheck();assert.equal(dark.dark,true);assert.equal(dark.classDark,true);assert.equal(dark.globalTheme,'light');
 assert.equal(await settings.getByRole('button',{name:'浅色',exact:true}).getAttribute('aria-pressed'),'true');manifest.readerEvents.push({...dark,pressed:true,clicked:'深色'});
 await png('theme_reader_menu_dark','light');await png('theme_reader_controls_dark','light',settings);
 await summary.click();await png('theme_reader_dark','light');
 await summary.click();
 await settings.getByRole('button',{name:'浅色',exact:true}).click();
 const light=await readerCheck();assert.equal(light.dark,false);assert.equal(light.classDark,false);assert.equal(light.globalTheme,'light');
 assert.equal(await settings.getByRole('button',{name:'深色',exact:true}).getAttribute('aria-pressed'),'false');manifest.readerEvents.push({...light,pressed:false,clicked:'浅色'});
 await png('theme_reader_menu_light_after','light');await png('theme_reader_controls_light_after','light',settings);
 await summary.click();await png('theme_reader_light_after','light');
 assert.deepEqual(await snapshot(),original);assert.deepEqual(errors,[]);
 manifest.dataIntact=true;manifest.syntheticOnly=true;manifest.errors=errors;manifest.generatedAt=new Date().toISOString();
 await writeFile(path.join(assets,'codex_assets.json'),JSON.stringify(manifest,null,2));
 await writeFile(path.join(qa,'codex_capture_theme.json'),JSON.stringify({passed:true,...manifest},null,2));
 execFileSync('python',[path.join(project,'scripts/codex_contact.py'),'--theme'],{stdio:'inherit',windowsHide:true});
 console.log('PASS actual global and reader switches',Object.keys(manifest.assets).length);
}catch(error){await writeFile(path.join(qa,'codex_capture_theme_error.txt'),String(error.stack));await page.screenshot({path:path.join(qa,'codex_capture_theme_error.png')});throw error;}
finally{await browser.close();await server.close();}
