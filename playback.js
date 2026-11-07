import {renderReplayWave} from './replay-wave.js?v=source-refresh-15';
const el=id=>document.getElementById(id);
const format=t=>Math.floor(t/60).toString().padStart(2,'0')+':'+(t%60).toFixed(3).padStart(6,'0');
function render(){
 const source=el('playbackSource').value,stem=window.waveStudioStemPlayer?.state(),state=source==='stems'?stem:window.waveStudioAI.editorState();
 if(source==='stems')window.waveStudioAI.drawLiveSpectrum?.();
 renderReplayWave(source==='stems'?window.waveStudioStemPlayer?.waveBuffers():null,state,el('stemMode').value);
 el('playbackSource').querySelector('[value=stems]').disabled=!stem?.ready;el('stemMode').disabled=source!=='stems'||!stem?.ready;
 el('playbackSeek').disabled=!state?.ready;el('playbackSeek').max=String(state?.duration||0);el('playbackSeek').value=String(state?.position||0);
 el('play').textContent=state?.playing?'Ⅱ 暫停':'▶ 播放';el('clock').textContent=format(state?.position||0);
 el('playbackRateRead').textContent=(Number(el('playbackRate').value)/100).toFixed(2)+'×';
 el('playbackInfo').textContent=(source==='stems'?'分離回放':'正常播放')+' · '+format(state?.position||0)+' / '+format(state?.duration||0);
}
function select(source){const actual=source==='stems'&&window.waveStudioStemPlayer?.state()?.ready?'stems':'editor';el('playbackSource').value=actual;window.waveStudioAI.stopEditor();window.waveStudioStemPlayer?.pause();delete el('ruler').dataset.replayDuration;render();if(actual==='editor')window.waveStudioAI.redrawEditor()}

window.waveStudioPlayback={render,select};
el('playbackSource').addEventListener('change',()=>select(el('playbackSource').value));
el('stemMode').addEventListener('change',()=>{window.waveStudioStemPlayer?.setMode(el('stemMode').value);render()});
el('playbackSeek').addEventListener('input',()=>{const t=+el('playbackSeek').value;if(el('playbackSource').value==='stems')window.waveStudioStemPlayer?.seek(t);else window.waveStudioAI.seekEditor(t);render()});
render();

function updateRate(){const rate=Number(el('playbackRate').value)/100;window.waveStudioAI.setEditorRate(rate);window.waveStudioStemPlayer?.setRate(rate);render()}
el('playbackRate').addEventListener('input',updateRate);el('playbackRateReset').addEventListener('click',()=>{el('playbackRate').value='100';updateRate()});
