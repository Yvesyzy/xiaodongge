import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
 const errors = [], comparison = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => {
  window.drawn = []; window.boxes = [];
  const fillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(value, x, y, ...rest) {
   const transform = this.getTransform(), m = this.measureText(value);
   if (transform.a === 1 && transform.e === 0 && transform.f === 0) window.drawn.push({value,x,y,left:x-m.actualBoundingBoxLeft,right:x+m.actualBoundingBoxRight,top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent});
   return fillText.call(this,value,x,y,...rest);
  };
  const rect = CanvasRenderingContext2D.prototype.rect;
  CanvasRenderingContext2D.prototype.rect = function(x,y,w,h) {
   const m=this.getTransform(); if(w===128&&h===128) window.boxes.push({x:m.e,y:m.f,w:w*m.a,h:h*m.d});
   return rect.call(this,x,y,w,h);
  };
 });
 await page.goto(new URL('../docs/designs/codex_rank_duo_preview.html',import.meta.url).href);
 for (const style of ['list','collage']) {
  await page.locator(`[data-style="${style}"]`).click();
  const ranks = [];
  for (const [index,first] of [11,6,1].entries()) {
   await page.evaluate(()=>{window.drawn=[];window.boxes=[];});
   await page.locator(`[data-page="${index}"]`).click();
   const result=await page.evaluate(()=>({drawn:window.drawn,boxes:window.boxes,image:canvas.toDataURL('image/png'),items:albums.slice(layouts[activePage].first-1,layouts[activePage].last),size:[canvas.width,canvas.height]}));
   assert.deepEqual(result.size,[1080,1680]); assert.equal(result.boxes.length,5);
   assert.deepEqual(result.boxes.map(b=>b.w),style==='list'?[196,196,196,196,196]:first===1?[460,224,224,224,224]:[344,344,224,224,224]);
   for(const box of result.boxes){assert(box.x>=72&&box.x+box.w<=1008);assert(box.y>=272&&box.y+box.h<=1560);}
   for(const [i,a] of result.boxes.entries())for(const b of result.boxes.slice(i+1))assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'封面不得重叠');
   const mainText=result.drawn.filter(t=>t.x===(style==='list'?316:148)&&t.y>=420&&t.y<1560);
   for(const t of mainText){assert(t.right<=1008&&t.left>=t.x-4,`文字横溢出${JSON.stringify(t)}`);assert(t.bottom<=1560);}
   for(const t of result.drawn){assert(t.left>=60&&t.right<=1012&&t.top>=60&&t.bottom<=1645,`画布边界${JSON.stringify(t)}`);}
   const pageRanks=result.drawn.filter(t=>style==='list'?t.x===1008&&t.y>=420&&t.y<1560:t.x===72&&t.y>=900&&t.y<1560).map(t=>Number(t.value));
   assert.deepEqual(pageRanks,[first,first+1,first+2,first+3,first+4]);ranks.push(...pageRanks);
   for (const [i,item] of result.items.entries()) {
    const baseline=style==='list'?420+i*228+136:900+i*132+90;
    const noteText=mainText.filter(t=>t.y>=baseline&&t.y<=baseline+(style==='list'?64:27)).map(t=>t.value).join('');
    assert.equal(noteText,item.notes.join(''),'理由不应丢失');
   }
   assert(result.drawn.some(t=>t.value===`第 ${index+1} / 3 页`));
   await writeFile(new URL(`../docs/designs/codex_rank_duo_${style}_${index+1}.png`,import.meta.url),Buffer.from(result.image.split(',')[1],'base64'));
   if(index===2)comparison.push(result.image);
   for(const id of ['hideBrand','hideDate','hideRating','hideContent']) {
    await page.evaluate(()=>{window.drawn=[];});await page.locator(`#${id}`).check();
    const lines=await page.evaluate(()=>window.drawn);
    assert(lines.some(t=>t.value===`第 ${index+1} / 3 页`));
    if(id==='hideBrand')assert(!lines.some(t=>t.value==='小懂哥'));
    if(id==='hideDate')assert(!lines.some(t=>t.value.includes('整理于')));
    if(id==='hideRating')assert(!lines.some(t=>t.value.includes('/ 10')));
    if(id==='hideContent')assert.equal(lines.filter(t=>t.x===(style==='list'?316:148)&&t.y>=420&&t.y<1560).length,10);
    await page.locator(`#${id}`).uncheck();
   }
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存这张 PNG'}).click();assert.equal((await download).suggestedFilename(),`codex_rank_duo_${style}_${index+1}.png`);
  }
  assert.deepEqual(ranks.sort((a,b)=>a-b),Array.from({length:15},(_,i)=>i+1));
 }
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);
 await page.setViewportSize({width:1104,height:910});
 await page.setContent(`<style>body{margin:0;padding:16px;background:#d6ded8;font:16px "Microsoft YaHei",system-ui}.compare{display:flex;gap:24px}figure{margin:0}figcaption{height:40px}img{display:block;width:524px;height:auto}</style><div class="compare"><figure><figcaption>A · 年份主视觉＋列表</figcaption><img src="${comparison[0]}"></figure><figure><figcaption>B · 五封面拼贴</figcaption><img src="${comparison[1]}"></figure></div>`);
 await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 await page.screenshot({path:fileURLToPath(new URL('../docs/designs/codex_rank_duo_comparison.jpg',import.meta.url)),fullPage:true,type:'jpeg',quality:89});
 console.log('PASS: 两方案×三页、全部名次、五张封面、理由完整、文字边界、四项隐私、下载、三种视口。六张PNG和并排对照图已生成。');
} finally {await browser.close();}
