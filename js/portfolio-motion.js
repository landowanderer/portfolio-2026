(()=>{
 const key=location.pathname.split('/').pop()||'index.html';
 const names={'livelarge.html':'project-adu','field-brief.html':'project-field','photo-dump.html':'project-glitch','zntr.html':'project-zntr'};
 document.querySelectorAll('.project-grid .project>a').forEach(a=>{const name=names[new URL(a.href).pathname.split('/').pop()];if(name)a.querySelector('.project-cover').style.viewTransitionName=name});
 const selectors={'livelarge.html':'.ll-stage-hero','field-brief.html':'.fb-video','photo-dump.html':'.vimeo-lazy','zntr.html':'.vimeo-lazy'};
 if(selectors[key]){const hero=document.querySelector(selectors[key]);if(hero){hero.style.viewTransitionName=names[key];hero.style.contain='layout'}}
})();