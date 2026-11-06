import { encodeState, decodeState } from './project-codec.js';
const el=id=>document.getElementById(id),saveButton=document.querySelector('.ws-part-7');let saving=false;
let projectURL;
function download(blob,name){if(projectURL)URL.revokeObjectURL(projectURL);document.getElementById('projectDownload')?.remove();projectURL=URL.createObjectURL(blob);const a=document.createElement('a');a.id='projectDownload';a.href=projectURL;a.download=name;a.textContent='下載完整專案：'+name;el('status').insertAdjacentElement('afterend',a);a.click()}
window.addEventListener('pagehide',()=>{if(projectURL)URL.revokeObjectURL(projectURL)});
window.saveProject=async()=>{
 if(saving)return;
 try{
  if(window.waveStudioReplay.isBusy())throw Error('請先等待 AI 完成，或取消 AI，再儲存完整專案');
  saving=true;saveButton.disabled=true;el('status').textContent='正在整理完整專案…';
  const editor=window.waveStudioProject.capture(),replay=await window.waveStudioReplay.capture();
  const encoded=await encodeState({editor,replay});let blob=new Blob([JSON.stringify(encoded)],{type:'application/json'}),extension='json';
  if(typeof CompressionStream!=='undefined'){blob=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();extension='wstudio'}
  download(blob,'Wave_Studio_Project.'+extension);el('status').textContent='完整專案已儲存：音訊、編輯歷程、分離紀錄、音量與播放位置。';
 }catch(e){el('status').textContent='專案儲存失敗：'+e.message}finally{saving=false;saveButton.disabled=false}
};
const legacy=el('project').onchange;
el('project').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(window.waveStudioReplay.isBusy())throw Error('請先取消或完成 AI 工作');
  el('status').textContent='正在還原完整專案…';
  let bytes=await file.arrayBuffer();
  if(new Uint8Array(bytes)[0]===31&&new Uint8Array(bytes)[1]===139){if(typeof DecompressionStream==='undefined')throw Error('此瀏覽器不支援壓縮專案');bytes=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}
  const project=JSON.parse(new TextDecoder().decode(bytes));if(project.format==='wave-studio-1'){await legacy(event);return}
  const state=await decodeState(project,window.waveStudioAI.getContext());
  if(!state.editor||!Array.isArray(state.replay?.records))throw Error('專案工作狀態不完整');
  if(window.waveStudioPlayback)window.waveStudioPlayback.restoreSource=state.editor.settings?.playbackSource||'editor';window.waveStudioProject.restore(state.editor);await window.waveStudioReplay.restore(state.replay);if(!state.replay.activeResult&&window.waveStudioPlayback){delete window.waveStudioPlayback.restoreSource;window.waveStudioPlayback.select('editor')}window.waveStudioPlayback?.render();el('status').textContent='專案已還原，播放維持暫停；已分離的伴奏與人聲可直接回放。';
 }catch(e){el('status').textContent='專案載入失敗：'+e.message}finally{event.target.value=''}
};
