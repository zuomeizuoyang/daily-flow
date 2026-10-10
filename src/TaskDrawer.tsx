import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {hm,toMinutes,type Task,type Priority} from './scheduler';
import {labels} from './defaults';

type Props={task?:Task;date:string;start?:number;onClose:()=>void;onSave:(task:Task)=>void};
export function TaskDrawer({task,date,start,onClose,onSave}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const [title,setTitle]=useState(task?.title||'');
 const [duration,setDuration]=useState(String(task?.minutes||30));
 const [day,setDay]=useState(task?.date||date);
 const [earliest,setEarliest]=useState(task?.earliest||'');
 const [due,setDue]=useState(task?.due||'');
 const [locked,setLocked]=useState(start!==undefined||task?.manualStart!==undefined);
 const [time,setTime]=useState(start!==undefined?hm(start):task?.manualStart!==undefined?hm(task.manualStart):'');
 const [priority,setPriority]=useState<Priority>(task?.priority||'normal');
 const [error,setError]=useState('');
 useEffect(()=>{const el=dialog.current!;el.showModal();return()=>el.close()},[]);
 const save=(e:React.FormEvent)=>{
  e.preventDefault();const minutes=Number(duration);
  if(!title.trim()||!day||!Number.isInteger(minutes)||minutes<5||minutes>1440){setError('请填写名称、日期，以及 5–1440 分钟的整数时长。');return;}
  if(locked&&(!time||toMinutes(time)+minutes>1440)){setError('指定时间和时长必须在同一天内。');return;}
  if(due&&toMinutes(due)<(locked?toMinutes(time):earliest?toMinutes(earliest):0)+minutes){setError('截止时间前没有足够的时间完成任务，请调整时长或时间。');return;}
  if(locked&&earliest&&toMinutes(time)<toMinutes(earliest)){setError('指定开始时间不能早于最早开始时间。');return;}
  onSave({...task,id:task?.id||crypto.randomUUID(),title:title.trim(),minutes,date:day,priority,status:task?.status||'todo',color:task?.color||'#8276af',earliest:earliest||undefined,due:due||undefined,manualStart:locked?toMinutes(time):undefined,start:undefined,end:undefined});
 };
 return <dialog ref={dialog} className="task-drawer" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left)onClose()}}}>
  <form onSubmit={save} className="drawer-form">
   <header className="drawer-heading"><div><small>DAILY PLANNING</small><h2>{task?'编辑任务':'添加任务'}</h2></div><button type="button" className="icon-button" aria-label="关闭任务面板" onClick={onClose}><X size={20}/></button></header>
   <p className="muted">为重要的事留出时间，也为自己留一点余地。</p>
   <label className="editor-field">任务名称<input autoFocus required maxLength={200} placeholder="你想完成什么？" value={title} onChange={e=>setTitle(e.target.value)}/></label>
   <div className="editor-grid">
    <label className="editor-field">安排日期<input type="date" required value={day} onChange={e=>setDay(e.target.value)}/></label>
    <label className="editor-field">预计时长（分钟）<input type="number" min="5" max="1440" step="1" required value={duration} onChange={e=>setDuration(e.target.value)}/></label>
    <label className="editor-field">最早开始<input type="time" value={earliest} onChange={e=>setEarliest(e.target.value)}/></label>
    <label className="editor-field">截止时间<input type="time" value={due} onChange={e=>setDue(e.target.value)}/></label>
   </div>
   <label className="editor-field">优先级<select value={priority} onChange={e=>setPriority(e.target.value as Priority)}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
   <div className="lock-option"><label><input type="checkbox" checked={locked} onChange={e=>setLocked(e.target.checked)}/> 固定开始时间</label><small>锁定后，自动排程会保留这个位置。</small></div>
   {locked&&<label className="editor-field">指定开始时间<input required type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>}
   {error&&<p className="notice" role="alert">{error}</p>}
   <footer className="drawer-footer"><button type="button" className="secondary" onClick={onClose}>取消</button><button type="submit" className="primary">{task?'保存更改':'加入排程'}</button></footer>
  </form>
 </dialog>;
}
