import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {CheckSquare,CalendarDays,Inbox,Sun,CalendarRange,Layers,Hash,Plus,Search,ChevronDown,ChevronRight,Timer,Grid2X2,Flame,Settings,PanelLeftClose,PanelLeft,ArrowDownWideNarrow,LayoutList,Columns3,Trash2,Download,Upload,Flag,X,RefreshCw,Cloud,CloudOff,Lock,Lightbulb} from 'lucide-react';
import {newTask,parseQuick,priorities,weights,matches,toggleTask,validateStore,mergeStore,syncMergeStores,uid,type Store,type Task} from './model';
import {loadStore,saveStore,download,getSnapshots,STORAGE_KEY} from './repository';
import {loadSupabaseConfig,saveSupabaseConfig,fetchRemoteStore,pushRemoteStore,subscribeRemoteStore,sessionClientId,deriveSyncKey,getSavedAuthPassword,saveAuthPassword,clearAuthPassword,type SupabaseConfig} from './supabase';
import {localDate,hm,shiftDate,schedule} from './scheduler';
import {TaskRow,Empty} from './components/TaskRow';
import {TaskDetail} from './components/TaskDetail';
import {CalendarView} from './components/CalendarView';
import {HabitsView} from './components/Tools';
import {IdeasView} from './components/IdeasView';
import {Modal} from './components/Modal';
import {LockScreen} from './components/LockScreen';
import './index.css';
const smart=[{id:'inbox',name:'收集箱',icon:Inbox},{id:'today',name:'今天',icon:Sun},{id:'next7',name:'最近7天',icon:CalendarRange},{id:'all',name:'全部',icon:Layers}];
const modules=[{id:'tasks',name:'任务',icon:CheckSquare},{id:'calendar',name:'日历',icon:CalendarDays},{id:'matrix',name:'四象限',icon:Grid2X2},{id:'ideas',name:'灵感',icon:Lightbulb},{id:'habits',name:'习惯',icon:Flame}];
export default function App(){
 const [savedPwd,setSavedPwd]=useState<string|null>(getSavedAuthPassword);
 const [isAuthenticated,setIsAuthenticated]=useState<boolean>(Boolean(savedPwd));
 const [initial]=useState(loadStore),[store,setStore]=useState(initial.store),[persistError,setPersistError]=useState(initial.error);
 const [today,setToday]=useState(localDate()),[module,setModule]=useState('tasks'),[filter,setFilter]=useState('today');
 const [selected,setSelected]=useState<string|null>(null),[query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
 const [text,setText]=useState(''),[sort,setSort]=useState('default'),[view,setView]=useState<'list'|'board'>('list');
 const [showDone,setShowDone]=useState(false),[navOpen,setNavOpen]=useState(false),[date,setDate]=useState(today);
 const [modal,setModal]=useState<'list'|'settings'|null>(null),[newList,setNewList]=useState(''),[toast,setToast]=useState('');
 const [pendingImport,setPendingImport]=useState<Store|null>(null),[draftDate,setDraftDate]=useState<string|null>(null);
 const [syncCfg,setSyncCfg]=useState<SupabaseConfig>(loadSupabaseConfig);
 const [editSync,setEditSync]=useState<SupabaseConfig>(syncCfg);
 const [syncStatus,setSyncStatus]=useState<'connected'|'connecting'|'disconnected'|'error'|'syncing'>(syncCfg.enabled&&syncCfg.url&&syncCfg.anonKey?'connecting':'disconnected');
 const [syncError,setSyncError]=useState('');
 const [showSql,setShowSql]=useState(false);
 const isRemoteApplying=useRef(false);
 const isInitialSyncDone=useRef(false);
 const latestStore=useRef(store); latestStore.current=store;
 const syncTimer=useRef<number|null>(null);
 const addInput=useRef<HTMLInputElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const change=useCallback((fn:(s:Store)=>Store)=>setStore(fn),[]);
 const notify=useCallback((msg:string)=>setToast(msg),[]);
 useEffect(()=>{
  if(savedPwd){
   deriveSyncKey(savedPwd).then(key=>{
    setSyncCfg(prev=>{const next={...prev,syncKey:key,enabled:true};saveSupabaseConfig(next);return next;});
    setEditSync(prev=>({...prev,syncKey:key,enabled:true}));
   });
  }
 },[savedPwd]);
 const handleUnlock=async(password:string,remember:boolean)=>{
  saveAuthPassword(password,remember);setSavedPwd(password);
  const key=await deriveSyncKey(password);
  setSyncCfg(prev=>{const next={...prev,syncKey:key,enabled:true};saveSupabaseConfig(next);return next;});
  setEditSync(prev=>({...prev,syncKey:key,enabled:true}));
  setIsAuthenticated(true);
  notify('解锁成功，正在同步数据...');
 };
 const handleLock=()=>{
  clearAuthPassword();setSavedPwd(null);setIsAuthenticated(false);setModal(null);
  notify('应用已锁定');
 };
 useEffect(()=>{if(initial.error)return;try{saveStore(store);setPersistError('')}catch{setPersistError('保存失败：浏览器空间不足或不允许存储。请立即导出备份。')}},[store,initial.error]);
 useEffect(()=>{document.documentElement.dataset.theme=store.theme},[store.theme]);
 useEffect(()=>{const id=setInterval(()=>setToday(localDate()),30000);return()=>clearInterval(id)},[]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(id)},[toast]);
 useEffect(()=>{
  if(!syncCfg.enabled||!syncCfg.url||!syncCfg.anonKey){
   setSyncStatus('disconnected');
   isInitialSyncDone.current=false;
   return;
  }
  let active=true;setSyncStatus('connecting');
  fetchRemoteStore(syncCfg).then(({store:remote,error})=>{
   if(!active)return;
   if(error){setSyncStatus('error');setSyncError(error);return;}
   if(remote){
    const merged=syncMergeStores(latestStore.current,remote);
    isRemoteApplying.current=true;
    setStore(merged);
    saveStore(merged);
    isInitialSyncDone.current=true;
    setSyncStatus('connected');
    notify('已同步云端最新数据');
    if(JSON.stringify(merged.tasks)!==JSON.stringify(remote.tasks)||JSON.stringify(merged.ideas)!==JSON.stringify(remote.ideas)){
     pushRemoteStore(syncCfg,merged,sessionClientId);
    }
   }else{
    pushRemoteStore(syncCfg,latestStore.current,sessionClientId).then(r=>{
     if(!active)return;
     if(r.success){isInitialSyncDone.current=true;setSyncStatus('connected');}
     else{setSyncStatus('error');setSyncError(r.error||'初始化失败');}
    });
   }
  });
  const unsub=subscribeRemoteStore(syncCfg,sessionClientId,(remote)=>{
   if(!active)return;
   setStore(current=>{
    const merged=syncMergeStores(current,remote);
    isRemoteApplying.current=true;
    saveStore(merged);
    return merged;
   });
   notify('已接收云端实时更新');
  },(st,err)=>{
   if(!active)return;setSyncStatus(st);if(err)setSyncError(err);
  });
  return()=>{active=false;unsub();};
 },[syncCfg]);
 useEffect(()=>{
  if(!syncCfg.enabled||!syncCfg.url||!syncCfg.anonKey)return;
  if(!isInitialSyncDone.current)return;
  if(isRemoteApplying.current){isRemoteApplying.current=false;return;}
  if(syncTimer.current)clearTimeout(syncTimer.current);
  setSyncStatus('syncing');
  syncTimer.current=window.setTimeout(async()=>{
   const res=await pushRemoteStore(syncCfg,store,sessionClientId);
   if(res.success){setSyncStatus('connected');setSyncError('');}
   else{setSyncStatus('error');setSyncError(res.error||'同步失败');}
  },400);
  return()=>{if(syncTimer.current)clearTimeout(syncTimer.current);};
 },[store,syncCfg]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const el=e.target as HTMLElement;if(el.closest('input,textarea,select,dialog'))return;if(e.key==='q'){e.preventDefault();setModule('tasks');addInput.current?.focus()}if(e.key==='/'){e.preventDefault();setSearchOpen(true)}if(e.key==='Escape'){setSelected(null);setNavOpen(false)}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key)},[]);
 const task=store.tasks.find(t=>t.id===selected);
 const filtered=useMemo(()=>store.tasks.filter(t=>matches(t,filter,today)&&(!query||[t.title,t.notes,...t.tags].join(' ').toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>sort==='priority'?weights[a.priority]-weights[b.priority]:sort==='date'?(a.date||'9999').localeCompare(b.date||'9999')||(a.time??1440)-(b.time??1440):a.created-b.created),[store.tasks,filter,query,sort,today]);
 const completed=store.tasks.filter(t=>t.done&&!t.deleted&&(filter==='all'||filter==='today'&&t.date===today||filter==='inbox'&&t.listId==='inbox'||filter==='next7'&&t.date>=today&&t.date<=shiftDate(today,6)||filter.startsWith('list:')&&t.listId===filter.slice(5)||filter.startsWith('tag:')&&t.tags.includes(filter.slice(4))));
 const tags=[...new Set(store.tasks.filter(t=>!t.deleted).flatMap(t=>t.tags))];
 const title=smart.find(s=>s.id===filter)?.name||store.lists.find(l=>'list:'+l.id===filter)?.name||(filter.startsWith('tag:')?'# '+filter.slice(4):filter==='completed'?'已完成':'垃圾桶');
 const selectFilter=(id:string)=>{setFilter(id);setModule('tasks');setQuery('');setSelected(null);setNavOpen(false);setDraftDate(null)};
 const patch=(id:string,p:Partial<Task>)=>change(s=>({...s,tasks:s.tasks.map(t=>t.id===id?{...t,...p}:t)}));
 const toggle=(id:string)=>change(s=>toggleTask(s,id,today));
 const create=(day:string,time?:number)=>{const t={...newTask('新任务',day),time};change(s=>({...s,tasks:[...s.tasks,t]}));setSelected(t.id)};
 const quickAdd=(e:React.FormEvent)=>{e.preventDefault();if(!text.trim())return;const parsed=parseQuick(text,today);if(!parsed.title){notify('请填写任务名称');return;}const day=parsed.date||draftDate||(filter==='today'||filter==='next7'?today:'');const list=filter.startsWith('list:')?filter.slice(5):'inbox';if(day&&localDate(new Date(day+'T12:00:00'))!==day){notify('日期无效，请重新选择。');return;}if(parsed.time!==undefined&&parsed.time>1435){notify('当天至少需要留出 5 分钟。');return;}const t={...newTask(parsed.title,day,list),minutes:parsed.time===undefined?30:Math.min(30,1440-parsed.time),time:parsed.time,tags:parsed.tags};change(s=>({...s,tasks:[...s.tasks,t]}));setText('');setSelected(t.id);if(!matches(t,filter,today)){notify('任务已添加，已切换到全部清单。');setFilter('all')}};
 const move=(id:string,day:string,time?:number,minutes?:number)=>{const t=store.tasks.find(t=>t.id===id);if(!t||t.deleted||t.done)return;const n=minutes??t.minutes;if(time!==undefined&&(time<0||time+n>1440)){notify('任务时间不能超出当天。');return;}patch(id,{date:day,time,minutes:n});notify(`已安排到 ${day}${time===undefined?' · 全天':' '+hm(time)}`)};
 const autoPlan=()=>{const tasks=store.tasks.filter(t=>!t.deleted&&!t.done&&t.date===date);const result=schedule(tasks.map(t=>({id:t.id,title:t.title,date:t.date,minutes:t.minutes,priority:t.priority,status:'todo',color:'#5278df',manualStart:t.time})),date,[]);change(s=>({...s,tasks:s.tasks.map(t=>{const p=result.placed.find(p=>p.id===t.id);return p?{...t,time:p.start}:t})}));notify(`已安排 ${result.placed.length} 项${result.pending.length?'，'+result.pending.length+' 项无法安排，保留原任务':''}。`)};
 const count=(id:string)=>store.tasks.filter(t=>matches(t,id,today)).length;
 const importData=async(file?:File)=>{if(!file)return;try{if(file.size>10_000_000)throw new Error('备份文件超过 10MB');setPendingImport(validateStore(JSON.parse(await file.text())))}catch(e){notify((e as Error).message)}finally{if(fileInput.current)fileInput.current.value=''}};
 const mergeImport=()=>{if(!pendingImport)return;change(s=>mergeStore(s,pendingImport));setPendingImport(null);notify('备份已合并，现有数据没有被覆盖。')};
  if(!isAuthenticated){
  return <LockScreen onUnlock={handleUnlock}/>;
 }
 return <div className={'app-frame '+(navOpen?'nav-open':'')+(task?' detail-open':'')}>
 <nav className="module-rail" aria-label="功能导航"><div className="profile">D</div>{modules.map(m=><button key={m.id} aria-label={m.name} title={m.name} className={module===m.id?'active':''} onClick={()=>{setModule(m.id);setSelected(null);setNavOpen(false)}}><m.icon size={23} strokeWidth={1.7}/><span>{m.name}</span></button>)}<div className="rail-spacer"/><button aria-label="锁定应用" title="锁定应用" onClick={handleLock}><Lock size={20}/><span>锁屏</span></button><button aria-label="设置与备份" title="设置与备份" onClick={()=>setModal('settings')}><Settings size={22}/><span>设置</span></button></nav>
 {navOpen&&<button className="nav-backdrop" aria-label="关闭导航" onClick={()=>setNavOpen(false)}/>}
 <aside className="list-sidebar"><header className="sidebar-header"><strong>Daily Flow</strong><small>本地版</small><button className="icon" aria-label="关闭侧边栏" onClick={()=>setNavOpen(false)}><PanelLeftClose size={17}/></button></header><button className="sidebar-search" onClick={()=>{setModule('tasks');setSearchOpen(true)}}><Search size={16}/><span>搜索任务</span><kbd>/</kbd></button><div className="sidebar-items">{smart.map(s=><button key={s.id} className={filter===s.id&&module==='tasks'?'selected':''} onClick={()=>selectFilter(s.id)}><s.icon size={18}/><span>{s.name}</span><small>{count(s.id)||''}</small></button>)}<hr/><div className="sidebar-section"><span><ChevronDown size={13}/>清单</span><button className="icon" aria-label="添加清单" onClick={()=>setModal('list')}><Plus size={16}/></button></div>{store.lists.map(l=><button key={l.id} className={filter==='list:'+l.id&&module==='tasks'?'selected':''} onClick={()=>selectFilter('list:'+l.id)}><Hash size={18} style={{color:l.color}}/><span>{l.name}</span><small>{count('list:'+l.id)||''}</small></button>)}<button className="add-list" onClick={()=>setModal('list')}><Plus size={17}/><span>添加清单</span></button><hr/><div className="sidebar-section"><span><ChevronDown size={13}/>标签</span></div>{tags.length?tags.map(t=><button key={t} className={filter==='tag:'+t&&module==='tasks'?'selected':''} onClick={()=>selectFilter('tag:'+t)}><Hash size={15}/><span>{t}</span></button>):<p className="sidebar-hint">在任务详情中添加标签</p>}<hr/><button className={filter==='completed'&&module==='tasks'?'selected':''} onClick={()=>selectFilter('completed')}><CheckSquare size={17}/><span>已完成</span><small>{count('completed')||''}</small></button><button className={filter==='trash'&&module==='tasks'?'selected':''} onClick={()=>selectFilter('trash')}><Trash2 size={17}/><span>垃圾桶</span><small>{count('trash')||''}</small></button></div><div className="sidebar-bottom" style={{cursor:'pointer'}} onClick={()=>{setEditSync(syncCfg);setModal('settings')}} title="点击配置云端实时同步"><span className={'storage-dot '+(syncCfg.enabled?syncStatus:'offline')}/> {syncCfg.enabled?(syncStatus==='connected'?'云端实时同步中':syncStatus==='syncing'?'正在同步到云端...':syncStatus==='connecting'?'正在连接云端...':syncStatus==='error'?'云同步异常(点击查看)':'云同步已断开'):persistError?'保存需要处理':'单机模式(点击配置云同步)'}</div></aside>
 <main className="workspace"><header className="workspace-header"><div className="workspace-heading"><button className="icon menu-toggle" aria-label="打开清单导航" onClick={()=>setNavOpen(!navOpen)}><PanelLeft size={20}/></button><h1 style={{cursor:'pointer'}} title="点击切换清单" onClick={()=>setNavOpen(!navOpen)}>{module==='tasks'?title:modules.find(m=>m.id===module)?.name}</h1>{module==='tasks'&&<small>{filtered.length}</small>}</div><div className="toolbar">{module==='tasks'&&<><button className="icon" aria-label="搜索" onClick={()=>setSearchOpen(!searchOpen)}><Search size={19}/></button><label className="sort-label"><ArrowDownWideNarrow size={18}/><select aria-label="任务排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="default">创建顺序</option><option value="priority">优先级</option><option value="date">日期</option></select></label><button className="icon" aria-label={view==='list'?'切换看板':'切换列表'} onClick={()=>setView(view==='list'?'board':'list')}>{view==='list'?<Columns3 size={19}/>:<LayoutList size={19}/>}</button></>}{module==='calendar'&&<button className="soft-button" onClick={autoPlan}><RefreshCw size={14}/>安排全天任务</button>}<button className="icon" aria-label="更多设置" onClick={()=>setModal('settings')}><Settings size={18}/></button></div></header>
 {persistError&&<div className="error-banner" role="alert">{persistError}</div>}
 {module==='tasks'&&<><div className="mobile-filter-strip">{smart.map(s=><button key={s.id} type="button" className={filter===s.id?'active':''} onClick={()=>selectFilter(s.id)}><s.icon size={14}/><span>{s.name}</span>{count(s.id)>0&&<small>{count(s.id)}</small>}</button>)}{store.lists.map(l=><button key={l.id} type="button" className={filter==='list:'+l.id?'active':''} onClick={()=>selectFilter('list:'+l.id)}><Hash size={14} style={{color:l.color}}/><span>{l.name}</span>{count('list:'+l.id)>0&&<small>{count('list:'+l.id)}</small>}</button>)}</div>{searchOpen&&<div className="search-bar"><Search size={18}/><input autoFocus aria-label="搜索任务" placeholder="搜索名称、描述、标签" value={query} onChange={e=>setQuery(e.target.value)}/><button className="icon" aria-label="关闭搜索" onClick={()=>{setSearchOpen(false);setQuery('')}}><X size={17}/></button></div>}{!['trash','completed'].includes(filter)&&<form className="quick-add" onSubmit={quickAdd}><Plus size={18}/><input ref={addInput} aria-label="快速添加任务" placeholder='添加任务，回车保存，例如「明天 09:00 阅读 #学习」' value={text} onChange={e=>setText(e.target.value)}/><input aria-label="快速添加日期" type="date" value={draftDate??(filter==='today'||filter==='next7'?today:'')} onInput={e=>setDraftDate(e.currentTarget.value)} onChange={e=>setDraftDate(e.target.value)}/><button aria-label="添加任务" type="submit"><Plus size={19}/></button></form>}
 <div className="task-content-area">{view==='list'?<><div className="group-heading"><ChevronDown size={14}/><b>{filter==='trash'?'已删除':filter==='completed'?'已完成':query?'搜索结果':'待完成'}</b><span>{filtered.length}</span></div>{(filter==='today'?[{label:'已过期',items:filtered.filter(t=>t.date<today)},{label:'今天',items:filtered.filter(t=>t.date===today)}]:[{label:'',items:filtered}]).map(group=><div key={group.label}>{group.label&&group.items.length>0&&<div className={'date-group '+(group.label==='已过期'?'overdue':'')}>{group.label} · {group.items.length}</div>}{group.items.map(t=><TaskRow key={t.id} task={t} lists={store.lists} selected={selected===t.id} onSelect={()=>setSelected(t.id)} onToggle={()=>filter==='trash'?patch(t.id,{deleted:false}):toggle(t.id)}/>)}</div>)}{!filtered.length&&<Empty text={query?'没有找到相关任务，换个关键词试试。':filter==='trash'?'删除的任务会保留在这里，可以随时恢复。':'添加一个任务，开始安排你的工作和生活。'}/>}</>:<div className="kanban">{(Object.keys(priorities) as (keyof typeof priorities)[]).map(p=><section key={p} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/task');if(id)patch(id,{priority:p})}}><h3><Flag size={14} className={'priority-'+p}/>{priorities[p]}<small>{filtered.filter(t=>t.priority===p).length}</small></h3>{filtered.filter(t=>t.priority===p).map(t=><TaskRow key={t.id} task={t} lists={store.lists} selected={selected===t.id} onSelect={()=>setSelected(t.id)} onToggle={()=>toggle(t.id)}/>)}</section>)}</div>}
 {!['completed','trash'].includes(filter)&&completed.length>0&&<><button className="completed-heading" onClick={()=>setShowDone(!showDone)}>{showDone?<ChevronDown size={14}/>:<ChevronRight size={14}/>}已完成 {completed.length}</button>{showDone&&completed.map(t=><TaskRow key={t.id} task={t} lists={store.lists} selected={selected===t.id} onSelect={()=>setSelected(t.id)} onToggle={()=>toggle(t.id)}/>)}</>}</div><footer className="list-footer"><span>{filtered.reduce((n,t)=>n+t.minutes,0)} 分钟预计时长</span><span>Q 快速添加 · / 搜索</span></footer></>}
 {module==='calendar'&&<CalendarView tasks={store.tasks} date={date} onDate={setDate} onCreate={create} onMove={move} onSelect={setSelected}/>}
 {module==='matrix'&&<div className="quadrants">{[{key:'urgent',title:'重要且紧急',cls:'red'},{key:'high',title:'重要不紧急',cls:'yellow'},{key:'normal',title:'不重要但紧急',cls:'blue'},{key:'low',title:'不重要不紧急',cls:'gray'}].map(g=><section key={g.key} className={g.cls} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/task');if(id)patch(id,{priority:g.key as Task['priority']})}}><h3>{g.title}</h3>{store.tasks.filter(t=>!t.deleted&&!t.done&&t.priority===g.key).map(t=><TaskRow key={t.id} task={t} lists={store.lists} selected={t.id===selected} onSelect={()=>setSelected(t.id)} onToggle={()=>toggle(t.id)}/>)}</section>)}</div>}
 {module==='ideas'&&<IdeasView store={store} change={change} onNotify={notify}/>}{module==='habits'&&<HabitsView store={store} change={change}/>}
 </main>
 {task&&['tasks','calendar','matrix'].includes(module)?<TaskDetail key={task.id} task={task} lists={store.lists} onChange={p=>patch(task.id,p)} onToggle={()=>toggle(task.id)} onClose={()=>setSelected(null)} onNotify={notify} onTrash={()=>{patch(task.id,{deleted:!task.deleted});notify(task.deleted?'任务已恢复':'任务已移至垃圾桶，可恢复');setSelected(null)}}/>:module==='tasks'&&<aside className="detail-placeholder"><CheckSquare size={62} strokeWidth={1}/><p>选择一个任务，查看详情</p><small>安排好每一件小事</small></aside>}
 {toast&&<div className="toast" role="status">{toast}<button aria-label="关闭提示" onClick={()=>setToast('')}><X size={14}/></button></div>}
 <nav className="mobile-nav">{modules.map(m=><button key={m.id} className={module===m.id?'active':''} onClick={()=>{setModule(m.id);setSelected(null)}}><m.icon size={21}/><span>{m.name}</span></button>)}</nav>
 {modal==='list'&&<Modal title="添加清单" onClose={()=>setModal(null)}><form onSubmit={e=>{e.preventDefault();if(!newList.trim())return;const list={id:uid(),name:newList.trim(),color:'#5278df'};change(s=>({...s,lists:[...s.lists,list]}));setNewList('');setModal(null);selectFilter('list:'+list.id)}}><label className="form-field">清单名称<input autoFocus required maxLength={40} value={newList} onChange={e=>setNewList(e.target.value)} placeholder="例如：工作项目"/></label><footer><button className="soft-button" type="button" onClick={()=>setModal(null)}>取消</button><button className="primary" type="submit">创建清单</button></footer></form></Modal>}
  {modal==='settings'&&<Modal title="设置与数据" onClose={()=>{setModal(null);setPendingImport(null)}}><div className="settings-content"><label className="setting-row">外观<select aria-label="外观主题" value={store.theme} onChange={e=>change(s=>({...s,theme:e.target.value as Store['theme']}))}><option value="light">浅色</option><option value="dark">深色</option></select></label>
  <h3>☁️ 云端实时同步 (Supabase)</h3>
  <div className="cloud-sync-box">
   <div className="cloud-sync-status">
    <span className={'storage-dot '+(editSync.enabled?syncStatus:'offline')}/>
    <span>{editSync.enabled?(syncStatus==='connected'?'🟢 实时双端同步中（手机/电脑秒级联动）':syncStatus==='syncing'?'🟡 正在同步数据到云端...':syncStatus==='connecting'?'🟡 正在连接 Supabase...':syncStatus==='error'?`🔴 连接失败: ${syncError}`:'⚪ 已断开连接'):'⚪ 未启用云同步（仅本地单机）'}</span>
   </div>
   <label style={{flexDirection:'row',alignItems:'center',gap:8,cursor:'pointer',fontSize:12,fontWeight:500,color:'var(--text)',marginBottom:12}}>
    <input type="checkbox" checked={editSync.enabled} onChange={e=>setEditSync({...editSync,enabled:e.target.checked})}/> 开启 Supabase 实时云端同步
   </label>
   {editSync.enabled&&<>
    <label>Supabase Project URL<input placeholder="https://your-project.supabase.co" value={editSync.url} onChange={e=>setEditSync({...editSync,url:e.target.value.trim()})}/></label>
    <label>Supabase Anon Key (公钥)<input type="password" placeholder="eyJhbGciOi..." value={editSync.anonKey} onChange={e=>setEditSync({...editSync,anonKey:e.target.value.trim()})}/></label>
    <label>个人同步口令 / 房间号 (多设备填写相同即可)<input placeholder="例如 default 或 my-todo" value={editSync.syncKey} onChange={e=>setEditSync({...editSync,syncKey:e.target.value.trim()||'default'})}/></label>
   </>}
   <div className="cloud-sync-actions">
    <button className="primary" onClick={()=>{saveSupabaseConfig(editSync);setSyncCfg(editSync);notify('云同步配置已保存');}}><Cloud size={15}/> 保存配置</button>
    {syncCfg.enabled&&<>
     <button className="soft-button" onClick={async()=>{notify('正在上传本地数据...');const r=await pushRemoteStore(syncCfg,store,sessionClientId);if(r.success)notify('本地数据已全量推送到云端！');else notify('推送失败: '+(r.error||'未知错误'));}}><Upload size={14}/> 强制推送到云端</button>
     <button className="soft-button" onClick={async()=>{notify('正在拉取云端数据...');const r=await fetchRemoteStore(syncCfg);if(r.store){isRemoteApplying.current=true;setStore(r.store);saveStore(r.store);notify('已成功拉取云端数据覆盖本地！');}else notify('拉取失败: '+(r.error||'无数据'));}}><Download size={14}/> 强制拉取云端</button>
    </>}
    <button className="text-button" style={{marginLeft:'auto'}} onClick={()=>setShowSql(!showSql)}>{showSql?'收起建表 SQL':'查看建表 SQL'}</button>
   </div>
   {showSql&&<div className="sql-hint">{`-- 在 Supabase 控制台的 SQL Editor 运行一次即可：
create table if not exists daily_flow_store (
  id text primary key,
  data jsonb not null,
  client_id text,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);
alter table daily_flow_store enable row level security;
create policy "Allow anon access" on daily_flow_store for all using (true) with check (true);
alter publication supabase_realtime add table daily_flow_store;`}</div>}
  </div>
  <h3>🕒 自动快照历史（防丢失恢复）</h3>
  <p>系统每次变动均自动保留最近快照。若遇到误操作或多端覆盖，可随时一键恢复：</p>
  <div className="snapshots-list">
   {getSnapshots().length===0?<small style={{color:'var(--muted)'}}>暂无快照记录</small>:getSnapshots().slice(0,5).map((snap,idx)=>(
    <div key={snap.time} className="snapshot-item">
     <div>
      <strong>{idx===0?'⭐ 最新自动快照':`快照 ${idx+1}`}</strong>
      <small>{new Date(snap.time).toLocaleTimeString()} · {snap.taskCount} 个任务 · {snap.ideaCount} 条灵感</small>
     </div>
     <button className="soft-button" onClick={()=>{change(()=>snap.data);notify('已成功恢复到该快照版本！');setModal(null);}}>一键恢复</button>
    </div>
   ))}
  </div>
  <h3>本地备份与安全</h3><p>数据保存在当前浏览器及你的专属云端房间。不同设备、地址或端口不会自动同步。</p><div className="backup-actions"><button className="soft-button" onClick={()=>download('daily-flow-'+today+'.json',JSON.stringify(store,null,2))}><Download size={16}/>导出备份</button><button className="soft-button" onClick={()=>fileInput.current?.click()}><Upload size={16}/>导入备份</button><button className="soft-button" style={{color:'#e77b79'}} onClick={handleLock}><Lock size={15}/> 锁定并退出</button><input ref={fileInput} type="file" aria-label="选择备份文件" accept="application/json,.json" hidden onChange={e=>importData(e.target.files?.[0])}/></div>{initial.error&&<button className="soft-button" onClick={()=>download('daily-flow-raw.json',JSON.stringify({current:localStorage.getItem(STORAGE_KEY),legacy:localStorage.getItem('daily-flow-tasks')},null,2))}>导出原始数据</button>}{pendingImport&&<div className="import-preview"><p>已验证 {pendingImport.tasks.length} 个任务、{pendingImport.lists.length} 个清单。导入会合并清单，新增任务、习惯和专注记录副本，不覆盖当前数据。</p><button className="primary" onClick={mergeImport}>确认合并导入</button><button className="soft-button" onClick={()=>setPendingImport(null)}>取消</button></div>}<h3>当前本地版范围</h3><p>支持任务、清单、标签、子任务、重复任务、日／周／月日历、看板、四象限、专注和习惯。本版支持 Supabase 实时多端同步，手机电脑随时秒连。</p><small>旧版任务会自动迁入，原 daily-flow-tasks 数据保留。</small></div></Modal>}
 </div>;
}
