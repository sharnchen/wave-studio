import { getModel } from './model-loader.js';
const send=(type,data={})=>postMessage({type,...data});
self.onmessage=async event=>{
 const {channels,localFile,preferGPU,quality,backend,benchmark}=event.data;
 let urls=[],separator;
 const cleanup=async()=>{const old=separator;separator=null;if(!old)return;try{await old.model?.release?.()}catch{}if(old.modelPath?.startsWith('blob:'))URL.revokeObjectURL(old.modelPath)};
 try{
  send('status',{text:'背景工作：載入模型…'});
  const downloadStart=performance.now();
  const model=await getModel({signal:new AbortController().signal,localFile,onProgress:p=>send('download',{progress:p})});
  const modelReadMs=performance.now()-downloadStart;
  const {createSeparator,configureHostedRuntime,AudioUtils}=await import('./ai-engine.js?v=quality-1');
  await configureHostedRuntime();
  AudioUtils.loadAudioFile=async()=>channels;
  const seconds=channels[0].length/44100;
  const attempt=async provider=>{
   if(provider==='webnn'&&!navigator.ml?.createContext)throw Error('此瀏覽器未提供 WebNN；請檢查 Edge／Chrome 的 WebNN 支援');
   if(provider==='webgpu'&&(!navigator.gpu||!await navigator.gpu.requestAdapter()))throw Error('此瀏覽器無可用 WebGPU 裝置');
   send('backend',{provider});
   separator=createSeparator('Kim_Vocal_2',{common:{logLevel:'warning',normalizationThreshold:1,amplificationThreshold:0,onProgress:progress=>send('progress',{progress,provider})},mdx:{segmentSize:256,overlap:quality==='high'?.75:.25,enableDenoise:false,batchSize:1,executionProviders:provider==='webnn'?[{name:'webnn',deviceType:'gpu'}]:[provider]}});
   separator.modelPath=URL.createObjectURL(model);separator.downloadModel=async()=>{};
   let start=performance.now();await separator.loadModel();const loadMs=performance.now()-start;
   let inferenceMs=0,calls=0,firstMs=0;
   const session=separator.model,run=session.run.bind(session);
   session.run=async(...args)=>{const t=performance.now();const result=await run(...args);const ms=performance.now()-t;inferenceMs+=ms;if(!calls)firstMs=ms;calls++;return result};
   start=performance.now();const output=await separator.separate('worker-pcm');const processMs=performance.now()-start;
   if(!Array.isArray(output)||output.length!==2)throw Error('模型未產生預期的兩個結果');
   return {urls:output,provider,loadMs,inferenceMs,calls,firstMs,processMs,seconds};
  };
  if(benchmark){
   const rows=[];
   for(const provider of ['webnn','webgpu','wasm']){
    send('status',{text:'效能測試：'+provider.toUpperCase()+' · '+seconds.toFixed(1)+' 秒音訊'});
    try{const result=await attempt(provider);result.urls.forEach(u=>URL.revokeObjectURL(u));delete result.urls;rows.push({...result,ok:true})}
    catch(e){rows.push({provider,ok:false,error:String(e.message||e).slice(0,350)})}
    finally{await cleanup()}
    send('benchmark-progress',{rows,modelReadMs});
   }
   send('benchmark-done',{rows,modelReadMs});return;
  }
  let requested=backend|| (preferGPU?'auto':'wasm');
  let providers=requested==='webnn'?['webnn','webgpu','wasm']:requested==='wasm'?['wasm']:['webgpu','wasm'];
  let result;
  for(let i=0;i<providers.length;i++){
   try{result=await attempt(providers[i]);break}
   catch(e){if(i===providers.length-1)throw e;send('fallback',{from:providers[i],to:providers[i+1],text:String(e.message||e).slice(0,160)});await cleanup()}
  }
  urls=result.urls;
  const blobs=await Promise.all(urls.map(async url=>await (await fetch(url)).blob()));
  send('done',{blobs,provider:result.provider});
 }catch(error){send('error',{text:String(error.message||error).slice(0,350)})}
 finally{await cleanup();urls.forEach(url=>URL.revokeObjectURL(url))}
};
