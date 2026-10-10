import {hm,localDate,shiftDate} from './scheduler.ts';
export type Priority='urgent'|'high'|'normal'|'low';
export type Task={id:string;title:string;date:string;time?:number;minutes:number;priority:Priority;listId:string;notes:string;tags:string[];subtasks:{id:string;title:string;done:boolean}[];done:boolean;deleted:boolean;repeat:'none'|'daily'|'weekly'|'monthly';nextId?:string;created:number;completedAt?:string};
export type List={id:string;name:string;color:string};
export type Habit={id:string;name:string;days:string[]};
export type Idea={id:string;content:string;tags:string[];images?:string[];created:number};
export type Store={version:2;tasks:Task[];lists:List[];habits:Habit[];ideas:Idea[];focus:{date:string;minutes:number}[];theme:'light'|'dark'};
export const priorities:Record<Priority,string>={urgent:'高优先级',high:'中优先级',normal:'低优先级',low:'无优先级'};
export const weights={urgent:0,high:1,normal:2,low:3};
export const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const baseStore=():Store=>({version:2,tasks:[],lists:[{id:'work',name:'工作',color:'#5278df'},{id:'life',name:'生活',color:'#51a98b'},{id:'learn',name:'学习',color:'#b093ce'}],habits:[],ideas:[],focus:[],theme:'light'});
export function newTask(title:string,date='',listId='inbox'):Task{return {id:uid(),title:title.trim(),date,minutes:30,priority:'low',listId,notes:'',tags:[],subtasks:[],done:false,deleted:false,repeat:'none',created:Date.now()};}
export function parseQuick(text:string,base=localDate()){
 let title=text.trim(),date='',time:number|undefined; const tags=Array.from(title.matchAll(/#([^\s#]+)/g),x=>x[1]);title=title.replace(/#([^\s#]+)/g,'').trim();
 const explicit=title.match(/\b(\d{4}-\d{2}-\d{2})\b/);if(explicit){date=explicit[1];title=title.replace(explicit[0],'');}
 else {for(const [word,n] of [['后天',2],['明天',1],['今天',0]] as const){if(title.includes(word)){date=shiftDate(base,n);title=title.replace(word,'');break;}}}
 const clock=title.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/);if(clock){time=+clock[1]*60+ +clock[2];date=date||base;title=title.replace(clock[0],' ');}
 return {title:title.replace(/\s+/g,' ').trim(),date,time,tags};
}
export function nextRepeat(date:string,repeat:Task['repeat']){
 if(repeat!=='monthly')return shiftDate(date,repeat==='weekly'?7:1);
 const [y,m,d]=date.split('-').map(Number),max=new Date(y,m+1,0).getDate();return localDate(new Date(y,m,Math.min(d,max)));
}
export function toggleTask(store:Store,id:string,today=localDate()):Store{
 const task=store.tasks.find(t=>t.id===id);if(!task)return store;
 let tasks=store.tasks.map(t=>t.id===id?{...t,done:!t.done,completedAt:!t.done?today:undefined}:t);
 if(!task.done&&task.repeat!=='none'&&!task.nextId){const next={...task,id:uid(),date:nextRepeat(task.date||today,task.repeat),done:false,completedAt:undefined,subtasks:task.subtasks.map(s=>({...s,done:false})),nextId:undefined,created:Date.now()};tasks=tasks.map(t=>t.id===id?{...t,nextId:next.id}:t);tasks.push(next);}
 return {...store,tasks};
}
export function matches(t:Task,filter:string,today=localDate()){
 if(filter==='trash')return t.deleted;if(t.deleted)return false;if(filter==='completed')return t.done;if(t.done)return false;
 if(filter==='today')return !!t.date&&t.date<=today;if(filter==='next7')return !!t.date&&t.date>=today&&t.date<=shiftDate(today,6);
 if(filter==='inbox')return t.listId==='inbox';if(filter.startsWith('list:'))return t.listId===filter.slice(5);
 if(filter.startsWith('tag:'))return t.tags.includes(filter.slice(4));return true;
}
export function calendarTasks(tasks:Task[],date:string){return tasks.filter(t=>!t.deleted&&!t.done&&t.date===date);}
export function overlaps(a:Task,b:Task){return a.time!==undefined&&b.time!==undefined&&a.date===b.date&&a.time<b.time+b.minutes&&b.time<a.time+a.minutes;}
export function taskTime(t:Task){return t.time===undefined?'全天':`${hm(t.time)}–${hm(t.time+t.minutes)}`;}
export function migrateLegacy(input:unknown):Store{
 const store=baseStore();if(!Array.isArray(input))throw new Error('旧数据格式错误');
 store.tasks=input.map((v,i)=>{if(!v||typeof v.title!=='string')throw new Error('旧任务缺少名称');const time=Number.isFinite(v.manualStart)?v.manualStart:Number.isFinite(v.start)?v.start:undefined;return {...newTask(v.title,v.date||''),id:String(v.id||uid()),minutes:Number.isInteger(v.minutes)&&v.minutes>=5&&v.minutes<=1440?v.minutes:30,priority:['urgent','high','normal','low'].includes(v.priority)?v.priority:'low',time:time!==undefined&&time>=0&&time+(v.minutes||30)<=1440?time:undefined,done:v.status==='done',created:Date.now()+i};});return store;
}
export function validateStore(value:unknown):Store{
 const v=value as Store; if(!v||v.version!==2||!Array.isArray(v.tasks)||!Array.isArray(v.lists)||!Array.isArray(v.habits))throw new Error('不是有效的本地备份文件');
 const date=(s:unknown)=>typeof s==='string'&&(s===''||/^\d{4}-\d{2}-\d{2}$/.test(s)&&localDate(new Date(s+'T12:00:00'))===s);
 if(v.lists.some(l=>!l||typeof l.id!=='string'||typeof l.name!=='string'||!/^#[0-9a-f]{6}$/i.test(l.color)))throw new Error('清单数据无效');
 if(new Set(v.tasks.map(t=>t.id)).size!==v.tasks.length)throw new Error('任务编号重复');
 if(v.tasks.some(t=>!t||typeof t.id!=='string'||typeof t.title!=='string'||!t.title.trim()||!date(t.date)||!Number.isInteger(t.minutes)||t.minutes<5||t.minutes>1440||!(t.priority in weights)||typeof t.listId!=='string'||typeof t.notes!=='string'||!Array.isArray(t.tags)||t.tags.some(x=>typeof x!=='string')||!Array.isArray(t.subtasks)||t.subtasks.some(s=>typeof s.id!=='string'||typeof s.title!=='string'||typeof s.done!=='boolean')||typeof t.done!=='boolean'||typeof t.deleted!=='boolean'||!['none','daily','weekly','monthly'].includes(t.repeat)||!Number.isFinite(t.created)||(t.time!==undefined&&(!t.date||!Number.isInteger(t.time)||t.time<0||t.time+t.minutes>1440))))throw new Error('任务字段或时间范围无效');
 if(v.habits.some(h=>typeof h.id!=='string'||typeof h.name!=='string'||!Array.isArray(h.days)||h.days.some(d=>!date(d))))throw new Error('习惯记录无效');
 if(v.focus&&(!Array.isArray(v.focus)||v.focus.some(f=>!date(f.date)||!Number.isFinite(f.minutes)||f.minutes<0)))throw new Error('专注记录无效');
 const ideas:Idea[] = Array.isArray(v.ideas) ? v.ideas.filter(i=>i&&typeof i.id==='string'&&typeof i.content==='string').map(i=>({id:i.id,content:i.content,tags:Array.isArray(i.tags)?i.tags:[],images:Array.isArray(i.images)?i.images:[],created:Number.isFinite(i.created)?i.created:Date.now()})) : [];
 return {...v, ideas, focus: Array.isArray(v.focus)?v.focus:[], theme:v.theme==='dark'?'dark':'light'};
}
export function mergeStore(current:Store,incoming:Store):Store{
 const listIds=new Map<string,string>();const lists=[...current.lists];
 for(const list of incoming.lists){const match=lists.find(x=>x.name===list.name);if(match)listIds.set(list.id,match.id);else{const id=uid();listIds.set(list.id,id);lists.push({...list,id})}}
 const taskIds=new Map(incoming.tasks.map(t=>[t.id,uid()]));
 const tasks=incoming.tasks.map(t=>({...t,id:taskIds.get(t.id)!,listId:t.listId==='inbox'?'inbox':listIds.get(t.listId)||'inbox',subtasks:t.subtasks.map(s=>({...s,id:uid()})),nextId:t.nextId?(taskIds.get(t.nextId)||'imported-occurrence'):undefined}));
 const incomingIdeas = Array.isArray(incoming.ideas) ? incoming.ideas.map(i=>({...i,id:uid()})) : [];
 return {...current,lists,tasks:[...current.tasks,...tasks],habits:[...current.habits,...incoming.habits.map(h=>({...h,id:uid()}))],ideas:[...(current.ideas||[]),...incomingIdeas],focus:[...current.focus,...(incoming.focus||[])]};
}
