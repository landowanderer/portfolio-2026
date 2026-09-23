(() => {
  'use strict';
  const data=JSON.parse(document.querySelector('#experiment-data').textContent);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // Old About links now arrive at the complete introduction on the homepage.
  const legacy=new URL(location.href);
  if(legacy.searchParams.has('tab')){const view=legacy.searchParams.get('tab');legacy.searchParams.delete('tab');if(view==='visual')legacy.hash='experiments-title';history.replaceState({},'',legacy)}
  const samples=[...document.querySelectorAll('.intro-sample')];
  const hover=matchMedia('(hover: hover) and (pointer: fine)');
  function closeSamples(){samples.forEach(sample=>sample.classList.remove('sample-open'))}
  // The enlarged study travels beside the pointer, so it never settles over the lines still to be read.
  samples.forEach(sample=>{
    const place=e=>{const img=sample.querySelector('.sample-enlarged img'),iw=img.naturalWidth||4,ih=img.naturalHeight||3,maxH=innerWidth<=640?190:260;let w=innerWidth<=640?185:240,h=w*ih/iw;if(h>maxH){h=maxH;w=h*iw/ih}sample.style.setProperty('--sample-w',w+'px');let x=e.clientX+24+w/2;if(x+w/2>innerWidth-16)x=e.clientX-24-w/2;sample.style.setProperty('--sample-x',x+'px');sample.style.setProperty('--sample-y',Math.max(80,Math.min(innerHeight-h-16,e.clientY-h/2))+'px')};
    sample.addEventListener('pointerenter',e=>{if(!hover.matches||e.pointerType==='touch')return;closeSamples();place(e);sample.classList.add('sample-open')});
    sample.addEventListener('pointermove',e=>{if(sample.classList.contains('sample-open'))place(e)});
    sample.addEventListener('pointerleave',()=>sample.classList.remove('sample-open'));
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSamples()});
  addEventListener('scroll',closeSamples,{passive:true});addEventListener('resize',closeSamples);

  // The mark responds to the visitor; no perpetual idle animation. Its face turns from calm to crying while pressed or raining.
  const cloud=document.querySelector('.cloud'),mark=cloud.querySelector('.cloud-mark');
  let cx=0,cy=0,tx=0,ty=0,s=1,ts=1,v=0,cloudFrame=0;
  function cloudTick(){cx+=(tx-cx)*.12;cy+=(ty-cy)*.12;v+=(ts-s)*.17;v*=.72;s+=v;mark.style.transform=`translate3d(${cx*12}px,${cy*10}px,0) rotateX(${-cy*16}deg) rotateY(${cx*23}deg) rotate(${cx*5}deg) scale(${1+(1-s)*.55},${s})`;mark.style.filter=`drop-shadow(${-cx*7}px ${14+(1-s)*18}px ${12+(1-s)*15}px #0000001c)`;if(Math.abs(cx-tx)+Math.abs(cy-ty)+Math.abs(s-ts)+Math.abs(v)>.001)cloudFrame=requestAnimationFrame(cloudTick);else cloudFrame=0}
  function runCloud(){if(!reduced.matches&&!cloudFrame)cloudFrame=requestAnimationFrame(cloudTick)}
  cloud.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=cloud.getBoundingClientRect();tx=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));ty=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));runCloud()});
  document.querySelector('.home-intro').addEventListener('pointermove',e=>{if(reduced.matches||e.pointerType==='touch')return;const r=cloud.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,reach=Math.max(r.width,180)*1.25,d=Math.hypot(dx,dy);if(d>reach){tx=ty=0}else{const strength=1-d/reach;tx=Math.max(-1,Math.min(1,dx/(r.width/2)))*strength;ty=Math.max(-1,Math.min(1,dy/(r.height/2)))*strength}runCloud()});
  document.querySelector('.home-intro').addEventListener('pointerleave',()=>{tx=ty=0;release()});
  function press(){ts=.73;cloud.classList.add('is-pressed');runCloud();startRain()}function release(){ts=1;cloud.classList.remove('is-pressed');runCloud();stopRain()}
  cloud.addEventListener('pointerdown',press);addEventListener('pointerup',release);cloud.addEventListener('pointercancel',release);cloud.addEventListener('pointerleave',()=>{tx=ty=0;release()});cloud.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();press()}});cloud.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')release()});cloud.addEventListener('blur',()=>{tx=ty=0;release()});

  // Holding the cloud makes it rain over the introduction. Rain builds while held, leans with the cloud's tilt,
  // and breaks on the lines of text it meets. A tap still gives a short shower; nothing runs once the drops are gone.
  const intro=document.querySelector('.home-intro'),sky=document.createElement('canvas');sky.className='intro-rain';sky.setAttribute('aria-hidden','true');intro.append(sky);const sctx=sky.getContext('2d');
  let sw=0,sh=0,drops=[],splashes=[],lines=[],raining=false,rainFrom=0,rainUntil=0,rainFrame=0,rainLast=0,spawn=0;
  function sizeSky(){const r=intro.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);sw=r.width;sh=r.height;sky.width=Math.round(sw*d);sky.height=Math.round(sh*d);sctx.setTransform(d,0,0,d,0,0)}
  function measureLines(){const base=intro.getBoundingClientRect(),walk=document.createTreeWalker(intro,NodeFilter.SHOW_TEXT),range=document.createRange();lines=[];let node;while((node=walk.nextNode())){if(!node.textContent.trim()||node.parentElement.closest('.cloud,.sample-enlarged'))continue;range.selectNodeContents(node);for(const r of range.getClientRects()){if(r.width<3)continue;const top=r.top-base.top+r.height*.3,left=r.left-base.left,right=r.right-base.left,line=lines.find(l=>Math.abs(l.top-top)<5);if(line){line.left=Math.min(line.left,left);line.right=Math.max(line.right,right)}else lines.push({top,left,right})}}}
  new ResizeObserver(()=>{if(rainFrame){sizeSky();measureLines()}}).observe(intro);
  function rainTick(now){
    const dt=rainLast?Math.min(40,now-rainLast)/16.67:1,on=raining||now<rainUntil;rainLast=now;cloud.classList.toggle('is-raining',on);
    if(on){const held=Math.min(1,(now-rainFrom)/1600),wind=Math.max(-.45,Math.min(.45,cx*.4))+.06;spawn+=(.5+held*5.5)*dt;while(spawn>=1&&drops.length<420){spawn--;const vy=10+Math.random()*6,reach=sh*Math.abs(wind);drops.push({x:Math.random()*(sw+reach)-(wind>0?reach:0),y:-20-Math.random()*40,vy,vx:vy*wind,len:10+Math.random()*12,a:.16+Math.random()*.3})}}
    sctx.clearRect(0,0,sw,sh);sctx.lineWidth=1;sctx.lineCap='round';
    drops=drops.filter(d=>{const py=d.y;d.x+=d.vx*dt;d.y+=d.vy*dt;for(const l of lines){if(py<l.top&&d.y>=l.top&&d.x>=l.left&&d.x<=l.right&&Math.random()<.72){for(let i=0,n=2+(Math.random()*2|0);i<n;i++)splashes.push({x:d.x,y:l.top,vx:(Math.random()-.5)*2.6+d.vx*.15,vy:-1.2-Math.random()*1.8,life:1});return false}}if(d.y-d.len>sh)return false;sctx.strokeStyle=`rgba(32,32,32,${d.a*Math.max(0,Math.min(1,(sh-d.y)/70))})`;sctx.beginPath();sctx.moveTo(d.x,d.y);sctx.lineTo(d.x-d.vx/d.vy*d.len,d.y-d.len);sctx.stroke();return true});
    sctx.fillStyle='#202020';splashes=splashes.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.22*dt;p.life-=.055*dt;if(p.life<=0)return false;sctx.globalAlpha=p.life*.55;sctx.fillRect(p.x-.6,p.y-.6,1.3,1.3);return true});sctx.globalAlpha=1;
    if(on||drops.length||splashes.length)rainFrame=requestAnimationFrame(rainTick);else{rainFrame=0;rainLast=0;spawn=0}
  }
  function startRain(){if(reduced.matches)return;raining=true;rainFrom=performance.now();rainUntil=0;sizeSky();measureLines();if(!rainFrame)rainFrame=requestAnimationFrame(rainTick)}
  function stopRain(){if(!raining)return;raining=false;rainUntil=rainFrom+900}

  reduced.addEventListener('change',()=>{if(reduced.matches){cancelAnimationFrame(cloudFrame);cloudFrame=0;cx=cy=tx=ty=v=0;s=ts=1;mark.style.transform='none';raining=false;rainUntil=0;drops=[];splashes=[]}});

  // A cover with a recording (ZNTR) plays it while in view and pauses out of view.
  // The still remains underneath until playback starts; reduced motion keeps the still.
  const covers=[...document.querySelectorAll('[data-cover-video]')].map(cover=>({cover,slot:cover.querySelector('.cover-panel')||cover,video:null,inView:false}));
  function syncCovers(){covers.forEach(c=>{
    const run=c.inView&&!document.hidden&&!reduced.matches;
    if(reduced.matches&&c.video){c.video.remove();c.video=null;c.slot.classList.remove('is-moving');return}
    if(run&&!c.video){const v=document.createElement('video');v.className='cover-motion';v.muted=true;v.loop=true;v.playsInline=true;v.preload='auto';v.tabIndex=-1;v.setAttribute('aria-hidden','true');v.src=c.cover.dataset.coverVideo;v.addEventListener('playing',()=>c.slot.classList.add('is-moving'));c.slot.append(v);c.video=v}
    if(c.video){if(run)c.video.play().catch(()=>{});else c.video.pause()}
  })}
  const coverObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{covers.find(c=>c.cover===e.target).inView=e.isIntersecting});syncCovers()},{threshold:.2});
  covers.forEach(c=>coverObserver.observe(c.cover));document.addEventListener('visibilitychange',syncCovers);reduced.addEventListener('change',syncCovers);

  // The header marks the part of the page being read.
  const navLinks=[...document.querySelectorAll('.pf-links a[href*="#"]')];
  const spy=new IntersectionObserver(entries=>{entries.forEach(e=>{const link=navLinks.find(a=>a.hash==='#'+e.target.getAttribute('aria-labelledby'));if(link)e.isIntersecting?link.setAttribute('aria-current','location'):link.removeAttribute('aria-current')})},{rootMargin:'-40% 0px -59% 0px'});
  document.querySelectorAll('.selected-work,.experiments').forEach(section=>spy.observe(section));

  // Experiments and archives can also be read as an index, newest first, built from the same records as the viewer.
  const lab=document.querySelector('.experiments'),grid=lab.querySelector('.experiment-grid'),index=lab.querySelector('.experiment-index'),viewButtons=[...lab.querySelectorAll('[data-view]')];
  lab.dataset.view='grid';lab.querySelector('.lab-count').textContent=data.length;
  const byYear=data.map((item,i)=>i).sort((a,b)=>(data[b].year||0)-(data[a].year||0)||a-b);
  index.append(...byYear.map((i,n)=>{
    const item=data[i],li=document.createElement('li'),row=document.createElement('button'),thumb=new Image(),cell=(name,text)=>{const s=document.createElement('span');s.className=name;s.textContent=text;return s};
    li.style.setProperty('--i',n);row.type='button';row.className='index-row';row.dataset.experiment=i;row.setAttribute('aria-haspopup','dialog');
    thumb.className='index-thumb'+(item.monochrome?' is-mono':'');thumb.src=item.image;thumb.alt='';thumb.loading='lazy';thumb.decoding='async';
    const year=cell('index-year',item.year||'');if(n&&data[byYear[n-1]].year===item.year)year.classList.add('is-repeat');
    row.append(thumb,year,cell('index-title',item.title),cell('index-type',item.type||''),cell('index-page',item.href?'Full project':''));li.append(row);return li;
  }));

  const dialog=document.querySelector('.experiment-dialog'),shell=dialog.querySelector('.dialog-shell'),media=dialog.querySelector('.dialog-media'),controls=dialog.querySelector('.gallery-controls'),closeBtn=dialog.querySelector('.dialog-close');
  let current,slide=0,trigger,busy=false,pendingClose=false,playing=false,scrollY=0,filmTimer=0,filmFrame=null;
  const decode=img=>Promise.race([img.decode().catch(()=>{}),new Promise(r=>setTimeout(r,2500))]);
  function playLocalFilm(){
    const video=document.createElement('video');video.src=current.localVideo;video.poster=current.image;video.controls=true;video.loop=true;video.muted=true;video.playsInline=true;video.setAttribute('aria-label',current.title+' video');
    media.replaceChildren(video);playing=true;video.play().catch(()=>{});
  }
  function render(){
    clearTimeout(filmTimer);filmFrame=null;media.replaceChildren();playing=false;media.classList.toggle('is-monochrome',!!current.monochrome);
    const project=dialog.querySelector('.experiment-project');project.hidden=!current.href;if(current.href)project.href=current.href;
    const img=new Image();img.src=current.images?current.images[slide]:current.image;img.alt=current.title+(current.images?` — image ${slide+1}`:' — video preview');media.append(img);
    controls.hidden=!current.images||current.images.length<2;
    dialog.querySelector('.gallery-count').textContent=current.images?`${String(slide+1).padStart(2,'0')} / ${String(current.images.length).padStart(2,'0')}`:'';
    let direct=dialog.querySelector('.video-external');if(!direct){direct=document.createElement('a');direct.className='video-external';direct.target='_blank';direct.rel='noopener noreferrer';direct.textContent='Watch on Vimeo ↗';dialog.querySelector('.dialog-actions').append(direct)}direct.classList.remove('has-error');direct.classList.toggle('is-full-film',!!current.localVideo&&!!current.video);direct.hidden=!current.video;if(current.video)direct.href=`https://vimeo.com/${current.video}`;
    if(current.video&&!current.localVideo){
      const play=document.createElement('button');play.className='video-play';play.innerHTML='<span>Play film</span>';play.setAttribute('aria-label',`Play ${current.title}`);
      play.addEventListener('click',()=>{
        if(busy)return;clearTimeout(filmTimer);play.disabled=true;play.firstElementChild.textContent='Loading…';
        const iframe=document.createElement('iframe');iframe.src=`https://player.vimeo.com/video/${current.video}?autoplay=1&title=0&byline=0&portrait=0`;iframe.title=`${current.title} video`;iframe.allow='autoplay; fullscreen; picture-in-picture';iframe.allowFullscreen=true;iframe.style.opacity='0';iframe.style.pointerEvents='none';
        filmFrame=iframe;media.append(iframe);playing=true;
        filmTimer=setTimeout(()=>filmFailed(iframe),15000);
      });media.append(play);
    }
    if(current.localVideo){const play=document.createElement('button');play.className='video-play';play.innerHTML='<span>Play film</span>';play.setAttribute('aria-label','Play '+current.title);play.addEventListener('click',()=>{if(!busy)playLocalFilm()});media.append(play)}
    return img;
  }
  function filmFailed(iframe){
    if(filmFrame!==iframe)return;clearTimeout(filmTimer);iframe.remove();filmFrame=null;playing=false;
    const play=media.querySelector('.video-play');if(play){play.disabled=false;play.firstElementChild.textContent='Try again'}
    dialog.querySelector('.video-external')?.classList.add('has-error');
  }
  addEventListener('message',event=>{
    if(event.origin!=='https://player.vimeo.com'||!filmFrame||filmFrame.contentWindow!==event.source)return;
    let m;try{m=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return}
    if(m.event==='ready'){for(const value of ['play','timeupdate','error'])filmFrame.contentWindow.postMessage(JSON.stringify({method:'addEventListener',value}),'https://player.vimeo.com')}
    if(m.event==='play'||m.event==='timeupdate'){clearTimeout(filmTimer);media.querySelector('img')?.remove();media.querySelector('.video-play')?.remove();filmFrame.style.opacity='1';filmFrame.style.pointerEvents='auto';}
    if(m.event==='error')filmFailed(filmFrame);
  });
  // A grid card, or the floating index preview, is where the viewer grows from and returns to.
  function sourceOf(button){return button.querySelector('.experiment-media')||(peek.dataset.for===button.dataset.experiment&&peek.classList.contains('is-on')?peek.firstElementChild:null)}
  function cardTransform(from){const to=media.getBoundingClientRect();return {transform:'translate('+ (from.left+from.width/2-to.left-to.width/2)+'px,'+(from.top+from.height/2-to.top-to.height/2)+'px) scale('+from.width/to.width+','+from.height/to.height+')',borderRadius:'12px'}}
  async function enter(from){
    if(reduced.matches)return;
    const caption=dialog.querySelector('.dialog-caption');
    const animations=[media.animate(from?[cardTransform(from),{transform:'translate(0,0) scale(1)',borderRadius:'8px'}]:[{opacity:0,transform:'scale(.97)'},{opacity:1,transform:'scale(1)'}],{duration:from?420:300,easing:'cubic-bezier(.22,.8,.22,1)'}),caption.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:140,fill:'backwards'})];
    await Promise.allSettled(animations.map(a=>a.finished));
  }
  document.querySelectorAll('[data-experiment]').forEach(button=>button.addEventListener('click',async()=>{
    if(busy||dialog.open)return;busy=true;pendingClose=false;trigger=button;current=data[+button.dataset.experiment];slide=0;scrollY=window.scrollY;
    dialog.querySelector('#experiment-title').textContent=current.title;dialog.querySelector('#experiment-description').textContent=current.description;
    const img=render();await decode(img);dialog.style.setProperty('--media-ratio',img.naturalWidth&&img.naturalHeight?img.naturalWidth/img.naturalHeight:16/9);const from=sourceOf(button)?.getBoundingClientRect();hideLabel();hidePeek();hideHint();dialog.classList.remove('is-closing');dialog.classList.add('is-animating');dialog.showModal();syncPreviews();document.body.classList.add('is-modal-open');shell.scrollTop=0;
    await enter(from);dialog.classList.remove('is-animating');
    closeBtn.focus({preventScroll:true});busy=false;if(pendingClose)close();else if(current.localVideo&&!reduced.matches)playLocalFilm();
  }));
  async function close(){
    if(!dialog.open)return;if(busy){pendingClose=true;return}busy=true;pendingClose=false;
    
    clearTimeout(filmTimer);filmFrame=null;hideHint();dialog.classList.add('is-closing','is-animating');
    // Remove playing media immediately, so sound cannot continue under the return animation.
    if(playing){media.querySelector('video')?.pause();const f=media.querySelector('iframe');if(f){f.remove();const poster=new Image();poster.src=current.image;poster.alt=current.title;media.replaceChildren(poster)}}
    if(!reduced.matches){const from=trigger.querySelector('.experiment-media')?.getBoundingClientRect();const caption=dialog.querySelector('.dialog-caption');const animations=[media.animate([{transform:'translate(0,0) scale(1)',opacity:1},from?{...cardTransform(from),opacity:0}:{transform:'scale(.97)',opacity:0}],{duration:300,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}),caption.animate([{opacity:1},{opacity:0}],{duration:120,fill:'forwards'})];await Promise.allSettled(animations.map(a=>a.finished));animations.forEach(a=>a.cancel())}
    dialog.close();dialog.classList.remove('is-animating');shell.getAnimations().forEach(a=>a.cancel());syncPreviews();media.replaceChildren();document.body.classList.remove('is-modal-open');shell.style.opacity='1';window.scrollTo({top:scrollY,behavior:'instant'});trigger.focus({preventScroll:true});busy=false;
  }
  closeBtn.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog)close()});
  async function change(n){
    if(busy||!current?.images)return;busy=true;pendingClose=false;
    const next=(slide+n+current.images.length)%current.images.length,img=new Image();img.src=current.images[next];await decode(img);
    const outgoing=media.querySelector('img')?.cloneNode(true);media.querySelector('video')?.pause();
    slide=next;const incoming=render();dialog.classList.add('is-animating');
    if(!reduced.matches){const animations=[];if(outgoing){outgoing.setAttribute('aria-hidden','true');media.append(outgoing);animations.push(outgoing.animate([{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX('+(-n*28)+'px)'}],{duration:250,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}))}animations.push(incoming.animate([{opacity:0,transform:'translateX('+(n*28)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:280,easing:'cubic-bezier(.2,.8,.2,1)'}));await Promise.allSettled(animations.map(a=>a.finished));outgoing?.remove();animations.forEach(a=>a.cancel())}
    dialog.classList.remove('is-animating');busy=false;if(pendingClose)close();
  }
  let touchStart=null;
  media.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&current?.images)touchStart={x:e.clientX,y:e.clientY}});
  media.addEventListener('pointerup',e=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)change(dx<0?1:-1)});
  media.addEventListener('pointercancel',()=>touchStart=null);
  dialog.querySelector('.gallery-prev').addEventListener('click',()=>change(-1));dialog.querySelector('.gallery-next').addEventListener('click',()=>change(1));
  dialog.addEventListener('keydown',e=>{if(e.target.tagName==='VIDEO'&&e.key.startsWith('Arrow'))return;if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button,a[href],iframe,video')].filter(el=>el.getClientRects().length&&!el.disabled),first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}if(e.key==='ArrowRight'){e.preventDefault();change(1)}if(e.key==='ArrowLeft'){e.preventDefault();change(-1)}});

  // Local and Vimeo previews share a two-film viewport budget.
  // The poster stays visible until playback is confirmed, including network failures.
  const previewEntries=[...grid.querySelectorAll('[data-experiment]')].filter(b=>data[+b.dataset.experiment].video||data[+b.dataset.experiment].localVideo).map(b=>({button:b,media:b.querySelector('.experiment-media'),item:data[+b.dataset.experiment],ratio:0,frame:null,failed:false,timer:0,playedAt:0}));
  function removePreview(entry){clearTimeout(entry.timer);if(entry.frame?.tagName==='VIDEO')entry.frame.pause();entry.frame?.remove();entry.frame=null;entry.media.classList.remove('is-playing')}
  function syncPreviews(){
    const eligible=!document.hidden&&!reduced.matches&&!dialog.open&&lab.dataset.view!=='index';
    const active=eligible?previewEntries.filter(e=>e.ratio>=.25&&!e.failed).sort((a,b)=>Number(!!b.frame)-Number(!!a.frame)||a.playedAt-b.playedAt||b.ratio-a.ratio).slice(0,innerWidth>1000?4:2):[];
    previewEntries.forEach(entry=>{
      if(!active.includes(entry)){removePreview(entry);return}if(entry.frame)return;entry.playedAt=performance.now();
      if(entry.item.localVideo){
        const video=document.createElement('video');video.className='motion-preview';video.muted=true;video.loop=true;video.playsInline=true;video.preload='metadata';video.tabIndex=-1;video.setAttribute('aria-hidden','true');video.poster=entry.item.image;video.src=entry.item.localVideo;
        entry.frame=video;entry.media.append(video);
        video.addEventListener('playing',()=>{if(entry.frame===video)entry.media.classList.add('is-playing')});
        video.addEventListener('error',()=>{if(entry.frame===video){entry.failed=true;removePreview(entry);syncPreviews()}});
        video.play().catch(()=>{if(entry.frame===video){entry.failed=true;removePreview(entry);syncPreviews()}});return;
      }
      const f=document.createElement('iframe');f.className='motion-preview';f.title=entry.item.title+' — muted preview';f.tabIndex=-1;f.setAttribute('aria-hidden','true');f.allow='autoplay';
      f.src='https://player.vimeo.com/video/'+entry.item.video+'?background=1&autoplay=1&muted=1&loop=1&autopause=0&controls=0&title=0&byline=0&portrait=0&dnt=1';entry.frame=f;entry.media.append(f);
      entry.timer=setTimeout(()=>{if(!entry.media.classList.contains('is-playing')){entry.failed=true;removePreview(entry);syncPreviews()}},18000);
    });
  }
  const previewObserver=new IntersectionObserver(entries=>{entries.forEach(obs=>{const e=previewEntries.find(e=>e.media===obs.target);e.ratio=obs.intersectionRatio});syncPreviews()},{threshold:[0,.25,.5,.75,1]});
  previewEntries.forEach(e=>previewObserver.observe(e.media));
  addEventListener('message',event=>{
    if(event.origin!=='https://player.vimeo.com')return;const entry=previewEntries.find(e=>e.frame?.contentWindow===event.source);if(!entry)return;
    let message;try{message=typeof event.data==='string'?JSON.parse(event.data):event.data}catch{return}
    const send=(method,value)=>entry.frame?.contentWindow.postMessage(JSON.stringify({method,value}),'https://player.vimeo.com');
    if(message.event==='ready'){send('addEventListener','play');send('addEventListener','timeupdate');send('setVolume',0);send('play')}
    if(message.event==='play'||message.event==='timeupdate'){entry.media.classList.add('is-playing');clearTimeout(entry.timer)}
    if(message.event==='error'){entry.failed=true;removePreview(entry);syncPreviews()}
  });
  document.addEventListener('visibilitychange',syncPreviews);reduced.addEventListener('change',syncPreviews);syncPreviews();

  // In the grid, a small label names the piece beside the pointer (or the focused card); in the index,
  // the hovered row's image floats beside the pointer. Both follow with a slight lag and stay off touch screens.
  const label=document.createElement('div'),peek=document.createElement('div'),peekImg=new Image();label.className='cursor-label';peek.className='index-peek';peekImg.alt='';peek.append(peekImg);
  [label,peek].forEach(el=>{el.setAttribute('aria-hidden','true');lab.append(el)});
  function follower(el,tilt){let x=0,y=0,tx=0,ty=0,r=0,frame=0;const tick=()=>{const k=reduced.matches?1:.26,px=x;x+=(tx-x)*k;y+=(ty-y)*k;r+=((tilt&&!reduced.matches?Math.max(-6,Math.min(6,(x-px)*.35)):0)-r)*.18;el.style.transform=`translate3d(${x}px,${y}px,0) rotate(${r}deg)`;frame=Math.abs(tx-x)+Math.abs(ty-y)+Math.abs(r)>.15?requestAnimationFrame(tick):0};return {to(nx,ny,jump){tx=nx;ty=ny;if(jump){x=nx;y=ny;r=0}if(!frame)frame=requestAnimationFrame(tick)}}}
  // Scrolling makes the browser repeat a pointermove at the same spot; only real movement should take over from keyboard focus.
  let labelFocus=null,pointerX=-1,pointerY=-1;const labelMove=follower(label,false),peekMove=follower(peek,true),mouse=e=>{if(!hover.matches||e.pointerType!=='mouse'||(e.clientX===pointerX&&e.clientY===pointerY))return false;pointerX=e.clientX;pointerY=e.clientY;return true};
  function hideLabel(){label.classList.remove('is-on');labelFocus=null}function hidePeek(){peek.classList.remove('is-on')}
  function nameLabel(i){if(label.dataset.for===String(i))return;label.dataset.for=i;const type=document.createElement('span');type.className='cl-type';type.textContent=[data[i].type,data[i].year].filter(Boolean).join(' · ');label.replaceChildren(document.createTextNode(data[i].title),type)}
  function showLabel(x,y,jump){label.classList.add('is-on');labelMove.to(x,y,jump)}
  function focusLabel(b){const r=b.getBoundingClientRect();showLabel(r.left+10,r.bottom-label.offsetHeight-10,true)}
  grid.addEventListener('pointermove',e=>{if(!mouse(e))return;const b=e.target.closest('[data-experiment]');if(!b)return hideLabel();labelFocus=null;nameLabel(+b.dataset.experiment);const w=label.offsetWidth,x=e.clientX+16+w>innerWidth-12?e.clientX-16-w:e.clientX+16;showLabel(x,e.clientY+18,!label.classList.contains('is-on'))});
  grid.addEventListener('pointerleave',hideLabel);
  grid.addEventListener('focusin',e=>{const b=e.target.closest('[data-experiment]');if(!b||!b.matches(':focus-visible'))return;labelFocus=b;nameLabel(+b.dataset.experiment);focusLabel(b)});
  grid.addEventListener('focusout',hideLabel);
  index.addEventListener('pointermove',e=>{if(!mouse(e))return;const b=e.target.closest('[data-experiment]');if(!b)return hidePeek();const i=b.dataset.experiment;if(peek.dataset.for!==i){peek.dataset.for=i;peekImg.src=data[i].image;peek.classList.toggle('is-mono',!!data[i].monochrome)}const w=peek.offsetWidth,h=peek.offsetHeight||w*.7;let x=e.clientX+28;if(x+w>innerWidth-16)x=e.clientX-28-w;const jump=!peek.classList.contains('is-on');peek.classList.add('is-on');peekMove.to(x,Math.max(80,Math.min(innerHeight-h-16,e.clientY-h/2)),jump)});
  index.addEventListener('pointerleave',hidePeek);
  addEventListener('scroll',()=>{hidePeek();if(labelFocus)focusLabel(labelFocus);else hideLabel()},{passive:true});
  // No close icon in the viewer: outside it, a small label beside the pointer says what a click will do.
  const closeHint=document.createElement('div'),hintMove=follower(closeHint,false);closeHint.className='cursor-label close-hint';closeHint.textContent='Close';closeHint.setAttribute('aria-hidden','true');dialog.append(closeHint);
  function hideHint(){closeHint.classList.remove('is-on')}
  dialog.addEventListener('pointermove',e=>{if(!hover.matches||e.pointerType!=='mouse')return;if(e.target!==dialog)return hideHint();const jump=!closeHint.classList.contains('is-on');closeHint.classList.add('is-on');hintMove.to(e.clientX+16,e.clientY+18,jump)});
  dialog.addEventListener('pointerleave',hideHint);
  function setView(view,save){lab.dataset.view=view;grid.hidden=view==='index';index.hidden=view!=='index';viewButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));hideLabel();hidePeek();syncPreviews();if(save)try{localStorage.setItem('experiments-view',view)}catch{}}
  viewButtons.forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view,true)));
  try{if(localStorage.getItem('experiments-view')==='index')setView('index')}catch{}

})();
