import {useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {localDate,shiftDate,type Task} from './scheduler';
export function DateNavigation({date,tasks,onChange}:{date:string;tasks:Task[];onChange:(date:string)=>void}){
 const [open,setOpen]=useState(false);const [month,setMonth]=useState(date.slice(0,7));
 const [year,m]=month.split('-').map(Number);const offset=(new Date(year,m-1,1).getDay()+6)%7;
 const count=new Date(year,m,0).getDate();const today=localDate();
 const choose=(d:string)=>{onChange(d);setOpen(false)};
 const days=Array.from({length:7},(_,i)=>shiftDate(date,i-((new Date(date+'T12:00:00').getDay()+6)%7)));
 return <div className="date-navigation">
  <div className="date-controls"><button className="icon-button" aria-label="前一天" onClick={()=>choose(shiftDate(date,-1))}><ChevronLeft size={18}/></button>
   <button className="date-trigger" aria-expanded={open} onClick={()=>{setMonth(date.slice(0,7));setOpen(!open)}}><CalendarDays size={17}/>{date===today?'今天 · ':''}{date}</button>
   <button className="icon-button" aria-label="后一天" onClick={()=>choose(shiftDate(date,1))}><ChevronRight size={18}/></button><button className="today-button" onClick={()=>choose(today)}>回到今天</button>
  </div>
  {open&&<><button className="calendar-dismiss" aria-label="关闭日历" onClick={()=>setOpen(false)}/><section className="month-popup" aria-label="选择日期">
   <div className="month-head"><button className="icon-button" aria-label="上个月" onClick={()=>setMonth(shiftDate(month+'-01',0,-1).slice(0,7))}><ChevronLeft size={18}/></button><input aria-label="选择月份" type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/><button className="icon-button" aria-label="下个月" onClick={()=>setMonth(shiftDate(month+'-01',0,1).slice(0,7))}><ChevronRight size={18}/></button></div>
   <div className="month-grid">{'一二三四五六日'.split('').map(x=><small key={x}>{x}</small>)}{Array.from({length:offset},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>{const d=`${month}-${String(i+1).padStart(2,'0')}`;return <button key={d} aria-label={d} aria-pressed={d===date} onClick={()=>choose(d)}>{i+1}</button>})}</div>
  </section></>}
  <div className="week-strip">{days.map((d,i)=><button key={d} aria-label={'查看 '+d} aria-pressed={d===date} onClick={()=>choose(d)}><small>{['周一','周二','周三','周四','周五','周六','周日'][i]}</small><b>{Number(d.slice(-2))}</b><span className={tasks.some(t=>t.date===d)?'has-tasks':''}/></button>)}</div>
 </div>;
}
