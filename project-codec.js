function base64(bytes){let pieces=[];for(let i=0;i<bytes.length;i+=32768)pieces.push(String.fromCharCode(...bytes.subarray(i,i+32768)));return btoa(pieces.join(''))}
function unbase64(text){return Uint8Array.from(atob(text),c=>c.charCodeAt(0))}
export async function encodeState(state){
 const buffers=[],seen=new Map();
 async function walk(value){
  if(value===null||typeof value!=='object')return value;
  if(value instanceof AudioBuffer){if(seen.has(value))return {$type:'audio',id:seen.get(value)};const id=buffers.length;seen.set(value,id);buffers.push({rate:value.sampleRate,length:value.length,channels:Array.from({length:value.numberOfChannels},(_,i)=>base64(new Uint8Array(value.getChannelData(i).buffer,value.getChannelData(i).byteOffset,value.length*4)))});return {$type:'audio',id}}
  if(value instanceof Float32Array)return {$type:'float32',data:base64(new Uint8Array(value.buffer,value.byteOffset,value.byteLength))};
  if(value instanceof Blob)return {$type:'blob',mime:value.type,data:base64(new Uint8Array(await value.arrayBuffer()))};
  if(Array.isArray(value)){const out=[];for(const v of value)out.push(await walk(v));return out}
  const out={};for(const [key,v] of Object.entries(value))out[key]=await walk(v);return out;
 }
 const data=await walk(state);return {format:'wave-studio-2',version:2,savedAt:new Date().toISOString(),buffers,data};
}
export async function decodeState(project,context){
 if(project.format!=='wave-studio-2'||!Array.isArray(project.buffers))throw Error('非有效 Wave Studio 專案');
 const buffers=project.buffers.map(b=>{if(!Number.isInteger(b.length)||b.length<1||!Array.isArray(b.channels)||b.channels.length<1||b.channels.length>32)throw Error('專案音訊參數錯誤');const out=context.createBuffer(b.channels.length,b.length,b.rate);b.channels.forEach((s,i)=>{const bytes=unbase64(s);if(bytes.byteLength!==b.length*4)throw Error('專案音訊資料不完整');out.copyToChannel(new Float32Array(bytes.buffer),i)});return out});
 function walk(value){
  if(value===null||typeof value!=='object')return value;
  if(value.$type==='audio'){if(!buffers[value.id])throw Error('專案音訊參照無效');return buffers[value.id]}
  if(value.$type==='float32'){const bytes=unbase64(value.data);if(bytes.length%4)throw Error('浮點資料長度錯誤');return new Float32Array(bytes.buffer)}
  if(value.$type==='blob')return new Blob([unbase64(value.data)],{type:value.mime});
  if(Array.isArray(value))return value.map(walk);
  const out={};for(const [k,v] of Object.entries(value))if(!['__proto__','prototype','constructor'].includes(k))out[k]=walk(v);return out;
 }
 return walk(project.data);
}
