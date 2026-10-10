export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type Status = 'todo' | 'doing' | 'done' | 'paused';
export type Task = { id:string; title:string; minutes:number; priority:Priority; due?:string; earliest?:string; status:Status; date:string; color:string; start?:number; end?:number; manualStart?:number };
export type Fixed = {id:string;title:string;start:string;end:string};
export type Scheduled = Task & {start:number;end:number};
export const toMinutes = (s:string) => { const [h,m]=s.split(':').map(Number); return h*60+m; };
export const hm = (m:number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export const localDate = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function shiftDate(s:string,days=0,months=0) {const [y,m,d]=s.split('-').map(Number);return localDate(new Date(y,m-1+months,d+days));}
export const overlaps = (a:{start:number;end:number},b:{start:number;end:number}) => a.start<b.end && b.start<a.end;
/** Pure first-fit scheduler. Manual placements reserve time; rejected tasks remain explicit. */
export function schedule(tasks:Task[], date:string, fixed:Fixed[]) {
 const placed:Scheduled[]=[];const pending:{task:Task;reason:string}[]=[];
 const occupied=fixed.map(f=>({start:toMinutes(f.start),end:toMinutes(f.end)}));
 const rank={urgent:0,high:1,normal:2,low:3};
 const work=tasks.filter(t=>t.date===date&&t.status!=='done').sort((a,b)=>Number(b.manualStart!==undefined)-Number(a.manualStart!==undefined)||rank[a.priority]-rank[b.priority]||(toMinutes(a.due||'24:00')-toMinutes(b.due||'24:00')));
 for(const t of work){
  if(t.status==='paused'){pending.push({task:t,reason:'已暂停'});continue;}
  if(!Number.isInteger(t.minutes)||t.minutes<5||t.minutes>1440){pending.push({task:t,reason:'预计时长需为 5–1440 分钟'});continue;}
  const earliest=t.earliest?toMinutes(t.earliest):0;
  let start=t.manualStart??Math.max(540,earliest);
  const limit=Math.min(1440,t.due?toMinutes(t.due):1440);
  if(!Number.isFinite(start)||!Number.isFinite(earliest)||!Number.isFinite(limit)){pending.push({task:t,reason:'时间格式无效'});continue;}
  if(t.manualStart===undefined){for(const b of [...occupied].sort((a,b)=>a.start-b.start)){if(overlaps({start,end:start+t.minutes},b))start=b.end;}}
  const block={start,end:start+t.minutes};
  if(start<earliest||start<0||block.end>limit||occupied.some(b=>overlaps(block,b))){pending.push({task:t,reason:t.manualStart!==undefined?'手动时间与固定事务、任务或时间限制冲突':'当天剩余空档不足，或无法在截止时间前完成'});continue;}
  placed.push({...t,...block});occupied.push(block);
 }
 return {placed:placed.sort((a,b)=>a.start-b.start),pending};
}
