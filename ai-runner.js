// A new session for every attempt avoids reusing partially computed stems.
export async function separateWithFallback({create, inputUrl, preferGPU, onBackend, onFallback, onCleanupError}) {
 let separator;
 const dispose=async()=>{
  const old=separator;separator=null;
  if(!old)return;
  try{await old.model?.release?.()}catch(e){onCleanupError?.(e)}
  if(old.modelPath?.startsWith('blob:'))URL.revokeObjectURL(old.modelPath);
 };
 const attempt=async(provider)=>{
  onBackend(provider);
  separator=create(provider);
  await separator.loadModel();
  const urls=await separator.separate(inputUrl);
  if(!Array.isArray(urls)||urls.length!==2)throw Error('模型未產生預期的兩個結果');
  return {urls,provider};
 };
 try{
  if(!preferGPU)return await attempt('wasm');
  try{return await attempt('webgpu')}
  catch(error){
   onFallback(error);
   await dispose();
   return await attempt('wasm');
  }
 }finally{await dispose()}
}
