import React, {useEffect, useState, type CSSProperties, type ReactNode} from 'react';
import {AbsoluteFill, Audio, Composition, Img, cancelRender, continueRender, delayRender, registerRoot, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import source from '../public/codex_light/codex_assets.json';
import sizes from '../public/codex_light/codex_sizes.json';
import timing from '../public/codex_timing_v6.json';
import themes from '../public/codex_theme_v5/codex_assets.json';
import themeSizes from '../public/codex_theme_v5/codex_sizes.json';
import genres from '../public/codex_genre/codex_assets.json';
import genreSizes from '../public/codex_genre/codex_sizes.json';

const cue=Object.fromEntries(Object.entries(timing.cues).map(([name,frame])=>[name,frame/timing.fps]));

const palette=source.palette;
const C={bg:palette['--paper-soft'],card:palette['--paper'],text:palette['--ink'],quiet:palette['--muted'],gold:palette['--amber-ink'],green:palette['--neu-ink'],line:palette['--line']};
const layout=source.layout;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const ease=(v:number)=>{const p=clamp(v);return p*p*(3-2*p);};
const out=(v:number)=>1-Math.pow(1-clamp(v),3);
const lerp=(a:number,b:number,p:number)=>a+(b-a)*p;
const file=(name:string)=>staticFile(`${name.startsWith('theme_')?'codex_theme_v5':name.startsWith('genre_')?'codex_genre':'codex_light'}/codex_${name}.png`);
const dim=(name:string)=>((name.startsWith('theme_')?themeSizes:name.startsWith('genre_')?genreSizes:sizes) as Record<string,number[]>)[`codex_${name}.png`];
const uiWidth=dim('reader')[0];

function Crop({name,x,y,w,h,pan=0,opacity=1,angle=0,round=0,scale=1}:{name:string;x:number;y:number;w:number;h?:number;pan?:number;opacity?:number;angle?:number;round?:number;scale?:number}){
 const [iw,ih]=dim(name);
 return <div style={{position:'absolute',left:x,top:y,width:w,height:h??w*ih/iw,overflow:'hidden',borderRadius:round,opacity,transform:`rotate(${angle}deg) scale(${scale})`,transformOrigin:'50% 50%'}}>
  <Img src={file(name)} style={{display:'block',width:w,height:w*ih/iw,transform:`translateY(${-pan}px)`}}/>
 </div>;
}
function Words({children,x,y,w,size=70,opacity=1,style={}}:{children:ReactNode;x:number;y:number;w:number;size?:number;opacity?:number;style?:CSSProperties}){
 return <div style={{position:'absolute',left:x,top:y,width:w,fontSize:size,lineHeight:1.27,fontWeight:550,letterSpacing:-1.8,whiteSpace:'pre-line',opacity,...style}}>{children}</div>;
}
function Ring({x,y,r,opacity=.2,rotation=0}:{x:number;y:number;r:number;opacity?:number;rotation?:number}){
 return <svg style={{position:'absolute',left:x-r,top:y-r,width:r*2,height:r*2,opacity,transform:`rotate(${rotation}deg)`}} viewBox="0 0 1000 1000">
  {[484,454,424,394,364,334].map((radius,i)=><circle key={radius} cx="500" cy="500" r={radius} fill="none" stroke={palette['--amber']} strokeWidth={i===0?2:1} strokeDasharray={i===0?'920 2120':undefined}/>)}
  <circle cx="500" cy="16" r="7" fill={palette['--amber']}/>
 </svg>;
}
function Stage({t,start,end,children}:{t:number;start:number;end:number;children:ReactNode}){
 if(t<start||t>=end)return null;
 return <AbsoluteFill>{children}</AbsoluteFill>;
}
function Label({children,x=90,y=120,wide,color=C.gold}:{children:ReactNode;x?:number;y?:number;wide:boolean;color?:string}){
 return <Words x={wide?128:x} y={wide?110:y} w={800} size={wide?22:25} style={{color,fontWeight:450,letterSpacing:5}}>{children}</Words>;
}
function Tap({x,y,t,start,color}:{x:number;y:number;t:number;start:number;color:string}){
 if(t<start||t>=start+.45)return null;
 const p=ease((t-start)/.45);
 return <div style={{position:'absolute',left:x-36,top:y-36,width:72,height:72,border:`3px solid ${color}`,borderRadius:'50%',opacity:1-p,transform:`scale(${lerp(.6,1.9,p)})`}}/>;
}

function Film(){
 const frame=useCurrentFrame(),{width,height,fps}=useVideoConfig();
 const t=frame/fps,wide=width>height;
 const globalDark=t>=cue.themeDark&&t<cue.themeLight,readerDark=t>=cue.readerDark&&t<cue.readerLight;
 const activePalette=readerDark?{...themes.palette.dark,'--paper-soft':themes.readerEvents[0].paper,'--paper':themes.readerEvents[0].paper,'--ink':themes.readerEvents[0].ink}:globalDark?themes.palette.dark:palette;
 const C={bg:activePalette['--paper-soft'],card:activePalette['--paper'],text:activePalette['--ink'],quiet:activePalette['--muted'],gold:activePalette['--amber-ink'],green:activePalette['--neu-ink'],line:activePalette['--line']};
 const [fontHandle]=useState(()=>delayRender('Load bundled Noto Sans SC v6 brand film'));
 useEffect(()=>{const font=new FontFace('Codex Film',`url(${staticFile('codex_light/codex_noto_sans_sc.woff2')})`,{weight:'100 900'});font.load().then(f=>{document.fonts.add(f);continueRender(fontHandle);}).catch(cancelRender);},[fontHandle]);
 const cardX=wide?866:78,cardY=wide?408:854,cardW=wide?956:924;
 const phoneX=wide?1180:257,phoneY=wide?58:562,phoneW=wide?445:566;
 const captureZoom=ease((t-(cue.typedStart-.6))/.6),captureW=lerp(phoneW,wide?590:792,captureZoom);
 const captureX=lerp(phoneX,wide?1034:144,captureZoom),captureY=lerp(phoneY,wide?134:620,captureZoom);
 const captureHeight=wide?879:1110;
 const capturePan=lerp(0,layout.quickSaveButton.centerY*(wide?590:792)/uiWidth-(captureHeight-100),captureZoom);
 const typed=clamp(Math.floor(clamp((t-cue.typedStart)/(cue.typedEnd-cue.typedStart))*20)/20);
 const track=940*ease((t-(cue.moods-.15))/.15);
 const genreName=t<cue.genreExpand?'genre_overview':t<cue.genreChildren?'genre_electronic':t<cue.genreSelected?'genre_house':'genre_selected';
 const genreW=genreName==='genre_overview'?(wide?520:690):(wide?775:844);
 const genreX=wide?1100+(842-genreW)/2:(width-genreW)/2,genreY=wide?122:650;
 const genreClick=t<cue.genreExpand?{name:'genre_overview',at:cue.genreExpand}:t<cue.genreChildren?{name:'genre_electronic',at:cue.genreChildren}:t<cue.genreSelected?{name:'genre_house',at:cue.genreSelected}:null;
 const blindW=wide?590:713;
 const themeW=wide?440:550,themeX=wide?1250:265,themeY=wide?64:565;
 const panelW=wide?760:860,panelX=wide?1030:110,panelY=wide?515:1175;
 const controlW=wide?400:460,controlX=wide?1010:115,controlY=wide?570:1180;
 const themePoints=(['深色','浅色'] as const).map(label=>({x:panelX+themes.layout.appearance[label].centerX*panelW/dim('theme_appearance_light')[0],y:panelY+themes.layout.appearance[label].centerY*panelW/dim('theme_appearance_light')[0]}));
 const readerPoint={x:controlX+themes.layout.readerControl.centerX*controlW/dim('theme_reader_controls_light')[0],y:controlY+themes.layout.readerControl.centerY*controlW/dim('theme_reader_controls_light')[0]};
 const readerControls=t<cue.readerReading||(t>=cue.readerOptions&&t<cue.readerClose);
 return <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:'"Codex Film", "Microsoft YaHei", sans-serif',overflow:'hidden'}}>
  <Audio src={staticFile('codex_original_score_v6.wav')}/>
  <AbsoluteFill style={{background:`radial-gradient(ellipse at 72% 64%, ${C.green}10, transparent 68%)`}}/>
  <Stage t={t} start={cue.hook} end={cue.archive}>
   <Ring x={wide?1450:730} y={wide?555:1350} r={wide?710:790} rotation={-75+t*13} opacity={.26}/>
   {(['cover_01','cover_02','cover_00'] as const).map((name,i)=>{
    const p=out((t-i*.16)/1.15),w=wide?[400,310,590][i]:[455,390,650][i];
    return <Crop key={name} name={name} x={(wide?[1150,1535,1220][i]:[45,665,260][i])+lerp(165,0,p)} y={(wide?[90,650,290][i]:[1260,1370,940][i])+lerp(120,0,p)} w={w} angle={[-11,13,-5][i]+t*(i===2?.7:-.3)} opacity={p*[.58,.4,1][i]} round={8}/>;
   })}
   <AbsoluteFill style={{background:`linear-gradient(${wide?'90deg':'180deg'}, ${C.bg} 8%, ${C.bg}e8 ${wide?'42%':'35%'}, ${C.bg}00 72%)`}}/>
   <Label wide={wide}>YOUR PRIVATE MUSIC ARCHIVE</Label>
   <Words x={wide?125:90} y={wide?240:335} w={wide?1050:900} size={wide?112:102} opacity={out(t/.6)} style={{fontWeight:700,transform:`translateY(${lerp(24,0,out(t/.6))}px)`}}>声音，会过去。</Words>
   <Words x={wide?125:90} y={wide?408:510} w={wide?1060:900} size={wide?103:89} opacity={out((t-cue.whisper)/.6)} style={{fontWeight:650,color:C.green,transform:`translateY(${lerp(32,0,out((t-cue.whisper)/.6))}px)`}}>感受，值得留下。</Words>
   <div style={{position:'absolute',left:wide?131:95,top:wide?615:750,width:lerp(0,wide?710:750,out((t-cue.whisper)/.9)),height:2,background:C.gold,opacity:.5}}/>
   <Words x={wide?131:95} y={wide?680:805} w={wide?900:900} size={wide?37:38} opacity={out((t-cue.memory)/.5)} style={{color:C.quiet,fontWeight:400,letterSpacing:3}}>把听过，变成记得。</Words>
  </Stage>

  <Stage t={t} start={cue.archive} end={cue.capture}>
   <Ring x={wide?1410:540} y={wide?540:1080} r={wide?600:660} opacity={.16} rotation={t*8}/>
   <Label wide={wide}>01 / 第一次听见</Label>
   <Words x={wide?125:90} y={wide?280:302} w={wide?810:900} size={wide?98:85} opacity={out((t-cue.archive)/.3)} style={{fontWeight:700}}>第一次听见。</Words>
   <Words x={wide?130:94} y={wide?566:469} w={wide?690:860} size={wide?44:42} opacity={out((t-cue.archive-.24)/.35)} style={{color:C.quiet,fontWeight:400}}>先留住，为什么喜欢。</Words>
   <Crop name="archive_card" x={cardX} y={cardY} w={cardW} opacity={out((t-cue.archive-.48)/.5)} round={16}/>
   <Crop name="cover_00" x={lerp(wide?1170:240,cardX+layout.archiveCover.x*cardW/dim('archive_card')[0],ease((t-cue.archive)/1.05))} y={lerp(wide?188:752,cardY+layout.archiveCover.y*cardW/dim('archive_card')[0],ease((t-cue.archive)/1.05))} w={lerp(wide?595:600,layout.archiveCover.width*cardW/dim('archive_card')[0],ease((t-cue.archive)/1.05))} opacity={1-ease((t-cue.archive-1.09)/.12)} round={4}/>
   <Words x={wide?130:94} y={wide?827:1352} w={wide?630:860} size={wide?23:27} opacity={out((t-cue.archive-1.05)/.3)} style={{color:C.gold,fontWeight:400,letterSpacing:4}}>一张封面 · 一个分数 · 当时的感受</Words>
  </Stage>

  <Stage t={t} start={cue.capture} end={cue.reader}>
   <Label wide={wide}>02 / 一句话，也算记录</Label>
   <Words x={wide?126:90} y={wide?295:220} w={wide?825:900} size={wide?96:77} style={{fontWeight:700}}>{wide?'听见的时候，\n就记下来。':'听见的时候，\n就记下来。'}</Words>
   {t<cue.save?<div style={{position:'absolute',left:captureX,top:captureY+lerp(95,0,out((t-cue.capture)/.6)),width:captureW,height:captureHeight,overflow:'hidden',borderRadius:28}}>
    <Crop name="quick_empty" x={0} y={0} w={captureW} h={captureHeight} pan={capturePan}/>
    <div style={{position:'absolute',inset:0,clipPath:`inset(0 ${100*(1-typed)}% 0 0)`}}>
     <Crop name="quick_filled" x={0} y={0} w={captureW} h={captureHeight} pan={capturePan}/>
    </div>
    {t>=cue.save-.3&&<div style={{position:'absolute',left:layout.quickSaveButton.centerX*captureW/uiWidth-36,top:layout.quickSaveButton.centerY*captureW/uiWidth-capturePan-36,width:72,height:72,border:`3px solid ${C.gold}`,borderRadius:'50%',opacity:1-clamp((t-cue.save+.3)/.3),transform:`scale(${lerp(.5,1.8,ease((t-cue.save+.3)/.3))})`}}/>}
   </div>:<>
    <Crop name="quick_saved" x={wide?1025:130} y={wide?131:645} w={wide?720:820} h={wide?815:1050} pan={layout.quickSavedTop*(wide?720:820)/uiWidth} round={22} scale={lerp(1.03,1,ease((t-cue.save)/1.2))}/>
    <Words x={wide?130:92} y={wide?661:468} w={wide?650:860} size={wide?37:35} style={{color:C.gold,fontWeight:400}}>此刻的听感，有了自己的位置。</Words>
   </>}
  </Stage>

  <Stage t={t} start={cue.reader} end={cue.theme}>
   <Ring x={wide?1460:540} y={wide?540:1050} r={wide?600:710} rotation={t*9} opacity={.13}/>
   <Label wide={wide}>{t>=cue.genre&&t<cue.dimensions?'03 / 曲风的层次':'03 / 喜欢的形状'}</Label>
   <Words x={wide?125:90} y={wide?286:219} w={wide?805:900} size={wide?95:78} style={{fontWeight:700}}>{t>=cue.genre&&t<cue.dimensions?'从大类，\n找到你的曲风。':'喜欢，\n不止一个分数。'}</Words>
   {t<cue.rating?<>
    <Crop name="reader" x={wide?963:105} y={wide?87:622} w={wide?820:870} h={wide?896:1080} pan={layout.readerHeroTop*(wide?820:870)/uiWidth-24+lerp(0,350,ease((t-cue.reader)/(cue.rating-cue.reader)))} round={24}/>
    <Words x={wide?131:95} y={wide?684:458} w={wide?655:860} size={wide?31:32} style={{color:C.quiet,fontWeight:400}}>把说不清的喜欢，慢慢说清楚。</Words>
   </>:t<cue.genre?<>
    <div style={{position:'absolute',left:wide?964:90,top:wide?226:661,width:wide?858:900,height:wide?681:880,overflow:'hidden'}}>
     <Crop name="rating" x={28-track} y={122} w={wide?798:844} round={24}/>
     <Crop name="moods" x={968-track} y={25} w={wide?798:844} round={24}/>
    </div>
    <Words x={wide?131:95} y={wide?686:458} w={wide?650:850} size={wide?31:32} style={{color:C.gold,fontWeight:400}}>分数 · 情绪 · 曲风</Words>
   </>:t<cue.dimensions?<>
    <Crop name={genreName} x={genreX} y={genreY} w={genreW} round={20}/>
    {genreClick&&<Tap x={genreX+(genres.layout as Record<string,{centerX:number;centerY:number}>)[genreClick.name].centerX*genreW/dim(genreName)[0]} y={genreY+(genres.layout as Record<string,{centerX:number;centerY:number}>)[genreClick.name].centerY*genreW/dim(genreName)[0]} t={t} start={genreClick.at-.25} color={C.gold}/>}
    <Words x={wide?131:95} y={wide?686:458} w={wide?700:850} size={wide?31:32} style={{color:C.gold,fontWeight:400,letterSpacing:0}}>{t<cue.genreExpand?'流行 · 摇滚 · 电子 · 更多大类':t<cue.genreChildren?'电子 → House / Techno / Trance':t<cue.genreSelected?'House → 更多细分类':'电子 → House → Deep House'}</Words>
   </>:<>
    {layout.dimensions.map((row,i)=>{
     const w=wide?500:700,p=out((t-cue.dimensions-i*.1)/.3),scale=w/dim('dimensions')[0];
     return <Crop key={row.label} name={t<cue.dimensionUpdate?'dimensions':'dimensions_after'} x={(wide?1150:190)+lerp((i%2?1:-1)*(wide?260:310),0,p)} y={(wide?85:600)+row.y*scale+lerp(80,0,p)} w={w} h={row.height*scale} pan={row.y*scale} round={16} angle={lerp(i%2?4:-4,0,p)}/>;
    })}
    <Words x={wide?131:95} y={wide?686:458} w={wide?650:850} size={wide?31:32} style={{color:C.gold,fontWeight:400}}>制作、词、曲、人声、原创性、共鸣。</Words>
   </>}
  </Stage>

  <Stage t={t} start={cue.theme} end={cue.pause}>
   <Ring x={wide?1410:540} y={wide?540:1130} r={wide?605:720} opacity={.17} rotation={(t-cue.theme)*14}/>
   <Label wide={wide} color={C.gold}>{t<cue.themeReader?'04 / 你的外观':'04 / 你的阅读'}</Label>
   <Words x={wide?125:90} y={wide?280:219} w={wide?825:900} size={wide?92:78} style={{fontWeight:700}}>{t<cue.themeReader?'浅色，或深色。\n随你的心意。':'阅读，\n也能自由切换。'}</Words>
   <Words x={wide?131:95} y={wide?686:458} w={wide?670:860} size={36} style={{color:C.quiet,fontWeight:400}}>{t<cue.themeReader?'跟随系统，也可以手动选择。':'同一段听感，换一种氛围。'}</Words>
   {t<cue.themeReader?<>
    <Crop name="theme_home_light" x={themeX} y={themeY} w={themeW} round={28}/>
    {t>=cue.themeDark&&<AbsoluteFill style={{clipPath:`circle(${160*ease((t-cue.themeDark)/.45)}% at ${themePoints[0].x}px ${themePoints[0].y}px)`}}><Crop name="theme_home_dark" x={themeX} y={themeY} w={themeW} round={28}/></AbsoluteFill>}
    {t>=cue.themeLight&&<AbsoluteFill style={{clipPath:`circle(${160*ease((t-cue.themeLight)/.45)}% at ${themePoints[1].x}px ${themePoints[1].y}px)`}}><Crop name="theme_home_light_after" x={themeX} y={themeY} w={themeW} round={28}/></AbsoluteFill>}
    {t>=cue.themeSettings&&<Crop name={globalDark?'theme_appearance_dark':t>=cue.themeLight?'theme_appearance_light_after':'theme_appearance_light'} x={panelX} y={panelY+lerp(45,0,out((t-cue.themeSettings)/.3))} w={panelW} round={24} opacity={out((t-cue.themeSettings)/.3)}/>}
    {themePoints.map((point,i)=><Tap key={i} {...point} t={t} start={i?cue.themeLight:cue.themeDark} color={C.gold}/>)}
   </>:<>
    <Crop name={readerControls?'theme_reader_menu_light':'theme_reader_light'} x={themeX} y={themeY} w={themeW} round={28}/>
    {t>=cue.readerDark&&<AbsoluteFill style={{clipPath:`circle(${160*ease((t-cue.readerDark)/.45)}% at ${readerPoint.x}px ${readerPoint.y}px)`}}><Crop name={readerControls?'theme_reader_menu_dark':'theme_reader_dark'} x={themeX} y={themeY} w={themeW} round={28}/></AbsoluteFill>}
    {t>=cue.readerLight&&<AbsoluteFill style={{clipPath:`circle(${160*ease((t-cue.readerLight)/.45)}% at ${readerPoint.x}px ${readerPoint.y}px)`}}><Crop name={readerControls?'theme_reader_menu_light_after':'theme_reader_light_after'} x={themeX} y={themeY} w={themeW} round={28}/></AbsoluteFill>}
    {readerControls&&<div style={{position:'absolute',left:controlX,top:controlY,width:controlW,height:dim('theme_reader_controls_light')[1]*controlW/dim('theme_reader_controls_light')[0],background:C.card,borderRadius:22,boxShadow:'0 18px 58px #00000018',overflow:'hidden'}}><Crop name={readerDark?'theme_reader_controls_dark':t>=cue.readerLight?'theme_reader_controls_light_after':'theme_reader_controls_light'} x={0} y={0} w={controlW}/></div>}
    {[cue.readerDark,cue.readerLight].map(start=><Tap key={start} {...readerPoint} t={t} start={start} color={C.gold}/>)}
   </>}
  </Stage>

  <Stage t={t} start={cue.pause} end={cue.reveal}>
   <AbsoluteFill style={{background:C.card}}/>
   <Ring x={wide?1430:540} y={wide?565:1180} r={wide?550:715} rotation={125+(t-cue.pause)*2} opacity={.2}/>
   <Label wide={wide} color={C.green}>05 / 再次听见</Label>
   <Words x={wide?125:90} y={wide?211:232} w={wide?830:910} size={wide?36:35} style={{color:C.quiet,fontWeight:400,letterSpacing:5}}>同一张专辑，相隔</Words>
   <Words x={wide?109:71} y={wide?283:304} w={wide?690:830} size={wide?285:300} style={{color:C.green,fontWeight:800,letterSpacing:-14,lineHeight:1}}>223</Words>
   <Words x={wide?668:659} y={wide?463:490} w={180} size={wide?56:58} style={{color:C.green,fontWeight:400}}>天</Words>
   <Words x={wide?130:92} y={wide?659:692} w={wide?770:900} size={wide?59:54} style={{fontWeight:600}}>{'先听现在。\n旧评价，先不看。'}</Words>
   <Crop name="relisten_blind" x={wide?1113:184} y={wide?115:866} w={blindW} h={lerp(layout.relisten.introHeight,layout.relisten.ratingHeight,ease((t-cue.blindRating)/.8))*blindW/uiWidth} pan={layout.relisten.top*blindW/uiWidth} round={24}/>
   <Words x={wide?132:95} y={wide?884:1740} w={wide?650:850} size={wide?30:29} opacity={out((t-cue.blindReady)/.4)} style={{color:C.quiet,fontWeight:400}}>先写下现在，再揭晓过去。</Words>
  </Stage>

  <Stage t={t} start={cue.reveal} end={cue.months}>
   <Ring x={wide?1400:540} y={wide?530:1040} r={wide?650:710} rotation={130+(t-cue.reveal)*8} opacity={.18}/>
   <Label wide={wide}>05 / 时间的回声</Label>
   <Words x={wide?132:95} y={wide?208:220} w={800} size={wide?33:34} style={{color:C.quiet,fontWeight:400,letterSpacing:5}}>相隔</Words>
   <Words x={wide?113:78} y={wide?280:287} w={wide?690:830} size={wide?270:285} style={{color:C.green,fontWeight:800,letterSpacing:-14,lineHeight:1,transform:`scale(${lerp(1.07,1,out((t-cue.reveal)/.3))})`,transformOrigin:'0 50%'}}>223</Words>
   <Words x={wide?635:631} y={wide?446:464} w={170} size={wide?61:62} style={{color:C.green,fontWeight:450}}>天</Words>
   <Words x={wide?131:95} y={wide?675:618} w={wide?700:890} size={wide?61:58} style={{fontWeight:600}}>{wide?'音乐没变。\n你已经不同。':'音乐没变，你已经不同。'}</Words>
   <Crop name="comparison_score" x={wide?999:90} y={wide?254:815} w={wide?814:900} round={25} scale={lerp(1.045,1,out((t-cue.reveal)/.3))}/>
   <Crop name="relisten_words" x={wide?999:90} y={wide?607:1219} w={wide?814:900} round={10} opacity={out((t-cue.reveal-.3)/.3)}/>
   <Words x={wide?1002:96} y={wide?941:1622} w={wide?810:880} size={wide?27:30} style={{color:C.quiet,fontWeight:400,letterSpacing:3}}>8 → 9.5 · 从孤独到陪伴</Words>
  </Stage>

  <Stage t={t} start={cue.months} end={cue.top15}>
   <Ring x={wide?1410:540} y={wide?530:1140} r={wide?610:735} opacity={.15} rotation={t*13}/>
   <Label wide={wide}>06 / 你的音乐年记</Label>
   <Words x={wide?125:90} y={wide?286:219} w={wide?825:900} size={wide?88:77} style={{fontWeight:700}}>{t<cue.yearbook+.6?'听过的日子，\n一页页留下。':'你的这一年，\n慢慢成册。'}</Words>
   {t<cue.yearbook+.6&&layout.months.slice(0,9).map((row,i)=>{
    const enter=out((t-cue.months-i*.2)/.3),fold=ease((t-cue.yearbook)/.6),w=lerp(wide?745:852,280,fold);
    return <Crop key={i} name="months_grid" x={lerp((wide?964:104)+lerp(180,0,enter),wide?1260:350,fold)} y={lerp((wide?134:710)+i*(wide?75:96)+lerp(130,0,enter),wide?363:936,fold)} w={w} h={row.height*w/dim('months_grid')[0]} pan={row.y*w/dim('months_grid')[0]} angle={lerp((i-4)*.4,0,fold)} opacity={enter*(1-fold)} round={11}/>;
   })}
   {t>=cue.yearbook&&<>
    <Crop name="yearbook" x={wide?1180:218} y={(wide?62:566)+lerp(125,0,out((t-cue.yearbook)/.6))} w={wide?465:644} h={wide?943:1110} pan={lerp(0,wide?31:43,ease((t-cue.yearbook)/2.4))} round={28} opacity={out((t-cue.yearbook)/.6)}/>
    <Crop name="year_facts" x={wide?764:90} y={wide?817:1547} w={wide?916:900} round={16} opacity={out((t-cue.yearFacts)/.3)}/>
   </>}
  </Stage>

  <Stage t={t} start={cue.top15} end={cue.brand}>
   <Ring x={wide?1390:540} y={wide?540:1100} r={wide?615:870} rotation={-60+(t-cue.top15)*13} opacity={.38}/>
   <Words x={wide?118:50} y={wide?275:326} w={wide?740:980} size={wide?420:540} opacity={.12*(1-ease((t-cue.posters)/.6))} style={{fontWeight:850,color:C.gold,letterSpacing:-25,lineHeight:1}}>15</Words>
   <Label wide={wide}>07 / 我的年度 Top 15</Label>
   <Words x={wide?126:90} y={wide?259:220} w={wide?735:910} size={wide?90:76} style={{fontWeight:700}}>{wide?'把喜欢，\n郑重收藏。':'把喜欢，\n郑重收藏。'}</Words>
   <Words x={wide?132:94} y={wide?606:437} w={wide?665:860} size={wide?33:32} opacity={out((t-cue.top15)/.3)} style={{color:C.quiet,fontWeight:400}}>你的 Top 15，也留下你的理由。</Words>
   {Array.from({length:15},(_,i)=>{
    const cols=wide?5:3,col=i%cols,row=Math.floor(i/cols),w=wide?165:215,gap=wide?25:28;
    const gx=(wide?868:188)+col*(w+gap),gy=(wide?230:625)+row*(w+gap);
    const p=ease((t-cue.posters)/.6),enter=out((t-cue.top15-i*.012)/.3);
    return <Crop key={i} name={`cover_${String(i).padStart(2,'0')}`} x={lerp(lerp(width/2,gx,enter),wide?1280:455,p)} y={lerp(lerp(height/2,gy,enter),wide?400:860,p)} w={lerp(w,80,p)} angle={lerp((i%3-1)*7,0,p)} opacity={1-ease((t-cue.posters)/.6)} round={4}/>;
   })}
   <Crop name="poster_1" x={lerp(wide?600:-610,wide?817:-100,out((t-cue.posters)/.6))} y={wide?190:859} w={wide?405:495} angle={lerp(-19,-7,out((t-cue.posters)/.6))} opacity={.65*out((t-cue.posters)/.3)}/>
   <Crop name="poster_2" x={lerp(width+100,wide?1486:716,out((t-cue.posters)/.6))} y={wide?201:857} w={wide?391:495} angle={lerp(19,7,out((t-cue.posters)/.6))} opacity={.72*out((t-cue.posters)/.3)}/>
   <Crop name="poster_3" x={wide?1080:198} y={(wide?90:618)+lerp(220,0,out((t-cue.posters)/.6))} w={wide?572:684} angle={lerp(5,0,out((t-cue.posters)/.6))} opacity={out((t-cue.posters)/.3)} scale={lerp(1,1.055,ease((t-cue.posterHero)/.8))}/>
  </Stage>

  <Stage t={t} start={cue.brand} end={cue.end}>
   <Ring x={width/2} y={wide?357:697} r={wide?203:227} opacity={.12} rotation={t*4}/>
   <Img src={file('app_icon')} style={{position:'absolute',left:width/2-78,top:wide?253:548,width:156,borderRadius:34,opacity:out((t-cue.brand)/.45),transform:`translateY(${lerp(22,0,out((t-cue.brand)/.6))}px)`}}/>
   <Words x={90} y={wide?440:791} w={width-180} size={wide?96:99} style={{textAlign:'center',fontWeight:650,letterSpacing:7}}>小懂哥</Words>
   <Words x={90} y={wide?598:986} w={width-180} size={wide?44:47} opacity={out((t-cue.brandTag)/.5)} style={{textAlign:'center',fontWeight:400,letterSpacing:0}}>{wide?'记录的不只是音乐，也是当时的你。':'记录的不只是音乐，\n也是当时的你。'}</Words>
   <Words x={90} y={wide?791:1270} w={width-180} size={wide?23:27} style={{textAlign:'center',color:C.quiet,fontWeight:400,letterSpacing:5}}>xiaodongge · Android</Words>
  </Stage>
  {t>=cue.archive&&t<cue.brand&&<div style={{position:'absolute',left:wide?130:90,bottom:wide?56:76,fontSize:wide?18:21,color:C.quiet,letterSpacing:2}}>小懂哥 / 私人音乐档案<span style={{marginLeft:24}}>真实界面 · 演示数据</span></div>}
  <div style={{position:'absolute',left:wide?130:90,right:wide?130:90,bottom:wide?34:48,height:1,background:C.line,opacity:.6}}><div style={{height:1,width:`${100*frame/timing.durationFrames}%`,background:C.gold}}/></div>
 </AbsoluteFill>;
}
const Root=()=> <><Composition id="Xiaodongge-Portrait" component={Film} width={1080} height={1920} fps={timing.fps} durationInFrames={timing.durationFrames}/><Composition id="Xiaodongge-Landscape" component={Film} width={1920} height={1080} fps={timing.fps} durationInFrames={timing.durationFrames}/></>;
registerRoot(Root);
