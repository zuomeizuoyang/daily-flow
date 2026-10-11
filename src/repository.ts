import {baseStore,migrateLegacy,validateStore,type Store} from './model';
export const STORAGE_KEY='daily-flow-v2';
export function loadStore():{store:Store;error:string}{
 try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return {store:validateStore(JSON.parse(raw)),error:''};const legacy=localStorage.getItem('daily-flow-tasks');return {store:legacy?validateStore(migrateLegacy(JSON.parse(legacy))):baseStore(),error:''};}
 catch{return {store:baseStore(),error:'本地数据读取失败。原始数据未覆盖，请先导出原始数据备份，再处理恢复。'};}
}
export type Snapshot = {
  time: number;
  taskCount: number;
  ideaCount: number;
  data: Store;
};

const SNAPSHOTS_KEY = 'daily-flow-snapshots';

export function getSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSnapshot(store: Store) {
  try {
    const list = getSnapshots();
    const now = Date.now();
    const taskCount = store.tasks ? store.tasks.filter(t => !t.deleted).length : 0;
    const ideaCount = store.ideas ? store.ideas.length : 0;
    if (taskCount === 0 && ideaCount === 0 && list.length > 0) return;
    if (list.length > 0) {
      const last = list[0];
      if (last.taskCount === taskCount && last.ideaCount === ideaCount && now - last.time < 15000) {
        return;
      }
    }
    const next: Snapshot[] = [
      { time: now, taskCount, ideaCount, data: store },
      ...list.slice(0, 9)
    ];
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function saveStore(store:Store){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(store));
  saveSnapshot(store);
}
export function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

