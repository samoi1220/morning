/* Project operations keep historical records and external billing data intact. */
(function(root){
'use strict';
const clone=v=>structuredClone(v);
const active=p=>!!p&&!p.deletedAt;
const closed=p=>['已結案','結案','已完成','完成','取消','已取消','completed','cancelled'].includes(p?.status?.trim());
const taskActive=(s,t)=>!!t&&active(s.projects.find(p=>p.id===t.projectId));
const todoActive=(s,t)=>!t.taskId||taskActive(s,s.tasks.find(x=>x.id===t.taskId));
function periodName(customer,period,work){const parts=[customer,period,work].map(x=>String(x||'').trim());if(parts.some(x=>!x||x.includes('｜')))throw Error('請填寫客戶、年月／期別與工作類型，欄位內不需加入「｜」');const result=parts.join('｜');if(result.length>120)throw Error('專案名稱請控制在 120 字內');return result;}
function related(s,id){const tasks=s.tasks.filter(t=>t.projectId===id),ids=new Set(tasks.map(t=>t.id));return {tasks,todos:s.todos.filter(t=>ids.has(t.taskId)),logs:s.logs.filter(l=>ids.has(l.taskId))};}
function archive(s,id,now=Date.now()){const next=clone(s),p=next.projects.find(p=>p.id===id);if(!active(p))throw Error('找不到可刪除的專案');const r=related(next,id);if(next.timer&&r.tasks.some(t=>t.id===next.timer.taskId))throw Error('請先結束這個專案的專注計時，再刪除專案');p.deletedAt=now;return next;}
function restore(s,id){const next=clone(s),p=next.projects.find(p=>p.id===id);if(!p?.deletedAt)throw Error('找不到已刪除的專案');delete p.deletedAt;return next;}
function copy(s,id,options,newId){const source=s.projects.find(p=>p.id===id);if(!active(source))throw Error('找不到可複製的專案');const name=periodName(options.customer,options.period,options.work);const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(!validDate(options.start)||(options.deadline&&(!validDate(options.deadline)||options.deadline<options.start)))throw Error('請確認新期別開始日期與交期');
 const selected=new Set(options.taskIds||[]),tasks=s.tasks.filter(t=>t.projectId===id&&selected.has(t.id));if(tasks.length!==selected.size)throw Error('選取的任務已變更，請重新開啟');
 const next=clone(s),p={id:newId(),name,type:source.type,status:'暫排',start:options.start,deadline:options.deadline||'',color:source.color,client:source.client||'',company:source.company||'',contact:source.contact||'',payment:source.payment||'',quote:'',notes:'',periodCustomer:options.customer.trim(),periodLabel:options.period.trim(),periodWork:options.work.trim()};
 const origin=tasks.length?tasks.map(t=>t.start).sort()[0]:source.start,offset=(Date.parse(options.start)-Date.parse(origin))/86400000,shift=d=>new Date(Date.parse(d)+offset*86400000).toISOString().slice(0,10);
 const copied=tasks.map(t=>({id:newId(),projectId:p.id,name:t.name,kind:t.kind,start:shift(t.start),end:shift(t.end),estimate:t.estimate,notes:t.notes||'',done:false,completionUnknown:false}));
 next.projects.push(p);next.tasks.push(...copied);next.ui.expanded.push(p.id);next.ui.filter='all';return {data:next,project:p,tasks:copied};
}
function pickerGroups(s,scope='active',query=''){const q=query.trim().toLocaleLowerCase(),rank=p=>['執行中','進行中','active'].includes(p.status)?0:p.status==='暫排'?1:2;
 return s.projects.filter(p=>active(p)&&(scope==='all'||(scope==='closed'?closed(p):!closed(p)))).sort((a,b)=>rank(a)-rank(b)).map(p=>{const match=p.name.toLocaleLowerCase().includes(q);return {project:p,tasks:s.tasks.filter(t=>t.projectId===p.id&&!t.done&&(t.kind==='work'||t.estimate>0)&&(match||t.name.toLocaleLowerCase().includes(q)))};}).filter(g=>g.tasks.length);
}
root.DeskProjects={active,closed,taskActive,todoActive,periodName,related,archive,restore,copy,pickerGroups};
if(typeof module!=='undefined')module.exports=root.DeskProjects;
})(globalThis);
