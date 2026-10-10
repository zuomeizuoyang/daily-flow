import {baseStore,migrateLegacy,validateStore,type Store} from './model';
export const STORAGE_KEY='daily-flow-v2';
export function loadStore():{store:Store;error:string}{
 try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)return {store:validateStore(JSON.parse(raw)),error:''};const legacy=localStorage.getItem('daily-flow-tasks');return {store:legacy?validateStore(migrateLegacy(JSON.parse(legacy))):baseStore(),error:''};}
 catch{return {store:baseStore(),error:'本地数据读取失败。原始数据未覆盖，请先导出原始数据备份，再处理恢复。'};}
}
export function saveStore(store:Store){localStorage.setItem(STORAGE_KEY,JSON.stringify(store));}
export function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
