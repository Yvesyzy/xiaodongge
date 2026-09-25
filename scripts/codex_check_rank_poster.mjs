import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { makeJournalFixtures } from '../mobile/codex_journal_fixtures.mjs';
import { qaOptions } from './codex_qa_options.mjs';
const { origin, output } = qaOptions({ origin: 'http://127.0.0.1:5186', output: 'release/codex_v29_rank_qa' });
await mkdir(output,{recursive:true});
const base=makeJournalFixtures('6')[0];
const names=['夜行列车','潮汐记','未完成的夏天','房间里的回声','最后一班渡轮'];
const entries=Array.from({length:15},(_,i)=>({...base,id:`codex-rank-${i}`,type:'album',albumName:names[i] || `专辑 ${i+1}`,artistName:`音乐人 ${i+1}`,rating:9,ratingModifier:i===0?'+':null}));
const albums=entries.map(e=>({albumName:e.albumName,artistName:e.artistName,note:'最常在回家路上点开的一张。鼓声很轻，贝斯一直往前走。听到最后一首才舍得摘耳机。'}));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);
 await page.evaluate(async ({entries,albums})=>{
  localStorage.clear();localStorage.setItem('music-feelings-mobile-entries',JSON.stringify(entries));
  localStorage.setItem('music-feelings-mobile-app-data',JSON.stringify({'top-albums:2026':JSON.stringify({albums})}));
  const {store}=await import('/src/store.ts');
  window.makeCover=(i)=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle=`hsl(${i*23} 38% 42%)`;x.fillRect(0,0,512,512);x.fillStyle='#e6d6b4';x.fillRect(36,36,440,300);x.fillStyle='#284d47';x.fillRect(72,72,368,264);x.fillStyle='#f2f1eb';x.font='bold 42px sans-serif';x.fillText(albums[i]?.albumName || '新封面',36,450);return c.toDataURL();};
  for(const [i,a] of albums.entries())await store.setCover('album',a,window.makeCover(i));
 },{entries,albums});
 const result=await page.evaluate(async({entries,albums})=>{
  const mod=await import('/src/codex_yearbookPages.ts');const {store}=await import('/src/store.ts');
  const eq=(yes,message)=>{if(!yes)throw new Error(message);};
  const labels=[],images=[];let recording=false;
  const fill=CanvasRenderingContext2D.prototype.fillText,draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){if(recording){const m=this.measureText(value);labels.push({value,x,y,left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent,font:this.font});}return fill.call(this,value,x,y,...rest);};
  CanvasRenderingContext2D.prototype.drawImage=function(image,...coords){if(recording&&coords.length===8)images.push(coords.slice(4));return draw.call(this,image,...coords);};
  const render=async(plan,options,idx)=>{labels.length=0;images.length=0;recording=true;const blob=await mod.renderJournalPage(2026,entries,plan[idx],idx,plan.length,new Date(2026,8,15),options);recording=false;const bitmap=await createImageBitmap(blob);eq(bitmap.width===1080&&bitmap.height===1680,'PNG尺寸');const c=document.createElement('canvas');c.width=1080;c.height=1680;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();return {data:c.toDataURL(),pixel:(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data)};};
  const shots=[];let groups=0;
  for(let count=1;count<=15;count++){
   const options={topAlbums:{albums:albums.slice(0,count)}};const plan=await mod.planJournalPages(2026,entries,'rank',options);
   eq(plan.length===Math.ceil(count/5),'页数');
   eq(plan.at(-1).rankSlots[0].rank===1,'冠军组最后展示');
   eq(plan.flatMap(p=>p.rankSlots).map(s=>s.rank).sort((a,b)=>a-b).join()===Array.from({length:count},(_,i)=>i+1).join(),'名次完整');
   for(const [i,p] of plan.entries()){
    const r=await render(plan,options,i);groups++;
    eq(images.length===p.rankSlots.length,'真实封面全部加载');
    for(const [n,[x,y,w,h]] of images.entries()){eq(x>=72&&x+w<=1008&&y>=272&&y+h<880,'封面边界');for(const [bx,by,bw,bh] of images.slice(n+1))eq(x+w<=bx||bx+bw<=x||y+h<=by||by+bh<=y,'封面重叠');}
    for(const t of labels)eq(t.left>=60&&t.right<=1012&&t.top>=60&&t.bottom<=1645,`文字边界${JSON.stringify(t)}`);
    eq(p.rankSlots.every(s=>s.notes.join('')===albums[s.rank-1].note),'普通理由保留完整');
    if(count===15){shots.push(r.data);if(p.rankSlots[0].rank===1)eq(images[0][2]===460&&images.slice(1).every(b=>b[2]===224),'冠军放大');}
   }
  }
  eq(document.fonts.check('900 70px "Codex Rank Sans"','年度专辑')&&document.fonts.check('900 140px "Codex Rank Numbers"','2026'),'离线字体已加载');
  // Same title with another artist must not replace the selected album's cover.
  await store.setCover('album',{...albums[0],artistName:'另一艺人'},window.makeCover(14));
  let options={topAlbums:{albums:albums.slice(0,5)}};let plan=await mod.planJournalPages(2026,[], 'rank',options);
  const saved=await render(plan,options,0);eq(images.length===5,'删除记录后仍复用保存封面');
  await store.setCover('album',albums[0],window.makeCover(14));plan=await mod.planJournalPages(2026,entries,'rank',options);
  const changed=await render(plan,options,0);eq(saved.pixel(85,345).join()!==changed.pixel(85,345).join(),'更换封面后刷新缓存');
  const normalizedEntry={...entries[0],albumName:' 夜行列车 ',artistName:'音乐人 1 ',rating:7.5,musicMetadata:{catalogAlbumId:'rank-first'}};
  const normalized=await mod.planJournalPages(2026,[normalizedEntry],'rank',{topAlbums:{albums:[albums[0]]}});
  eq(normalized[0].rankSlots[0].entry?.id===normalizedEntry.id&&normalized[0].rankSlots[0].meta.includes('7.5'),'空格变化后仍定位唯一来源和当前评分');
  const duplicate={...normalizedEntry,id:'rank-other-id',musicMetadata:{catalogAlbumId:'rank-second'}};
  const ambiguous=await mod.planJournalPages(2026,[normalizedEntry,duplicate],'rank',{topAlbums:{albums:[albums[0]]}});
  eq(!ambiguous[0].rankSlots[0].entry&&ambiguous[0].rankSlots[0].meta.includes('同名来源不明确'),'同名不同目录 ID 不得任意选一条来源');
  const long={albumName:'标题👨‍👩‍👧‍👦é'.repeat(40),artistName:'音乐人'.repeat(100),note:'理由👨‍👩‍👧‍👦é'.repeat(180)};
  options={topAlbums:{albums:[long]}};plan=await mod.planJournalPages(2026,entries,'rank',options);
  const s=plan[0].rankSlots[0];eq(s.name.endsWith('…')&&s.meta.endsWith('…')&&s.notes.length===2&&s.notes.at(-1).endsWith('…'),'长文本明确省略');eq(s.name.startsWith('标题')&&s.meta.startsWith('音乐人'),'省略号前保留原文前缀');eq(!s.name.includes('\ufffd'),'emoji未破坏');
  eq(s.originalName===long.albumName&&s.originalNote===long.note&&s.noteTruncated&&!s.coverAvailable,'预检保留实际裁切来源与封面占位状态');
  await render(plan,options,0);eq(images.length===0,'无封面走占位');for(const t of labels)eq(t.right<=1012&&t.bottom<=1645,'长文本边界');
  options={topAlbums:{albums:[long]},includeFullRankNotes:true};plan=await mod.planJournalPages(2026,entries,'rank',options);
  eq(plan.length>1&&plan.slice(1).every(p=>p.kind==='rank-appendix'),'完整理由附页计入真实页数');
  eq(plan.slice(1).flatMap(p=>p.lines).join('').includes(long.note.replaceAll('\n','')),'附页保留完整中文、emoji与原文顺序');
  const appendix=await render(plan,options,1);eq(appendix.data.startsWith('data:image/png;base64,'),'附页实际渲染');
  const darkAppendix=await render(plan,{...options,theme:'dark'},1);eq(appendix.pixel(0,0).join()!==darkAppendix.pixel(0,0).join(),'完整附页支持明暗主题');
  const multiline=await mod.planJournalPages(2026,entries,'rank',{topAlbums:{albums:[{...albums[0],note:'第一段\n\n第二段🙂'}, {...albums[1],note:'第三段'}]},includeFullRankNotes:true});
  const appendixLines=multiline.slice(1).flatMap(p=>p.lines);
  eq(appendixLines.includes('')&&appendixLines.join('').indexOf('第一段')<appendixLines.join('').indexOf('第二段🙂')&&appendixLines.join('').indexOf('第二段🙂')<appendixLines.join('').indexOf('第三段'),'换行和多专辑原文顺序保留');
  const hidden=await mod.planJournalPages(2026,entries,'rank',{...options,hideContent:true});
  eq(hidden.length===1&&hidden[0].rankSlots[0].originalNote===''&&hidden[0].rankSlots[0].notes.length===0,'隐藏正文时预检及附页均无理由');
  for(let mask=0;mask<16;mask++){
   const combo={topAlbums:{albums:[long]},includeFullRankNotes:true,hideContent:!!(mask&1),hideRating:!!(mask&2),hideDate:!!(mask&4),hideBrand:!!(mask&8)};
   const planned=await mod.planJournalPages(2026,entries,'rank',combo);
   eq((planned.length>1)===!combo.hideContent,`隐私组合 ${mask} 的附页状态`);
   eq(planned[0].rankSlots[0].originalNote===(combo.hideContent?'':long.note),`隐私组合 ${mask} 的预检来源`);
   if(mask===0||mask===15){const themed={...combo,theme:mask===0?'paper':'dark'};await render(planned,themed,0);if(planned.length>1)await render(planned,themed,planned.length-1);eq(!combo.hideContent||!labels.some(t=>t.value.includes('理由👨')),'隐藏正文不得进入渲染文字');}
  }
  for(const flag of ['hideBrand','hideDate','hideRating','hideContent']){
   options={topAlbums:{albums:albums.slice(0,5)},[flag]:true};plan=await mod.planJournalPages(2026,entries,'rank',options);await render(plan,options,0);
   if(flag==='hideBrand')eq(!labels.some(t=>t.value==='小懂哥'),'隐藏应用名');if(flag==='hideDate')eq(!labels.some(t=>t.value.startsWith('整理于')),'隐藏日期');
   if(flag==='hideRating')eq(!labels.some(t=>t.value.includes('/ 10')),'隐藏评分');if(flag==='hideContent')eq(plan[0].rankSlots.every(s=>s.notes.length===0),'隐藏理由');
  }
  let empty=false;try{await mod.planJournalPages(2026,entries,'rank',{topAlbums:{albums:[]}});}catch{empty=true;}eq(empty,'空榜单应反馈错误');
  CanvasRenderingContext2D.prototype.fillText=fill;CanvasRenderingContext2D.prototype.drawImage=draw;
  return {shots,groups,appendixShot:appendix.data};
 },{entries,albums});
 for(const [i,data] of result.shots.entries())await writeFile(`${output}/codex_rank_${i+1}.png`,Buffer.from(data.split(',')[1],'base64'));
 await writeFile(`${output}/codex_rank_full_reason.png`,Buffer.from(result.appendixShot.split(',')[1],'base64'));
 await page.goto(`${origin}/#/summary?year=2026&view=rank`);
 await page.getByRole('button',{name:/保存榜单图片/}).click();
 await page.locator('.journal-export-preview').waitFor();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下载当前页 PNG',exact:true}).click();assert.equal((await download).suggestedFilename(),'xiaodongge-2026-rank-001-of-3.png');
 await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('music-feelings-mobile-app-data'));data['top-albums:2026']=JSON.stringify({albums:[{albumName:'只有榜单的专辑',artistName:'已删除艺人',note:'私密标记Q8🙂\n第二段 é\n'.repeat(25)}]});localStorage.setItem('music-feelings-mobile-app-data',JSON.stringify(data));});
 await page.reload();await page.getByRole('button',{name:/保存榜单图片/}).click();
 await page.getByText(/封面不可用，海报使用文字占位/).waitFor();
 await page.getByText(/入选理由超过海报两行/).waitFor();
 await page.getByRole('checkbox',{name:'附上完整入选理由分页'}).check();
 await page.getByRole('checkbox',{name:'附上完整入选理由分页'}).waitFor();
 const expectedPages=await page.evaluate(async()=>{const {planJournalPages}=await import('/src/codex_yearbookPages.ts');const {store}=await import('/src/store.ts');const data=JSON.parse(localStorage.getItem('music-feelings-mobile-app-data'));return (await planJournalPages(2026,await store.listEntries(),'rank',{topAlbums:JSON.parse(data['top-albums:2026']),includeFullRankNotes:true})).length;});
 await page.waitForFunction(expected=>document.querySelector('select[aria-label="导出页码"]')?.options.length===expected,expectedPages);
 const appendixTotal=await page.getByLabel('导出页码').locator('option').count();
 assert(appendixTotal>1,'完整理由附页应计入页面导航');
 await page.getByRole('button',{name:'选择全部页'}).click();
 assert((await page.locator('.journal-export-footer').innerText()).includes(`已选 ${appendixTotal} 页`),'保存与分享选择不得漏掉附页');
 await page.screenshot({path:`${output}/codex_rank_preflight.jpg`,type:'jpeg',quality:86,fullPage:true});
 await page.getByLabel('导出页码').selectOption(String(appendixTotal-1));
 while(Number(await page.getByLabel('导出页码').inputValue())<appendixTotal-1) await page.getByRole('button',{name:'下一页'}).click();
 await page.getByRole('img',{name:new RegExp(`第 ${appendixTotal} 页预览`)}).waitFor();
 const appendixDownload=page.waitForEvent('download');await page.getByRole('button',{name:'下载当前页 PNG',exact:true}).click();
 assert.equal((await appendixDownload).suggestedFilename(),`xiaodongge-2026-rank-${String(appendixTotal).padStart(3,'0')}-of-${appendixTotal}.png`);
 await page.screenshot({path:`${output}/codex_rank_appendix.jpg`,type:'jpeg',quality:86,fullPage:true});
 await page.getByText('图片隐私设置').click();
 await page.getByRole('checkbox',{name:/隐藏正文、摘录、寄语与标签/}).check();
 assert.equal(await page.getByLabel('导出页码').locator('option').count(),1,'隐藏正文须移除附页');
 assert.equal(await page.getByText(/入选理由超过海报两行/).count(),0,'隐藏正文须移除理由预检');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.codexCopiedPreflight=text;}}}));
 await page.getByRole('button',{name:'复制导出预检'}).click();
 const copied=await page.evaluate(()=>window.codexCopiedPreflight);
 assert(!copied.includes('私密标记Q8'),'复制预检不得泄漏隐藏理由');
 assert(copied.includes('具体日期可见')&&copied.includes('应用名可见'),'复制预检应包含全部隐私设置');
 await page.getByRole('checkbox',{name:/隐藏具体日期/}).check();
 await page.getByText(/具体日期已隐藏/).waitFor();
 await page.getByRole('button',{name:'复制导出预检'}).click();
 assert((await page.evaluate(()=>window.codexCopiedPreflight)).includes('具体日期已隐藏'),'预检复制应跟随日期隐私设置');
 await page.getByRole('checkbox',{name:'隐藏应用名'}).check();
 await page.getByText(/应用名已隐藏/).waitFor();
 await page.getByRole('button',{name:'复制导出预检'}).click();
 assert((await page.evaluate(()=>window.codexCopiedPreflight)).includes('应用名已隐藏'),'预检复制应跟随应用名隐私设置');
 await page.getByRole('checkbox',{name:/隐藏正文、摘录、寄语与标签/}).uncheck();
 await page.getByText(/入选理由超过海报两行/).waitFor();
 await page.locator('.journal-export-preflight li').filter({hasText:'入选理由超过海报两行'}).getByRole('button',{name:'定位编辑'}).click();
 await page.getByRole('heading',{name:'编辑年度专辑榜单'}).waitFor();
 assert.equal(await page.evaluate(()=>document.activeElement?.id),'codex-rank-note-1','预检应定位对应榜单理由');
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:620,height:1000});
 await page.setContent(`<style>body{margin:0;background:#17483e}img{display:block;width:620px}</style><img src="${result.shots.at(-1)}">`);
 await page.locator('img').evaluate(i=>i.decode());await page.screenshot({path:`${output}/codex_rank_champion.jpg`,fullPage:true,type:'jpeg',quality:90});
 console.log(`PASS: 1–15张共${result.groups}页、真实封面/更换/已删记录、离线字体、长文本/emoji、隐私四项、PNG下载和三视口。`);
}finally{await browser.close();}
