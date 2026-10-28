// Keep the user's fitted selection layout; the arena fills the available window.
const screen=document.querySelector('.site-shell');
const game=document.getElementById('game-screen');
let scheduled=false;
function fitScreens(){
  scheduled=false;
  const view=window.visualViewport;
  const width=view?.width||window.innerWidth;
  const height=view?.height||window.innerHeight;
  game.style.setProperty('--game-height',height+'px');
  const contentHeight=Math.max(screen.offsetHeight,screen.scrollHeight);
  const contentWidth=Math.max(screen.offsetWidth,screen.scrollWidth);
  if(!contentHeight||!contentWidth)return;
  const scale=Math.min(1,(height-8)/contentHeight,(width-8)/contentWidth);
  screen.style.setProperty('--viewport-scale',String(Math.max(.05,scale)));
  screen.style.setProperty('--viewport-top',Math.max(0,(height-contentHeight*scale)/2)+'px');
}
function scheduleFit(){if(!scheduled){scheduled=true;requestAnimationFrame(fitScreens);}}
new ResizeObserver(scheduleFit).observe(screen);
new MutationObserver(scheduleFit).observe(game,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('resize',scheduleFit);
window.visualViewport?.addEventListener('resize',scheduleFit);
document.fonts.ready.then(scheduleFit);
window.addEventListener('load',scheduleFit,{once:true});
scheduleFit();
