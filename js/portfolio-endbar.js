(()=>{const header=document.querySelector('.pf-header'),end=document.querySelector('.pf-endbar');if(!header||!end)return;
 const observer=new IntersectionObserver(entries=>{const on=entries[0].isIntersecting;header.classList.toggle('is-at-end',on);header.inert=on;},{threshold:.2});observer.observe(end);
 header.addEventListener('focusin',()=>{header.classList.remove('is-at-end');header.inert=false});
})();
