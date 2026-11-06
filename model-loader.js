export const MODEL_URL=new URL('./models/Kim_Vocal_2.onnx',import.meta.url).href;
const CACHE='wave-studio-local-kim-vocal-2-v1';
export async function clearModelCache(){if(typeof caches!=='undefined')await caches.delete(CACHE)}
function validate(blob){if(blob.size<10*1024*1024||blob.size>200*1024*1024)throw Error('模型大小不符，請選擇完整的 Kim_Vocal_2.onnx');return blob}
export async function getModel({signal,onProgress,localFile}){
 if(localFile)return validate(localFile);
 let cache;
 try{cache=await caches.open(CACHE);const hit=await cache.match(MODEL_URL);if(hit){onProgress({cached:true});return validate(await hit.blob())}}catch{cache=null}
 for(let attempt=0;attempt<2;attempt++){
  if(signal.aborted)throw new DOMException('已取消下載','AbortError');
  const ctrl=new AbortController();let timer,totalTimer;
  const abort=()=>ctrl.abort(signal.reason);signal.addEventListener('abort',abort,{once:true});
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>ctrl.abort(new Error('下載連續 30 秒未收到資料')),30000)};
  totalTimer=setTimeout(()=>ctrl.abort(new Error('模型下載超過 5 分鐘')),300000);reset();
  try{
   onProgress({received:0,total:0,attempt});
   const r=await fetchModelResponse(ctrl.signal);if(!r.ok)throw Error('模型下載 HTTP '+r.status);
   if((r.headers.get('content-type')||'').includes('text/html'))throw Error('下載來源回傳網頁，並非模型');
   const total=Number(r.headers.get('content-length'))||0,reader=r.body?.getReader();if(!reader)throw Error('瀏覽器不支援串流下載，請改用本機模型');
   const chunks=[];let received=0;
   for(;;){const {done,value}=await reader.read();if(done)break;reset();received+=value.byteLength;if(received>200*1024*1024){await reader.cancel();throw Error('下載超過大小限制')}chunks.push(value);onProgress({received,total,attempt})}
   if(total&&received!==total)throw Error('模型下載不完整');
   clearTimeout(timer);clearTimeout(totalTimer);
   const blob=validate(new Blob(chunks,{type:'application/octet-stream'}));
   if(signal.aborted)throw new DOMException('已取消下載','AbortError');
   try{await cache?.put(MODEL_URL,new Response(blob))}catch{/* Cache quota must not prevent inference. */}
   return blob;
  }catch(error){
   if(signal.aborted)throw new DOMException('已取消下載','AbortError');
   if(attempt===1)throw Error((ctrl.signal.reason?.message||error.message)+'；可下載模型後選擇本機檔案');
   onProgress({retry:true});
  }finally{clearTimeout(timer);clearTimeout(totalTimer);signal.removeEventListener('abort',abort)}
 }
}

// The hosted model is split only for storage; inference uses the original bytes.
async function fetchModelResponse(signal){
 const manifestURL=new URL('./models/model-manifest.json',import.meta.url);
 const response=await fetch(manifestURL,{signal});
 if(!response.ok)throw Error('模型清單讀取失敗 HTTP '+response.status);
 const manifest=await response.json();
 if(!Array.isArray(manifest.parts)||!manifest.parts.length||!Number.isFinite(manifest.size))throw Error('模型清單格式錯誤');
 const stream=new ReadableStream({async start(controller){
  try{
   for(const part of manifest.parts){
    if(!/^Kim_Vocal_2\.part[0-9]+\.bin$/.test(part))throw Error('模型分段名稱無效');
    const r=await fetch(new URL(part,manifestURL),{signal});
    if(!r.ok)throw Error('模型分段讀取失敗 HTTP '+r.status);
    const reader=r.body.getReader();
    for(;;){const {done,value}=await reader.read();if(done)break;controller.enqueue(value)}
   }
   controller.close();
  }catch(error){controller.error(error)}
 }});
 return new Response(stream,{headers:{'content-type':'application/octet-stream','content-length':String(manifest.size)}});
}
