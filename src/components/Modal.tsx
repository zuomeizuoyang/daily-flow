import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const el=ref.current!;el.showModal();return()=>el.close()},[]);
 return <dialog className="modal" ref={ref} onCancel={onClose}><header><h2>{title}</h2><button type="button" className="icon" aria-label="关闭弹窗" onClick={onClose}><X size={19}/></button></header>{children}</dialog>;
}
