(function(root){
'use strict';
const clone=v=>structuredClone(v);
const MAX=750000;
function empty(){return {version:1,projects:[],tasks:[],todos:[],logs:[],oneThings:{},timer:null,holidays:[],ui:{hideDone:false,expanded:[],filter:'period',sort:'manual',includeTentative:true},legacySettings:{},migration:null};}
function validate(s){
 const fail=m=>{throw Error('資料格式不正確：'+m);};
 if(!s||s.version!==1)fail('版本不支援');
 if(new TextEncoder().encode(JSON.stringify(s)).length>MAX)fail('資料超過目前可同步大小，請先匯出備份');
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,180}$/.test(v);
 const str=v=>typeof v==='string';const num=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 for(const k of ['projects','tasks','todos','logs','holidays'])if(!Array.isArray(s[k]))fail(k);
 for(const k of ['projects','tasks','todos','logs']){const seen=new Set();for(const x of s[k]){if(!x||!id(x.id)||seen.has(x.id))fail(k+' 識別碼重複或缺少');seen.add(x.id);if(!str(x.name))fail(k+' 名稱');}}
 for(const p of s.projects){if(p.deletedAt!=null&&(!num(p.deletedAt)||p.deletedAt===0))fail('專案刪除時間');for(const k of ['periodCustomer','periodLabel','periodWork'])if(p[k]!=null&&!str(p[k]))fail('專案期別');}
 const ps=new Set(s.projects.map(x=>x.id)),ts=new Set(s.tasks.map(x=>x.id)),td=new Set(s.todos.map(x=>x.id));
 for(const p of s.projects)if(!date(p.start)||(p.deadline&&!date(p.deadline))||!/^#[0-9a-f]{6}$/i.test(p.color))fail('案件日期或色彩');
 for(const t of s.tasks)if(!ps.has(t.projectId)||!date(t.start)||!date(t.end)||t.end<t.start||!['work','waiting','milestone'].includes(t.kind)||!(t.estimate===null||num(t.estimate))||typeof t.done!=='boolean')fail('任務關聯、日期或估時');
 for(const t of s.todos)if(!['high','normal','low'].includes(t.priority)||!date(t.date)||(t.taskId&&!ts.has(t.taskId))||typeof t.done!=='boolean'||!(t.minutes==null||num(t.minutes)))fail('待辦');
 for(const l of s.logs)if(!date(l.date)||!num(l.minutes)||!num(l.createdAt)||(l.taskId&&!ts.has(l.taskId))||(l.todoId&&!td.has(l.todoId)))fail('工時紀錄');
 for(const h of s.holidays)if(!date(h.date))fail('假日');
 if(!s.oneThings||Array.isArray(s.oneThings)||typeof s.oneThings!=='object')fail('ONE Thing');
 for(const [d,o]of Object.entries(s.oneThings))if(!date(d)||!o||!str(o.text)||typeof o.done!=='boolean'||(o.taskId&&!ts.has(o.taskId)))fail('ONE Thing');
 if(s.timer){const t=s.timer;if(!td.has(t.todoId)||(t.taskId&&!ts.has(t.taskId))||!num(t.accum)||!num(t.started)||typeof t.running!=='boolean'||!date(t.date)||!str(t.name))fail('計時器');}
 if(!s.ui||!Array.isArray(s.ui.expanded)||!s.ui.expanded.every(id)||!['period','week','all'].includes(s.ui.filter)||!['manual','deadline','start'].includes(s.ui.sort))fail('畫面設定');
 if(s.migration){if(Object.values(s.migration.summary||{}).some(v=>!num(v)))fail('核對統計');for(const r of s.migration.projects||[]){if(!num(r.bars)||!num(r.rawHours)||Object.values(r.dates||{}).some(v=>v&&!date(v)))fail('核對日期');}if(!s.migration.summary||!Array.isArray(s.migration.projects))fail('核對資料');for(const r of s.migration.projects)if(!id(r.projectId)||!ps.has(r.projectId)||!Array.isArray(r.candidates)||!Array.isArray(r.issues)||!r.dates)fail('核對案件');}
 return clone(s);
}
function payload(s){const copy=validate(s);copy.ui=empty().ui;return JSON.stringify(copy);}
function pauseTimer(s){s=clone(s);if(s.timer){if(s.timer.running)s.timer.accum+=Math.max(0,Date.now()-s.timer.started);s.timer.running=false;s.timer.started=Date.now();}return s;}
async function digest(v){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function backup(data){data=validate(data);return {format:'jia-design-desk',backupVersion:1,createdAt:new Date().toISOString(),data,sha256:await digest(JSON.stringify(data))};}
async function parseBackup(text){const b=JSON.parse(text);if(b.format==='jia-design-desk'){if(b.backupVersion!==1||b.sha256!==await digest(JSON.stringify(b.data)))throw Error('備份校驗失敗，檔案可能不完整');return validate(b.data);}return validate(b);}
class Store {
 constructor(storage,key,notify=()=>{}){this.storage=storage;this.key=key;this.notify=notify;this.adapter=null;this.busy=false;this.connected=false;this.conflict=false;this.remote=null;this.generation=0;this.status='尚未連線';this.localError=null;
  const raw=storage.getItem(key);try{this.e=raw?JSON.parse(raw):{data:empty(),base:0,dirty:false,uid:null};validate(this.e.data);if(!Number.isSafeInteger(this.e.base)||this.e.base<0||typeof this.e.dirty!=='boolean')throw Error('儲存格式錯誤');}catch(e){this.e={data:empty(),base:0,dirty:false,uid:null};this.localError='本機資料讀取失敗，原資料保留，請先匯出救援副本。';}
  this.disk=raw;this.change=()=>{};
 }
 get data(){return clone(this.e.data);}
 statusSet(s){this.status=s;this.notify();}
 persist(){if(this.localError)throw Error(this.localError);const disk=this.storage.getItem(this.key);if(disk!==this.disk)throw Error('另一個分頁已更新，請先備份目前內容並重新載入');const next=JSON.stringify(this.e);this.storage.setItem(this.key,next);this.disk=next;}
 save(data){const d=validate(data);if(this.localError)throw Error(this.localError);const changed=payload(d)!==payload(this.e.data);const old=this.e;this.e={...old,data:d,dirty:old.dirty||changed};try{this.persist();}catch(e){this.e=old;throw e;}if(changed){this.generation++;this.statusSet(this.connected?'等待同步':'已存本機，尚未同步');this.schedule();}}
 schedule(){clearTimeout(this.timeout);if(this.connected&&!this.conflict&&!this.busy)this.timeout=setTimeout(()=>this.flush(),700);}
 async connect(adapter,uid){if(this.e.uid&&this.e.uid!==uid)throw Error('目前資料屬於另一個帳戶，未連線');this.disconnect();const session=this.session;this.adapter=adapter;this.e.uid=uid;this.persist();this.statusSet('讀取雲端中');const remote=await adapter.read();if(session!==this.session)return;this.connected=true;this.receive(remote);this.unwatch=adapter.watch(r=>{if(session!==this.session)return;if(this.busy){this.pending=r;return;}try{this.receive(r);}catch(e){this.conflict=true;this.statusSet('雲端資料無法套用，已停止同步，請先備份');}},()=>{this.connected=false;this.statusSet('無法連線，變更仍保留本機');});}
 disconnect(){this.session=(this.session||0)+1;this.pending=undefined;clearTimeout(this.timeout);this.unwatch?.();this.unwatch=null;this.connected=false;this.adapter=null;this.conflict=false;this.remote=null;this.statusSet('尚未連線');}
 receive(r){this.remote=r;if(!r){if(this.e.base>0){this.conflict=true;this.statusSet('雲端資料不存在，已停止同步');}else{this.statusSet('雲端尚無資料，請確認首次建立');}return;}
  if(!Number.isSafeInteger(r.revision)||r.revision<1)throw Error('雲端版本格式錯誤');const next=validate(JSON.parse(r.payload));
  if(r.revision<this.e.base){this.conflict=true;this.statusSet('雲端版本較舊，已停止同步');return;}
  if(r.revision===this.e.base){this.statusSet(this.e.dirty?'等待同步':'已同步');if(this.e.dirty)this.schedule();return;}
  if(this.e.dirty||(this.canApply&&!this.canApply())){this.conflict=true;this.statusSet('兩端都有修改，請先處理資料差異');return;}
  this.e={...this.e,data:{...next,ui:this.e.data.ui},base:r.revision,dirty:false};this.persist();this.change(this.data);this.statusSet('已同步');
 }
 async flush(initialize=false){if(!this.connected||this.busy||this.conflict||(!this.e.dirty&&!initialize))return;if(!this.remote&&!initialize)return;
  this.busy=true;this.statusSet('同步中');const generation=this.generation,base=this.e.base,data=payload(this.e.data),adapter=this.adapter;
  try{const result=await adapter.commit(base,data);if(adapter!==this.adapter)return;this.e.base=result.revision;this.e.dirty=generation!==this.generation;this.remote=result;this.persist();this.statusSet(this.e.dirty?'等待同步':'已同步');}
  catch(e){if(e.code==='conflict'){this.conflict=true;this.statusSet('雲端已有新版，未覆蓋任何資料');try{this.remote=await adapter.read();}catch(readError){this.statusSet('雲端有新版但暫時無法讀取，請重新連線');}}else this.statusSet('同步失敗，變更仍保留本機');}
  finally{this.busy=false;if(adapter!==this.adapter)return;if(this.pending!==undefined){const r=this.pending;this.pending=undefined;try{this.receive(r);}catch(e){this.conflict=true;this.statusSet('雲端資料無法套用，已停止同步，請先備份');}}if(this.e.dirty&&this.status==='等待同步')this.schedule();}
 }
 async adoptRemote(){if(this.busy||!this.remote)throw Error('請等待同步結束');const data=validate(JSON.parse(this.remote.payload));this.checkpoint();this.e={...this.e,data:{...data,ui:this.e.data.ui},base:this.remote.revision,dirty:false};this.persist();this.conflict=false;this.change(this.data);this.statusSet('已採用雲端版本');}
 checkpoint(){const key=this.key+'-recovery-'+Date.now()+'-'+Math.random().toString(36).slice(2);this.storage.setItem(key,JSON.stringify(this.e.data));return key;}
 restore(data){if(this.busy||this.conflict)throw Error('請先結束同步或處理衝突');const checked=pauseTimer(validate(data));this.checkpoint();this.save(checked);this.change(this.data);}
}
root.DeskCore={empty,validate,payload,pauseTimer,backup,parseBackup,Store};
if(typeof module!=='undefined')module.exports=root.DeskCore;
})(globalThis);
