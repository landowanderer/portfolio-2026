(()=>{
 const key=location.pathname.split('/').pop()||'index.html';
 const names={'livelarge.html':'project-adu','field-brief.html':'project-field','photo-dump.html':'project-glitch','zntr.html':'project-zntr'};
 document.querySelectorAll('.project-grid .project>a').forEach(a=>{const name=names[new URL(a.href).pathname.split('/').pop()];if(name)a.querySelector('.project-cover').style.viewTransitionName=name});
 const selectors={'livelarge.html':'.ll-stage-hero','field-brief.html':'.fb-video','photo-dump.html':'.vimeo-lazy','zntr.html':'.vimeo-lazy'};
 if(selectors[key]){const hero=document.querySelector(selectors[key]);if(hero){hero.style.viewTransitionName=names[key];hero.style.contain='layout'}}
})();
// No line may hold a single word. CSS text-wrap:pretty misses some blocks, so each block's last two words are
// tied with a no-break space. Text added later (dialogs, index rows) is tied as it appears; tying twice changes nothing.
(()=>{
 const skip='script,style,svg,input,textarea,select,[aria-hidden=true],[hidden],.pf-links,.pf-end-links',isInline=el=>getComputedStyle(el).display.startsWith('inline');
 function tie(el){if(el.closest(skip))return;const cs=getComputedStyle(el);if(cs.display.startsWith('inline')||cs.display==='none'||cs.whiteSpace.includes('nowrap')||cs.whiteSpace==='pre')return;if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))return;
  const words=[],walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;
  while((node=walk.nextNode())){let p=node.parentElement,own=true;for(;p!==el;p=p.parentElement)if(p.matches(skip)||!isInline(p)){own=false;break}if(!own)continue;const re=/\S+/g;let m;while((m=re.exec(node.textContent)))words.push({node,start:m.index,end:m.index+m[0].length})}
  if(words.length<3)return;const a=words[words.length-2],z=words[words.length-1],pair=document.createRange();pair.setStart(a.node,a.start);pair.setEnd(z.node,z.end);if([...pair.getClientRects()].reduce((w,r)=>w+r.width,0)>el.clientWidth)return;
  const {node:n,end}=words[words.length-2],gap=n.textContent.slice(end).match(/^[ \t\n]+/);if(gap)n.textContent=n.textContent.slice(0,end)+'\u00a0'+n.textContent.slice(end+gap[0].length)}
 const run=root=>{if(root.nodeType===3)root=root.parentElement;if(!root||root.nodeType!==1)return;tie(root);root.querySelectorAll('*').forEach(tie)};
 const start=()=>{run(document.body);let queue=new Set(),frame=0;new MutationObserver(ms=>{ms.forEach(m=>m.addedNodes.forEach(n=>queue.add(n)));if(!frame)frame=requestAnimationFrame(()=>{frame=0;const q=queue;queue=new Set();q.forEach(n=>n.isConnected&&run(n))})}).observe(document.body,{childList:true,subtree:true})};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
