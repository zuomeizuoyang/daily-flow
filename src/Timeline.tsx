import {useEffect,useRef,useState} from 'react';
import {hm, type Fixed,type Scheduled} from './scheduler';
export function Timeline({tasks,fixed,selected,onMove,onComplete,onSelect,onCreate,onResize,onDropTask}:{tasks:Scheduled[];fixed:Fixed[];selected:string;onMove:(id:string,start:number)=>void;onComplete:(id:string)=>void;onSelect:(id:string)=>void;onCreate?:(minute:number)=>void;onResize?:(id:string,start:number,minutes:number)=>void;onDropTask?:(id:string,minute:number)=>void}){
 const root=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:string;y:number;start:number}|null>(null);
 const [preview,setPreview]=useState<{id:string;start:number}|null>(null);
 const minute=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const begin=Math.min(480,...tasks.map(t=>Math.floor(t.start/60)*60));
 const end=Math.min(1440,Math.max(1260,...tasks.map(t=>Math.ceil(t.end/60)*60)));
 // Expand only occupied short intervals, preserving exact boundaries without card overlap.
 const boundaries=[...new Set([begin,end,...Array.from({length:(end-begin)/60+1},(_,i)=>begin+i*60),...tasks.flatMap(t=>[t.start,t.end]),...fixed.flatMap(f=>[minute(f.start),minute(f.end)])])].filter(x=>x>=begin&&x<=end).sort((a,b)=>a-b);
 const y=[0];for(let i=1;i<boundaries.length;i++){const a=boundaries[i-1],b=boundaries[i];const short=tasks.some(t=>t.minutes<40&&t.start<=a&&t.end>=b);y.push(y[i-1]+Math.max((b-a)*1.5,short?(b-a)*64/Math.min(...tasks.filter(t=>t.start<=a&&t.end>=b).map(t=>t.minutes)):0));}
 const position=(m:number)=>{let i=boundaries.findIndex(b=>b>=m);if(i<=0)return 0;return y[i-1]+(m-boundaries[i-1])/(boundaries[i]-boundaries[i-1])*(y[i]-y[i-1]);};
 const timeAt=(px:number)=>{let i=y.findIndex(v=>v>=px);if(i<0)return end;if(i===0)return begin;return boundaries[i-1]+(px-y[i-1])/(y[i]-y[i-1])*(boundaries[i]-boundaries[i-1]);};
 useEffect(()=>{root.current?.querySelector(`[data-selected="true"]`)?.scrollIntoView({block:'nearest',behavior:'smooth'});},[selected]);
 return <div className="timeline-scroll" ref={root} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/task");if(id){const r=(e.currentTarget as HTMLElement).getBoundingClientRect();onDropTask?.(id,Math.round((begin+(e.clientY-r.top)/1.5)/15)*15)}}} onDoubleClick={e=>{if(!onCreate)return;const r=(e.currentTarget as HTMLElement).getBoundingClientRect();onCreate(Math.round((begin+(e.clientY-r.top)/1.5)/15)*15)}}><div className="timeline" style={{height:y[y.length-1]}}>
 {boundaries.filter(m=>m%60===0).map(m=><div className="hour" key={m} style={{top:position(m)}}><span>{hm(m)}</span></div>)}
 {fixed.map(f=><div key={f.id} className="fixed-block" style={{top:position(minute(f.start)),height:position(minute(f.end))-position(minute(f.start))}}>{f.title} · {f.start}–{f.end}</div>)}
 {tasks.map(t=><article key={t.id} data-selected={selected===t.id} aria-label={`${t.title} ${hm(t.start)}-${hm(t.end)}`} className="task-block" style={{top:position(t.start),height:position(t.end)-position(t.start),background:`${t.color}18`,borderColor:t.color,outline:selected===t.id?'2px solid #a5b4fc':undefined}}>
 <button className="drag-handle" aria-label={`拖动 ${t.title}`} style={{touchAction:'none'}} onPointerDown={e=>{if(e.button!==0)return;drag.current={id:t.id,y:e.clientY,start:t.start};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(drag.current?.id!==t.id)return;const start=Math.max(begin,Math.min(1440-t.minutes,Math.round(timeAt(position(drag.current.start)+e.clientY-drag.current.y)/15)*15));setPreview({id:t.id,start});}} onPointerUp={e=>{if(drag.current&&preview?.id===t.id&&Math.abs(e.clientY-drag.current.y)>3)onMove(t.id,preview.start);drag.current=null;setPreview(null);}} onPointerCancel={()=>{drag.current=null;setPreview(null);}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();onMove(t.id,t.start+(e.key==='ArrowDown'?15:-15));}}}>⠿</button>
 <button className="task-content" onClick={()=>onSelect(t.id)}><strong>{t.title}</strong><small>{hm(t.start)}–{hm(t.end)} · {t.minutes}分钟{t.manualStart!==undefined?' · 已锁定':''}</small></button>
 <button aria-label={`完成 ${t.title}`} onClick={()=>onComplete(t.id)}>完成</button>
 </article>)}
 </div>{preview&&<div className="drag-preview">移动到 {hm(preview.start)}，松开确认</div>}</div>;
}
