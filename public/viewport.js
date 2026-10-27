// Fit the existing interface without changing game rules or local content edits.
const screens=[document.querySelector('.site-shell'),document.getElementById('game-screen')].filter(Boolean);
let scheduled=false;
function fitScreens(){
  scheduled=false;
  const view=window.visualViewport;
  const width=view?.width||window.innerWidth;
  const height=view?.height||window.innerHeight;
  for(const screen of screens){
    if(screen.hidden)continue;
    // Layout dimensions stay unscaled, avoiding feedback when fonts, cards,
    // power-up badges or the window change size.
    const contentHeight=Math.max(screen.offsetHeight,screen.scrollHeight);
    const contentWidth=Math.max(screen.offsetWidth,screen.scrollWidth);
    if(!contentHeight||!contentWidth)continue;
    const scale=Math.min(1,(height-8)/contentHeight,(width-8)/contentWidth);
    screen.style.setProperty('--viewport-scale',String(Math.max(.05,scale)));
    screen.style.setProperty('--viewport-top',`${Math.max(0,(height-contentHeight*scale)/2)}px`);
  }
}
function scheduleFit(){
  if(!scheduled){scheduled=true;requestAnimationFrame(fitScreens);}
}
const resizeObserver=new ResizeObserver(scheduleFit);
for(const screen of screens)resizeObserver.observe(screen);
new MutationObserver(scheduleFit).observe(document.getElementById('game-screen'),{attributes:true,attributeFilter:['hidden']});
window.addEventListener('resize',scheduleFit);
window.visualViewport?.addEventListener('resize',scheduleFit);
document.fonts.ready.then(scheduleFit);
window.addEventListener('load',scheduleFit,{once:true});
scheduleFit();
