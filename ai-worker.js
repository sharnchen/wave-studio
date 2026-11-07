import { getModel } from './model-loader.js';
import { separateWithFallback } from './ai-runner.js';
const send=(type,data={})=>postMessage({type,...data});
self.onmessage=async event=>{
 const {channels,localFile,preferGPU,quality}=event.data;let urls=[];
 try{
  send('status',{text:'背景工作：載入模型…'});
  const model=await getModel({signal:new AbortController().signal,localFile,onProgress:p=>send('download',{progress:p})});
  send('status',{text:'背景工作：初始化運算引擎…'});
  const {createSeparator,configureHostedRuntime,AudioUtils}=await import('./ai-engine.js?v=quality-1');
  await configureHostedRuntime();
  // The UI decodes/resamples natively; workers have no OfflineAudioContext.
  AudioUtils.loadAudioFile=async()=>channels;
  let provider='wasm';
  if(preferGPU&&navigator.gpu){try{if(await navigator.gpu.requestAdapter())provider='webgpu'}catch{}}
  const result=await separateWithFallback({
   inputUrl:'worker-pcm',preferGPU:provider==='webgpu',
   onBackend:p=>{provider=p;send('backend',{provider:p})},
   create:p=>{
    const separator=createSeparator('Kim_Vocal_2',{common:{logLevel:'warning',normalizationThreshold:1,amplificationThreshold:0,onProgress:progress=>send('progress',{progress,provider})},mdx:{segmentSize:256,overlap:quality==='high'?.75:.25,enableDenoise:false,batchSize:1,executionProviders:[p]}});
    separator.modelPath=URL.createObjectURL(model);separator.downloadModel=async()=>{};return separator;
   },
   onFallback:error=>send('fallback',{text:String(error.message||error).slice(0,160)}),
   onCleanupError:e=>console.warn(e)
  });
  urls=result.urls;
  const blobs=await Promise.all(urls.map(async url=>await (await fetch(url)).blob()));
  send('done',{blobs,provider:result.provider});
 }catch(error){send('error',{text:String(error.message||error).slice(0,300)})}
 finally{urls.forEach(url=>URL.revokeObjectURL(url))}
};
