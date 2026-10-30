'use strict';

function restDay(d){return [0,6].includes(dayOfWeek(d))||(state.holidays||[]).some(h=>h.date===d);}
function unallocatedHours(){return state.tasks.filter(t=>!t.done&&t.estimate>0&&t.kind!=='milestone'&&workingDays(t.start,t.end).length===0).reduce((sum,t)=>sum+t.estimate/60,0);}
function estimateLabel(t){
 if(t.estimate>0)return `預估 ${t.estimate/60} 小時${t.kind==='work'?'':t.kind==='milestone'?'・節點計入':'・等待期間計入'}`;
 if(t.estimate===null)return '尚未估時';
 return t.kind==='waiting'?'等待客戶，原估時 0':t.kind==='milestone'?'交付節點，原估時 0':'預估 0 小時';
}
function completionLabel(t){return t.done?'已完成':t.completionUnknown?'完成待確認':t.kind==='waiting'?'等待中':'未完成';}
function migrationBanner(){return `<div class="migration-banner"><span>${SYNC_TEST?'本機操作測試 · 不連接雲端':'工作台資料保存狀態'}：<b id="sync-status">${esc(DeskStore.status)}</b></span><button class="text-btn" data-action="account">帳戶與備份 →</button></div>`;}
const mappingNames={matched:'已對應帳單',confirmed:'已確認對應',pending:'名稱待確認',recurring:'多期案件待拆分',internal:'營運事項'};
const billingStates={active:'執行中',completed:'已結案',proposal:'提案中',stopped:'暫停',cancelled:'取消'};
function mappingBadge(status){return `<span class="badge ${['pending','recurring'].includes(status)?'amber':status==='internal'?'gray':'green'}">${mappingNames[status]||'待確認'}</span>`;}
function legacyProjectEvidence(p){
 if(!p.legacy)return '';
 const m=p.legacy.morning,b=p.legacy.billing,r=state.migration.projects.find(x=>x.projectId===p.id);
 return `<div class="migration-evidence">${mappingBadge(p.mappingStatus)}<p>${esc(r?.reason||'')}</p>
 <details><summary>查看原始名稱、日期與狀態</summary><dl class="source-grid">
 <dt>甘特圖名稱</dt><dd>${esc(p.legacy.gantt?.name)}</dd>
 <dt>早課名稱</dt><dd>${esc(m?.name||'無早課案件')}</dd>
 <dt>帳單名稱</dt><dd>${esc(b?.name||'尚未確定對應')}</dd>
 <dt>原早課階段</dt><dd>${m?esc(['初稿','校對','印前','交稿','已結案'][m.stage]||'待確認'):'未登記'}</dd>
 <dt>帳單狀態</dt><dd>${esc(billingStates[b?.status]||b?.status||'未對應')}（僅供核對）</dd>
 <dt>原付款狀態</dt><dd>${esc(({unpaid:'未付款',deposit:'訂金',paid:'已付清'})[m?.payment]||m?.payment||'未登記')}</dd>
 <dt>帳單付款條件</dt><dd>${esc(b?.paymentTerms||'未填')}</dd>
 <dt>早課備註</dt><dd>${esc(m?.notes||'未填')}</dd></dl>
 ${r?datesEvidence(r):''}${r?.issues.length?`<ul>${r.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}</details>
 ${m?`<details class="legacy-stages"><summary>原早課階段細項（${Object.values(m.subtasks).flat().filter(x=>x.done).length} / ${Object.values(m.subtasks).flat().length} 已完成）</summary><p class="small-label">保留原勾選狀態供核對，尚未與排程任務逐項配對。</p>${Object.entries(m.subtasks).map(([stage,items])=>`<h3>${esc(['初稿','校對','印前','交稿'][Number(stage)]||stage)}</h3>${items.map(x=>`<div class="legacy-check"><input type="checkbox" disabled ${x.done?'checked':''} aria-label="${esc(x.text)}"><span>${esc(x.text)}</span></div>`).join('')}`).join('')}</details>`:''}</div>`;
}
function datesEvidence(r){const d=r.dates;return `<div class="source-dates"><div><b>甘特排程範圍</b><span>${d.ganttStart} → ${d.ganttEnd}</span></div><div><b>早課開始／交期</b><span>${d.morningStart||'未填'} → ${d.morningDeadline||'未填'}</span></div><div><b>帳單開始／結束</b><span>${d.billingStart||'未填'} → ${d.billingEnd||'未填'}</span></div></div>`;}
function migrationView(){
 if(!state.migration)return `<div class="page-heading"><div><h1>資料核對</h1><p>尚未匯入舊資料。可從「帳戶與備份」選擇已核對的整合資料檔案。</p><button class="btn" data-action="account">帳戶與備份</button></div></div>`;
 const s=state.migration.summary,records=state.migration.projects;
 return `<div class="page-heading"><div><div class="eyebrow">舊資料整合 · 2026.10.29</div><h1>資料核對</h1><p>名稱以帳單為準，工作紀錄保留來源。</p></div></div>
 <div class="review-stats"><div class="card"><strong>${s.linked}</strong><span>已對應帳單</span></div><div class="card"><strong>${s.pending}</strong><span>待確認對應</span></div><div class="card"><strong>${s.internal}</strong><span>營運事項</span></div><div class="card"><strong>${s.tasks}</strong><span>排程完整保留</span></div></div>
 <div class="card review-reconcile"><h2>匯入前後核對</h2><div class="reconcile-grid"><p><b>${s.estimatedHours} 小時</b><span>原排程預估工時<br>含等待／節點 ${s.nonworkHours} 小時</span></p><p><b>${formatMinutes(s.actualMinutes)}</b><span>${s.logs} 筆原專注紀錄<br>未自動歸入案件</span></p><p><b>${s.todos} 筆待辦</b><span>保留日期與勾選狀態<br>未擅自排入今天</span></p><p><b>${s.subtasks} 筆階段細項</b><span>可在案件詳情核對<br>${s.holidays} 筆假日沿用原設定</span></p></div><p class="small-label">上方是匯入時的核對基準；後續新增的工作與工時另行累計，保存狀態請查看頁首。</p><div class="review-links"><button class="btn small" data-action="legacy-todos">查看原待辦</button><button class="btn small" data-action="legacy-logs">查看原專注紀錄</button></div></div>
 <div class="notice">原甘特圖沒有任務完成欄位，因此標示「完成待確認」。${s.unknownEstimates} 筆原零工時工作先標示未估時。原有 ${s.unallocatedCount} 筆排程僅落在休息日，${s.unallocatedHours} 小時尚未分配到工作日，估時完整保留。日期、結案狀態的差異均保留；帳單結束日期不直接當成交期。</div>
 <div class="review-toolbar"><label>搜尋案件<input id="review-search" type="search" placeholder="輸入帳單、甘特圖或早課名稱"></label><label>顯示範圍<select id="review-filter"><option value="all">全部 ${s.projects} 項</option value="pending">待確認對應 ${s.pending} 項</option><option value="matched">已對應帳單 ${s.linked} 項</option><option value="internal">營運事項 ${s.internal} 項</option><option value="differences">日期或狀態有差異</option></select></label></div>
 <div class="review-projects">${records.map(r=>`<article class="card review-project" data-review-status="${r.status}" data-has-diff="${r.issues.length>0}" data-review-name="${esc([r.name,r.ganttName,r.morningName,...r.candidates.map(c=>c.name)].join(' ').toLowerCase())}"><div class="review-project-head"><h2>${esc(project(r.projectId)?.name||r.name)}</h2>${mappingBadge(r.status)}</div><p>${esc(r.reason)}</p><dl class="source-grid"><dt>甘特圖原名</dt><dd>${esc(r.ganttName)}</dd><dt>早課原名</dt><dd>${esc(r.morningName||'無早課案件')}</dd><dt>帳單對應</dt><dd>${r.billingId?esc(r.name)+' · '+esc(r.billingId):r.status==='internal'?'營運事項，無須對應帳單':'待確認'}</dd></dl>${datesEvidence(r)}${r.issues.length?`<ul class="review-issues">${r.issues.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
 ${r.candidates.length?`<details class="candidate-list"><summary>查看 ${r.candidates.length} 筆帳單候選（尚未套用）</summary>${r.candidates.map(c=>`<div><strong>${esc(c.name)}</strong><span>${esc((c.startDate||'').slice(0,10)||'開始日期未填')} · ${esc(c.clientOrg||c.clientName||'客戶未填')}</span><small>${esc(c.reason)} · 帳單 ID ${esc(c.id)}</small></div>`).join('')}</details>`:''}
 <div class="review-project-foot"><span>${r.bars} 筆原排程 · ${r.rawHours} 小時預估</span><button class="text-btn" data-action="project-detail" data-id="${r.projectId}">查看案件與任務 ${icon('right')}</button></div></article>`).join('')}</div><p id="review-empty" class="empty" hidden>沒有符合條件的案件。</p>`;
}
function bindMigration(){
 const input=$('#review-search'),select=$('#review-filter');if(!input||!select)return;
 const filter=()=>{let shown=0;$$('[data-review-status]').forEach(el=>{const status=el.dataset.reviewStatus,v=select.value;const matches=v==='all'||v==='pending'&&['pending','recurring'].includes(status)||v==='matched'&&['matched','confirmed'].includes(status)||v===status||v==='differences'&&el.dataset.hasDiff==='true';el.hidden=!(matches&&el.dataset.reviewName.includes(input.value.trim().toLowerCase()));if(!el.hidden)shown++;});$('#review-empty').hidden=shown>0;};
 input.oninput=filter;select.onchange=filter;
}
function carryLegacyTodo(id){
 const source=todo(id);if(!source||source.done)return false;
 if(state.todos.some(t=>t.date===today()&&t.legacyTodoId===id))return false;
 addTodo(source.name,{priority:source.priority,minutes:source.minutes,legacyTodoId:id});return true;
}
function showLegacyTodos(){
 const originals=state.todos.filter(t=>t.legacy);
 modal('原早課待辦紀錄',`<p class="modal-description">共 ${originals.length} 筆，保留原日期。將未完成項目選入今天時，原紀錄仍保留。</p><label class="inline-check"><input id="legacy-hide-done" type="checkbox" checked>只看原未完成</label><div class="legacy-records">${originals.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<div class="history-row legacy-todo-record" data-legacy-done="${t.done}" ${t.done?'hidden':''}><div>${t.done?'✓ ':''}${esc(t.name)}<small>${t.date} · ${t.done?'已完成':'原未完成'}</small></div>${!t.done?`<button class="btn small" data-carry="${t.id}" ${state.todos.some(a=>a.date===today()&&a.legacyTodoId===t.id)?'disabled':''}>${state.todos.some(a=>a.date===today()&&a.legacyTodoId===t.id)?'已選入今日':'選入今日'}</button>`:''}</div>`).join('')}</div>`);
 $('#legacy-hide-done').onchange=e=>$$('.legacy-todo-record').forEach(el=>el.hidden=e.target.checked&&el.dataset.legacyDone==='true');
 $$('[data-carry]').forEach(b=>b.onclick=()=>{if(carryLegacyTodo(b.dataset.carry)){b.disabled=true;b.textContent='已選入今日';render();toast('已選入今日，原待辦日期保持不變');}});
}
function showLegacyLogs(){const logs=state.logs.filter(l=>l.source==='legacy').sort((a,b)=>b.createdAt-a.createdAt);modal('原早課專注紀錄',`<p class="modal-description">${logs.length} 筆，共 ${formatMinutes(logs.reduce((s,l)=>s+l.minutes,0))}。保留原工作描述，尚未配對到專案任務。</p><div class="legacy-records">${logs.map(l=>`<div class="history-row"><div>${esc(l.name)}<small>${l.date} · 原番茄鐘紀錄</small></div><strong>${formatMinutes(l.minutes)}</strong></div>`).join('')}</div>`);}
