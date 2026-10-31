'use strict';
const SYNC_TEST=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('test');
const SYNC_KEY='jia-design-desk-v4'+(SYNC_TEST?'-qa':'');
let deskUnlocked=SYNC_TEST,deskUser=null,deskClient=null,authMessage='正在確認登入狀態…';
const DeskStore=new DeskCore.Store(localStorage,SYNC_KEY,()=>updateSyncStatus());
DeskStore.change=data=>window.dispatchEvent(new CustomEvent('desk-state',{detail:data}));
function updateSyncStatus(){const el=document.querySelector('#sync-status');if(el)el.textContent=DeskStore.status;const status=document.querySelector('#account-sync-status');if(status)status.textContent=DeskStore.status;}
function setAccess(unlocked){deskUnlocked=unlocked;const gate=document.querySelector('#access-gate');gate.hidden=unlocked;document.querySelector('#app-shell').inert=!unlocked;document.querySelector('#login-message').textContent=authMessage;window.dispatchEvent(new CustomEvent('desk-state',{detail:unlocked?DeskStore.data:DeskCore.empty()}));}
function errorMessage(e){const messages={'auth/popup-closed-by-user':'登入視窗已關閉，可再次登入。','auth/popup-blocked':'瀏覽器擋住登入視窗，請允許此網站開啟彈出視窗。','auth/unauthorized-domain':'此預覽網址尚未獲准登入，請使用 localhost 或正式網址。','permission-denied':'私人資料區權限尚未設定，資料仍保留本機。','unavailable':'目前無法連線，請稍後重試。'};return messages[e.code]||e.message||'操作未完成，請稍後重試。';}
async function bootAuth(){
 if(SYNC_TEST){authMessage='本機操作測試，不連接雲端';setAccess(true);return;}
 try{deskClient=await (await import('./firebase-client.js?v=0.4.2')).createClient();deskClient.observe(async user=>{
  DeskStore.disconnect();deskUser=null;setAccess(false);
  if(!user){authMessage='請使用你的 Google 帳戶登入。';setAccess(false);return;}
  try{const token=await user.getIdTokenResult();if(user.email!=='jamaisdesignss@gmail.com'||!user.emailVerified||token.signInProvider!=='google.com'){authMessage='此工作台只開放指定的 Google 帳戶。';await deskClient.logout();return;}
   deskUser=user;setAccess(true);await DeskStore.connect(deskClient.adapter(user.uid),user.uid);
  }catch(e){DeskStore.statusSet(errorMessage(e));}
 });}catch(e){authMessage='登入服務暫時無法載入，請確認網路後重新整理。';setAccess(false);}
}
async function downloadBackup(data,name='工作台備份'){const b=await DeskCore.backup(data);const blob=new Blob([JSON.stringify(b,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function accountPanel(){
 modal('帳戶與備份',`<p class="modal-description">${SYNC_TEST?'本機操作測試，不會連接 Firebase':esc(deskUser?.email||'未登入')}</p><div class="notice" id="account-sync-status">${esc(DeskStore.status)}</div><div class="account-actions"><button class="btn" id="sync-retry">重新連線</button>${DeskStore.connected&&!DeskStore.remote&&!DeskStore.e.base?'<button class="btn primary" id="cloud-create">首次建立雲端資料</button>':''}${DeskStore.conflict&&DeskStore.remote?'<button class="btn" id="cloud-adopt">處理同步差異</button>':''}</div><h3>備份與還原</h3><p class="modal-description">備份包含案件、待辦、工時與原始核對紀錄。還原前會顯示數量並保留目前副本。</p><div class="account-actions"><button class="btn primary" id="backup-export">下載完整備份</button><label class="btn">選擇還原檔案<input type="file" id="backup-import" accept=".json,application/json" hidden></label></div><div id="backup-check" role="status"></div><details><summary>還原前保留的本機副本</summary><div class="recovery-list">${Object.keys(localStorage).filter(k=>k.startsWith(SYNC_KEY+'-recovery-')).sort().reverse().map(k=>`<button class="text-btn" data-recovery="${esc(k)}">下載 ${new Date(Number(k.split('-recovery-')[1].split('-')[0])).toLocaleString('zh-TW')}</button>`).join('')||'<p>尚無還原操作。</p>'}</div></details><div class="modal-actions"><button class="btn" id="account-logout" ${SYNC_TEST?'disabled':''}>登出並鎖定畫面</button></div>`);
 $('#backup-export').onclick=()=>downloadBackup(state).catch(e=>toast(errorMessage(e)));
 $$('[data-recovery]').forEach(b=>b.onclick=()=>downloadBackup(JSON.parse(localStorage.getItem(b.dataset.recovery)),'還原前備份').catch(e=>toast(errorMessage(e))));
 $('#sync-retry').onclick=async()=>{try{if(SYNC_TEST){toast('本機測試模式不連接雲端');return;}await DeskStore.connect(deskClient.adapter(deskUser.uid),deskUser.uid);accountPanel();}catch(e){toast(errorMessage(e));}};
 if($('#cloud-create'))$('#cloud-create').onclick=()=>{if(!confirm('將目前工作台資料建立到 morning-d6ac9 的個人資料區？舊早課資料保持不變。'))return;DeskStore.flush(true).then(()=>accountPanel());};
 if($('#cloud-adopt'))$('#cloud-adopt').onclick=async()=>{if(!confirm('先備份目前本機內容，再改用雲端版本？本機尚未同步的變更會留在備份中。'))return;try{await downloadBackup(state,'同步差異-本機備份');await DeskStore.adoptRemote();accountPanel();}catch(e){toast(errorMessage(e));}};
 $('#backup-import').onchange=async e=>{const file=e.target.files[0];if(!file)return;const box=$('#backup-check');try{if(file.size>2000000)throw Error('檔案過大，請選擇工作台 JSON 備份');const incoming=await DeskCore.parseBackup(await file.text());box.innerHTML=`<div class="notice">待還原：${incoming.projects.length} 個案件、${incoming.tasks.length} 筆任務、${incoming.todos.length} 筆待辦、${incoming.logs.length} 筆工時。<br>目前：${state.projects.length} 個案件、${state.tasks.length} 筆任務。<br>還原後取代目前工作台內容；計時器會暫停。已連線時會同步至個人雲端資料區。</div><button class="btn primary" id="restore-confirm">備份目前內容並確認還原</button>`;$('#restore-confirm').onclick=async()=>{if(!confirm('確認以這份備份取代目前工作台內容？系統會先保留目前副本。'))return;try{await downloadBackup(state,'還原前備份');DeskStore.restore(incoming);closeModal();toast('已還原，原本內容已保留備份');}catch(err){toast(errorMessage(err));}};}catch(err){box.textContent=errorMessage(err);}};
 $('#account-logout').onclick=async()=>{if(DeskStore.busy){toast('正在同步，請稍後再登出');return;}if(DeskStore.e.dirty&&!confirm('還有尚未同步的內容，仍要登出？內容保留於此裝置，請勿清除瀏覽器資料。'))return;await deskClient.logout();closeModal();};
}
window.addEventListener('online',()=>{if(deskUser)DeskStore.connect(deskClient.adapter(deskUser.uid),deskUser.uid).catch(e=>DeskStore.statusSet(errorMessage(e)));});
window.addEventListener('offline',()=>DeskStore.statusSet('離線中，變更保留本機'));
window.addEventListener('beforeunload',e=>{if(DeskStore.e.dirty&&deskUnlocked){e.preventDefault();e.returnValue='';}});
document.querySelector('#google-login').onclick=async()=>{try{if(!deskClient){location.reload();return;}await deskClient.login();}catch(e){document.querySelector('#login-message').textContent=errorMessage(e);}};
