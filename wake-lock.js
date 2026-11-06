export function createScreenAwake({request,isVisible,onStatus}){
 let enabled=false,lock=null,pending=false;
 async function acquire(){
  if(!enabled)return;
  if(!isVisible()){onStatus('paused');return}
  if(lock&&!lock.released){onStatus('active');return}
  if(pending)return;pending=true;onStatus('requesting');
  try{
   const next=await request();
   if(!enabled||!isVisible()){await next.release();onStatus(enabled?'paused':'off');return}
   lock=next;next.addEventListener('release',()=>{if(lock!==next)return;lock=null;onStatus(enabled?'released':'off')});onStatus('active');
  }catch(e){onStatus(enabled?'denied':'off',e)}finally{pending=false}
 }
 async function release(){const old=lock;lock=null;if(old&&!old.released)try{await old.release()}catch{}onStatus(enabled?'paused':'off')}
 return {async setEnabled(value){enabled=!!value;if(enabled)await acquire();else await release()},async refresh(){if(isVisible())await acquire();else await release()},release};
}
if(typeof document!=='undefined'){
 const area=document.createElement('div');area.className='screen-awake';area.innerHTML='<label><input id="keepScreenAwake" type="checkbox"> 保持螢幕開啟</label><span id="screenAwakeStatus" class="small" role="status">未啟用</span><button id="screenAwakeRetry" hidden>重新嘗試</button>';
 document.querySelector('header').after(area);
 const toggle=document.getElementById('keepScreenAwake'),status=document.getElementById('screenAwakeStatus'),retry=document.getElementById('screenAwakeRetry');
 const supported=window.isSecureContext&&!!navigator.wakeLock?.request;
 if(!supported){toggle.disabled=true;status.textContent='此瀏覽器不支援；請調整裝置的螢幕逾時設定'}else{
  const texts={off:'未啟用',requesting:'正在啟用…',active:'已啟用 · 螢幕保持開啟',paused:'已暫停 · 回到此頁後重新啟用',released:'系統已解除 · 可重新嘗試',denied:'未能啟用 · 請確認省電模式或瀏覽器設定'};
  const controller=createScreenAwake({request:()=>navigator.wakeLock.request('screen'),isVisible:()=>document.visibilityState==='visible',onStatus:s=>{status.textContent=texts[s];status.dataset.state=s;retry.hidden=!['released','denied'].includes(s)}});
  toggle.addEventListener('change',()=>controller.setEnabled(toggle.checked));retry.addEventListener('click',()=>controller.refresh());document.addEventListener('visibilitychange',()=>controller.refresh());window.addEventListener('pagehide',()=>controller.release());window.addEventListener('pageshow',()=>controller.refresh());
 }
}
