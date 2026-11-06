'use strict';
// The progress display reports GitHub step states, never simulated inference percentages.
function cloudStage(run, job) {
  const terminal=run.status==='completed';
  if(terminal && run.conclusion!=='success') return {index:-1,label:({cancelled:'任務已取消',timed_out:'處理逾時',failure:'雲端處理失敗',action_required:'需要在 GitHub 核准執行'})[run.conclusion]||'任務未成功完成',failed:true};
  const steps=job?.steps||[];
  if(steps.some(s=>s.conclusion==='failure'))return {index:-1,label:'雲端步驟執行失敗',failed:true};
  const find=name=>steps.find(s=>s.name===name);
  const publish=find('Publish results to repository'), inference=find('Run BS-RoFormer');
  if(publish?.conclusion==='success'||(terminal&&run.conclusion==='success'))return {index:4,label:'結果已發布，等待載入音軌'};
  if(inference?.conclusion==='success'||publish?.status==='in_progress')return {index:3,label:'正在發布人聲與伴奏'};
  if(inference?.status==='in_progress')return {index:2,label:'模型下載／RoFormer 推論中'};
  if(job?.status==='in_progress')return {index:1,label:'準備執行環境／安裝套件'};
  return {index:0,label:'等待 GitHub Actions 排隊'};
}
class CloudProgress {
  constructor(element,token){this.el=element;this.token=token;this.version=0;this.active=false;this.timer=setInterval(()=>this.clock(),1000)}
  start(id,sha){this.version++;this.id=id;this.sha=sha;this.run=null;this.next=0;this.anonymous=false;this.started=Date.now();this.ended=null;this.cloudEnded=null;this.active=true;this.el.hidden=false;this.el.innerHTML='<div class="cloud-title"><strong id="cloud-label"></strong><time id="cloud-elapsed"></time></div><progress id="cloud-meter" aria-label="雲端處理階段"></progress><ol id="cloud-stages"></ol><p id="cloud-detail"></p><a id="cloud-run" target="_blank" rel="noreferrer" hidden>查看此次任務 ↗</a>';this.show({index:0,label:'等待雲端任務建立'});this.note('正在取得 GitHub 的實際執行階段…');this.clock()}
  show(view){this.view=view;this.el.dataset.failed=!!view.failed;this.el.querySelector('#cloud-label').textContent=view.label;const meter=this.el.querySelector('progress');if(view.done){meter.max=1;meter.value=1}else meter.removeAttribute('value');meter.hidden=!!view.failed;const list=this.el.querySelector('ol');list.replaceChildren();['排隊','環境準備','模型推論','發布結果','載入音軌'].forEach((label,i)=>{const li=document.createElement('li');li.textContent=(view.done||i<view.index?'✓ ':i===view.index?'● ':'○ ')+label;li.dataset.state=view.done||i<view.index?'done':i===view.index?'active':'pending';list.append(li)});if(view.failed||view.done){this.active=false;this.ended=this.cloudEnded||Date.now()}}
  note(text){this.el.querySelector('#cloud-detail').textContent=text}
  clock(){if(!this.id)return;const s=Math.max(0,Math.floor(((this.ended||Date.now())-this.started)/1000));this.el.querySelector('time').textContent='已經過 '+Math.floor(s/60)+'分'+s%60+'秒'}
  async get(path){let token=this.token().trim();let headers={Accept:'application/vnd.github+json'};if(token&&!this.anonymous)headers.Authorization='Bearer '+token;let r=await fetch('https://api.github.com/repos/sharnchen/wave-studio/'+path,{headers,signal:AbortSignal.timeout(10000)});if((r.status===403||r.status===401)&&headers.Authorization){this.anonymous=true;r=await fetch('https://api.github.com/repos/sharnchen/wave-studio/'+path,{headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000)})}if(!r.ok)throw Error(r.status===403||r.status===429?'GitHub 查詢頻率或權限受限':'進度查詢暫時失敗 ('+r.status+')');return r.json()}
  async refresh(){if(!this.active||Date.now()<this.next)return;const version=this.version;this.next=Date.now()+30000;try{if(!this.sha){let commits=await this.get('commits?path='+encodeURIComponent('wave-studio2/jobs/'+this.id+'/input.wav')+'&per_page=1');if(version!==this.version)return;this.sha=commits[0]?.sha;if(!this.sha){this.note('尚未找到上傳紀錄，稍後重試。');return}}
    if(!this.run){let data=await this.get('actions/workflows/wave-studio2-separate.yml/runs?head_sha='+encodeURIComponent(this.sha)+'&per_page=10');if(version!==this.version)return;this.run=data.workflow_runs?.[0];if(!this.run){this.note('等待 GitHub 建立任務。若長時間未建立，請檢查 Actions 是否啟用。');return}}
    // Jobs are fetched fresh; run metadata is refreshed to detect cancellation and timeouts.
    let run=await this.get('actions/runs/'+this.run.id);if(version!==this.version)return;
    let data=await this.get('actions/runs/'+run.id+'/jobs?per_page=100');if(version!==this.version)return;
    this.run=run;if(run.status==='completed')this.cloudEnded=Date.parse(run.updated_at)||null;this.started=Date.parse(run.created_at)||this.started;const link=this.el.querySelector('#cloud-run');link.href=run.html_url;link.hidden=false;
    this.show(cloudStage(run,data.jobs?.find(j=>j.name==='separate')));
    this.note('依 GitHub Actions 實際步驟更新。模型推論目前不提供內部百分比；顯示階段與已經過時間。'+(this.anonymous||!this.token().trim()?' 公開查詢約每3分鐘更新。':' 約每30秒更新。'));
  }catch(e){if(version===this.version)this.note(e.message+'，將自動重試；仍會繼續檢查分離結果。')}finally{if(version===this.version)this.next=Date.now()+((this.anonymous||!this.token().trim())?180000:30000)}}
  loading(count){this.active=false;this.show({index:4,label:'正在載入音軌（'+count+'/2）'});this.note('正在下載並解碼人聲與伴奏。')}
  complete(){this.show({index:5,label:'處理完成，音軌已就緒',done:true});this.note('人聲與伴奏已載入，可播放或分別下載。')}
  fail(message){this.show({index:-1,label:'雲端處理失敗',failed:true});this.note(message)}
}
