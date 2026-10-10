import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {localDate,shiftDate} from '../scheduler';
export function MiniCalendar({date,onChange}:{date:string;onChange:(date:string)=>void}){
 const [month,setMonth]=useState(date.slice(0,7));const [y,m]=month.split('-').map(Number),offset=(new Date(y,m-1,1).getDay()+6)%7;
 return <div className="mini-calendar"><header><button aria-label="上个月" className="icon" onClick={()=>setMonth(shiftDate(month+'-01',0,-1).slice(0,7))}><ChevronLeft size={16}/></button><input type="month" aria-label="选择月份" value={month} onInput={e=>e.currentTarget.value&&setMonth(e.currentTarget.value)} onChange={e=>e.target.value&&setMonth(e.target.value)}/><button aria-label="下个月" className="icon" onClick={()=>setMonth(shiftDate(month+'-01',0,1).slice(0,7))}><ChevronRight size={16}/></button></header><div className="mini-grid">{'一二三四五六日'.split('').map(d=><small key={d}>{d}</small>)}{Array.from({length:offset},(_,i)=><i key={i}/>)}{Array.from({length:new Date(y,m,0).getDate()},(_,i)=>{const d=`${month}-${String(i+1).padStart(2,'0')}`;return <button key={d} aria-label={'选择 '+d} className={`${date===d?'selected':''} ${d===localDate()?'is-today':''}`} onClick={()=>onChange(d)}>{i+1}</button>})}</div><button className="text-button" onClick={()=>onChange(localDate())}>今天</button></div>;
}
