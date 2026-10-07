"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export function AppDialog({open,title,description,confirmLabel="Confirm",cancelLabel="Cancel",tone="default",onConfirm,onClose}:{open:boolean;title:string;description:string;confirmLabel?:string;cancelLabel?:string|null;tone?:"default"|"danger"|"success";onConfirm?:()=>void;onClose:()=>void}){
  const confirmRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(!open)return;confirmRef.current?.focus();const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",close);return()=>document.removeEventListener("keydown",close)},[open,onClose]);
  if(!open)return null;
  return <div className="app-dialog-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className={`app-dialog ${tone}`} role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-description"><button className="app-dialog-close" onClick={onClose} aria-label="Close dialog"><X size={19}/></button><span className="app-dialog-icon">{tone==="success"?<CheckCircle2 size={23}/>:<AlertTriangle size={23}/>}</span><h2 id="app-dialog-title">{title}</h2><p id="app-dialog-description">{description}</p><div className="app-dialog-actions">{cancelLabel&&<button className="secondary" onClick={onClose}>{cancelLabel}</button>}<button ref={confirmRef} className="confirm" onClick={()=>{onConfirm?.();onClose()}}>{confirmLabel}</button></div></section></div>;
}
