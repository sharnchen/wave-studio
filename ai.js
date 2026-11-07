import { allResults, saveResult, newResult } from './replay-store.js';
import { mountStemPlayer } from './stem-player.js?v=10';
import { clearModelCache } from './model-loader.js';
const el=id=>document.getElementById(id);
let busy=false,worker=null,jobId=0,resultUrls=[],lastActivity=0,timer=null,activeResult=null;
const status=text=>{el('aiStatus').textContent=text;lastActivity=Date.now()};
function finish(){worker?.terminate();worker=null;busy=false;clearInterval(timer);timer=null;el('aiRun').disabled=false;el('aiCancel').disabled=true;el('aiClearCache').disabled=false}
el('aiCancel').addEventListener('click',()=>{jobId++;finish();status('已取消背景工作，可重新選取音訊再試。')});
el('aiClearCache').addEventListener('click',async()=>{try{await clearModelCache();status('模型快取已清除')}catch(e){status('無法清除快取：'+e.message)}});
function showResults(blobs,snap){
 window.waveStudioStemPlayer?.dispose();
 resultUrls.forEach(u=>URL.revokeObjectURL(u));resultUrls=blobs.map(b=>URL.createObjectURL(b));el('aiResults').replaceChildren();
 for(let i=0;i<blobs.length;i++){
  const label=['伴奏','人聲'][i],section=document.createElement('section'),title=document.createElement('b'),link=document.createElement('a'),button=document.createElement('button');
  const name=snap.name.replace(/\.[^.]+$/,'')+'_'+label+'.wav';title.textContent=label;link.href=resultUrls[i];link.download=name;link.textContent='下載 '+label+' WAV';button.textContent='載入編輯器';
  button.addEventListener('click',async()=>{try{await window.waveStudioAI.addStem(blobs[i],name)}catch(e){status('載入失敗：'+e.message)}});section.append(title,link,button);el('aiResults').append(section);
 }
 mountStemPlayer(el('aiResults'),blobs,snap,{onError:e=>status('播放失敗：'+e.message)});
}
async function acceptResult(blobs,snap){
 const record=newResult(blobs,snap);activeResult=record.id;showResults(blobs,snap);
 const persisted=await saveResult(record);
 el('replayStatus').textContent=persisted?'分離結果已保存；可儲存專案，日後開啟專案即可還原回放。':'目前僅保留於本次分頁，請儲存專案或下載 WAV 備份。';
}
el('replayImport').addEventListener('click',async()=>{try{const accompaniment=el('replayMusic').files[0],vocals=el('replayVocals').files[0];if(!accompaniment||!vocals)throw Error('請分別選擇伴奏與人聲音訊');const context=window.waveStudioAI.getContext();const decoded=await Promise.all([accompaniment,vocals].map(async f=>context.decodeAudioData(await f.arrayBuffer())));await acceptResult([accompaniment,vocals],{name:accompaniment.name.replace(/[_-]伴奏/,'')+'（匯入回放）',seconds:Math.max(...decoded.map(b=>b.duration))})}catch(e){el('replayStatus').textContent=e.message}});
window.waveStudioReplay={
 async capture(){return {records:await allResults(),activeResult,player:window.waveStudioStemPlayer?.capture()||null}},
 async restore(state){window.waveStudioStemPlayer?.dispose();el('aiResults').replaceChildren();activeResult=null;for(const r of state?.records||[]){if(Array.isArray(r.blobs)&&r.blobs.length===2&&r.blobs.every(b=>b instanceof Blob))await saveResult(r)}const record=(await allResults()).find(r=>r.id===state?.activeResult);if(record){activeResult=record.id;showResults(record.blobs,record);window.waveStudioStemPlayer.restore(state.player)}el('replayStatus').textContent='專案分離結果已還原，可直接播放'},
 isBusy:()=>busy
};
el('aiRun').addEventListener('click',async()=>{
 if(busy)return;const id=++jobId;let snap;
 try{
  if(location.protocol==='file:')throw Error('請使用 HTTPS 網站或 localhost');
  busy=true;el('aiRun').disabled=true;el('aiCancel').disabled=false;el('aiClearCache').disabled=true;el('aiProgress').value=0;status('準備音訊…');
  await new Promise(resolve=>setTimeout(resolve,0));if(id!==jobId)return;
  snap=window.waveStudioAI.snapshot(el('aiSelection').checked);
  // Browser-native asynchronous decoder/resampler, not a JavaScript FFT loop.
  status('解碼音訊並轉換至 44,100 Hz…');
  const decoder=new OfflineAudioContext(2,1,44100),b=await decoder.decodeAudioData(await snap.blob.arrayBuffer());
  if(id!==jobId)return;
  const channels=[b.getChannelData(0).slice(),b.getChannelData(b.numberOfChannels>1?1:0).slice()];
  worker=new Worker(new URL('./ai-worker.js?v=quality-1',import.meta.url),{type:'module'});
  const started=Date.now();let currentText='啟動背景 AI…';status(currentText);
  timer=setInterval(()=>{if(busy){const elapsed=Math.floor((Date.now()-started)/1000);el('aiStatus').textContent=currentText+' · 已用 '+elapsed+' 秒'+(Date.now()-lastActivity>15000?'（背景運算中，可隨時取消）':'')}},1000);
  const say=text=>{currentText=text;status(text)};
  worker.onerror=e=>{if(id!==jobId)return;finish();status('背景工作錯誤：'+(e.message||'請重新整理後再試'))};
  worker.onmessage=event=>{
   if(id!==jobId)return;const m=event.data;
   if(m.type==='status')say(m.text);
   if(m.type==='download'){
    const p=m.progress,mb=n=>(n/1048576).toFixed(1);
    say(p.cached?'使用模型快取…':p.retry?'模型載入重試中…':'模型讀取：'+mb(p.received||0)+' MB'+(p.total?' / '+mb(p.total)+' MB':''));
    el('aiProgress').value=p.total ? .1*(p.received/p.total) : 0;
   }
   if(m.type==='progress'){
    const p=m.progress,f=Math.max(0,Math.min(1,p.fraction)),stage={'loading-model':'背景載入模型','demixing':'背景 AI 分離','writing-output':'背景產生結果'}[p.stage]||p.stage;
    el('aiProgress').value=p.stage==='loading-model'?f*.1:p.stage==='demixing'?.1+f*.85:.95+f*.05;
    say(stage+' · '+Math.round(f*100)+'%'+(p.chunk?' ('+p.chunk+'/'+p.totalChunks+')':'')+' · '+m.provider.toUpperCase());
   }
   if(m.type==='fallback'){window.waveStudioGPUFailed=true;el('aiBackend').value='wasm';say('GPU 失敗，背景 CPU 從頭重試…')}
   if(m.type==='done'){finish();acceptResult(m.blobs,snap).catch(e=>status('保存結果失敗：'+e.message));el('aiProgress').value=1;status('分離完成 · '+snap.seconds.toFixed(1)+' 秒 · '+m.provider.toUpperCase())}
   if(m.type==='error'){finish();status('背景處理失敗：'+m.text+'。可縮短選區後再試。')}
  };
  worker.postMessage({channels,quality:el('aiQuality').value,localFile:el('aiModelFile').files[0],preferGPU:el('aiBackend').value==='auto'&&!window.waveStudioGPUFailed},channels.map(c=>c.buffer));
 }catch(error){if(id===jobId){finish();status('處理失敗：'+error.message)}}
});
window.addEventListener('pagehide',()=>{worker?.terminate();window.waveStudioStemPlayer?.dispose();resultUrls.forEach(u=>URL.revokeObjectURL(u))});
