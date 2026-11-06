// All inference is local. Only model weights are fetched from Hugging Face.
const el=id=>document.getElementById(id);
let busy=false, resultUrls=[];
const stages={'loading-model':'下載／載入模型','demixing':'AI 分離中','writing-output':'產生結果'};
el('aiRun').addEventListener('click',async()=>{
 if(busy)return;
 let separator,inputUrl;
 const status=s=>{el('aiStatus').textContent=s};
 try {
  if(location.protocol==='file:')throw Error('請以 HTTPS 網站或 localhost 開啟，不能直接雙擊 HTML');
  const snap=window.waveStudioAI.snapshot(el('aiSelection').checked);
  busy=true;el('aiRun').disabled=true;el('aiProgress').value=0;
  status('載入本機 AI 引擎…');
  const {createSeparator}=await import('./ai-engine.js');
  let provider='wasm';
  if(el('aiBackend').value==='auto'&&navigator.gpu){try{if(await navigator.gpu.requestAdapter())provider='webgpu'}catch{}}
  const config={common:{logLevel:'warning',normalizationThreshold:1,amplificationThreshold:0,onProgress:p=>{
   const f=Math.max(0,Math.min(1,p.fraction));
   el('aiProgress').value=p.stage==='loading-model'?f*.1:p.stage==='demixing'?.1+f*.85:.95+f*.05;
   status((stages[p.stage]||p.stage)+' · '+Math.round(f*100)+'%'+(p.chunk?` (${p.chunk}/${p.totalChunks})`:'')+' · '+provider.toUpperCase());
  }},mdx:{segmentSize:256,overlap:.25,batchSize:1,executionProviders:[provider]}};
  separator=createSeparator('Kim_Vocal_2',config);
  status('下載／載入 Kim Vocal 2 模型（約 67 MB）；首次需要網路…');
  try{await separator.loadModel()}catch(error){
   if(provider!=='webgpu')throw error;
   if(separator.model?.release)await separator.model.release().catch(()=>{});
   if(separator.modelPath?.startsWith('blob:'))URL.revokeObjectURL(separator.modelPath);
   provider='wasm';config.mdx.executionProviders=['wasm'];separator=createSeparator('Kim_Vocal_2',config);
   status('GPU 初始化失敗，改用 CPU 載入…');await separator.loadModel();
  }
  inputUrl=URL.createObjectURL(snap.blob);
  // This model's primary stem is vocals; the library returns secondary first.
  const urls=await separator.separate(inputUrl);
  if(urls.length!==2)throw Error('模型未產生預期的兩個結果');
  resultUrls.forEach(u=>URL.revokeObjectURL(u));resultUrls=urls;el('aiResults').replaceChildren();
  const labels=['伴奏','人聲'];
  for(let i=0;i<urls.length;i++){
   const section=document.createElement('section'),title=document.createElement('b'),player=document.createElement('audio'),link=document.createElement('a'),button=document.createElement('button');
   const name=snap.name.replace(/\.[^.]+$/,'')+'_'+labels[i]+'.wav';
   title.textContent=labels[i];player.controls=true;player.src=urls[i];link.href=urls[i];link.download=name;link.textContent='下載 '+labels[i]+' WAV';button.textContent='載入編輯器';
   button.addEventListener('click',async()=>{try{await window.waveStudioAI.addStem(await (await fetch(urls[i])).blob(),name)}catch(e){status('載入失敗：'+e.message)}});
   section.append(title,player,link,button);el('aiResults').append(section);
  }
  el('aiProgress').value=1;status(`分離完成 · ${snap.seconds.toFixed(1)} 秒 · ${provider.toUpperCase()}。請試聽檢查殘留與音質。`);
 }catch(error){console.error(error);status('處理失敗：'+error.message+'。可改用 CPU、縮短選區，或確認模型下載未被阻擋。');}
 finally{
  if(inputUrl)URL.revokeObjectURL(inputUrl);
  if(separator?.model?.release)await separator.model.release().catch(()=>{});
  if(separator?.modelPath?.startsWith('blob:'))URL.revokeObjectURL(separator.modelPath);
  busy=false;el('aiRun').disabled=false;
 }
});
window.addEventListener('pagehide',()=>resultUrls.forEach(u=>URL.revokeObjectURL(u)));
