// Kooperacje: wspólne biblioteki, pliki, kwoty, projekty i PDF



import { iso, fD } from "../logika.js?v=3";

import { V, toast, tsDate } from '../app.js?v=4';
import { MIES } from './stale.js?v=4';

/* ---------- wspólne: biblioteki, pliki, kwoty, projekty ---------- */
export const loadScript = src => new Promise((ok,err)=>{ const s=document.createElement("script"); s.src=src; s.onload=ok; s.onerror=()=>err(new Error("Nie udało się wczytać "+src)); document.head.appendChild(s); });
export let xlsxReady=null, pdfReady=null;
export function loadXlsx(){ if(!xlsxReady) xlsxReady=(window.XLSX?Promise.resolve():loadScript("vendor/xlsx.full.min.js")).catch(e=>{xlsxReady=null; throw e;}); return xlsxReady; }
export function loadPdf(){
  if(!pdfReady) pdfReady=(window.jspdf?Promise.resolve():loadScript("vendor/jspdf.umd.min.js"))
    .then(()=>window.jspdf.jsPDF.API.autoTable?null:loadScript("vendor/jspdf.plugin.autotable.min.js"))
    .then(()=>window.PDF_FONT_R?null:loadScript("vendor/pdf-fonts.js")).catch(e=>{pdfReady=null; throw e;});
  return pdfReady;
}
// aplikacja Android (Capacitor): pliki idą przez okno „Udostępnij” (zapis w Pobranych, Dysk, mail…) – jak w Zapytaniach
export const natywna = () => !!globalThis.Capacitor?.isNativePlatform?.();
export const base64 = blob => new Promise((ok,err)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]); r.onerror=err; r.readAsDataURL(blob); });
export async function udostepnij(name, blob){
  const { Filesystem, Share } = globalThis.Capacitor.Plugins;
  const plik = await Filesystem.writeFile({ path:name, data:await base64(blob), directory:"CACHE" });
  await Share.share({ title:name, files:[plik.uri], dialogTitle:"Zapisz lub wyślij plik" });
}
export function saveBlob(name, blob){ if(natywna()) return udostepnij(name, blob).catch(x=>{ if(!/cancel/i.test(x?.message||"")) toast("Nie udało się zapisać pliku: "+(x?.message||x)); });
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},1500); }
export const safeName = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[łŁ]/g,"l").replace(/[^A-Za-z0-9._-]+/g,"_").replace(/^_+|_+$/g,"").slice(0,60);
export const kw = id => { const v=V[id]?.wartosc; return v==null||v===""||!Number.isFinite(Number(v)) ? null : Number(v); };
export const r2 = v => Math.round((v||0)*100)/100;
export const zl2 = v => v==null ? "—" : Number(v).toLocaleString("pl-PL",{minimumFractionDigits:2,maximumFractionDigits:2});
export const pct = (v,t) => t ? (v/t*100).toLocaleString("pl-PL",{minimumFractionDigits:1,maximumFractionDigits:1})+"%" : "—";
export const tsIso = t => { const d=tsDate(t); return d ? iso(d) : ""; };
export const nowStamp = () => { const d=new Date(); return fD(iso(d))+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); };
export const miesNazwa = ym => ym ? MIES[+ym.slice(5)-1].replace(/^./,c=>c.toUpperCase())+" "+ym.slice(0,4) : "";

/* ---------- PDF w stylu Kalkulatora stali (niebieski) ---------- */
export const PDF_BLUE=[31,78,140], PDF_LINE=[67,148,208], PDF_TXT=[21,32,43], PDF_MUTED=[86,104,122];
export const PIE_KOL=["#1f4e8c","#3a78c2","#6fa3dc","#a3c6ec","#cfe0f5","#8aa4c2","#5b7699"];
export async function newPdf(orient){
  await loadPdf();
  const d=new window.jspdf.jsPDF({orientation:orient||"portrait",unit:"mm",format:"a4"});
  d.addFileToVFS("dv.ttf",window.PDF_FONT_R); d.addFont("dv.ttf","DV","normal");
  d.addFileToVFS("dvb.ttf",window.PDF_FONT_B); d.addFont("dvb.ttf","DV","bold");
  d.setFont("DV","normal"); return d;
}
export let logoPng=null;
export async function logoData(){
  if(logoPng) return logoPng;
  try{
    const svg=await (await fetch("icon.svg")).text();
    const img=new Image(); img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg); await img.decode();
    const c=document.createElement("canvas"); c.width=c.height=256; c.getContext("2d").drawImage(img,0,0,256,256);
    return logoPng=c.toDataURL("image/png");
  }catch{ return null; }
}
export function pdfHeader(d,{title,okres,sub,meta,logo}){
  const W=d.internal.pageSize.getWidth(); let x=14;
  if(logo){ d.addImage(logo,"PNG",14,9,15,15); x=32; }
  d.setFont("DV","bold"); d.setFontSize(16); d.setTextColor(...PDF_TXT); d.text(title,x,15);
  if(okres){ d.setFontSize(10.5); d.setTextColor(...PDF_BLUE); d.text(okres,x,21); }
  d.setFont("DV","normal"); d.setFontSize(8.5); d.setTextColor(...PDF_MUTED);
  if(sub) d.text(sub,x,26);
  let y=12; (meta||[]).forEach(t=>{ d.text(t,W-14,y,{align:"right"}); y+=4.4; });
  const ly=Math.max(y,29.5); d.setDrawColor(...PDF_LINE); d.setLineWidth(.8); d.line(14,ly,W-14,ly);
  return ly+5;
}
export function pdfFooter(d,note){
  const n=d.internal.getNumberOfPages(), W=d.internal.pageSize.getWidth(), H=d.internal.pageSize.getHeight();
  for(let i=1;i<=n;i++){ d.setPage(i); d.setFont("DV","normal"); d.setFontSize(7.5); d.setTextColor(120,132,144);
    d.text(note,14,H-8); d.text("Strona "+i+" z "+n,W-14,H-8,{align:"right"}); }
}
export const tStyle={font:"DV",fontSize:8.2,cellPadding:1.6,lineColor:[211,218,225],lineWidth:.1,textColor:PDF_TXT};
export const hStyle={fillColor:PDF_BLUE,textColor:255,fontStyle:"bold",halign:"center",valign:"middle"};
export const fStyle={fillColor:[223,234,247],textColor:PDF_TXT,fontStyle:"bold"};
export function pieCanvas(parts){
  const c=document.createElement("canvas"); c.width=c.height=600; const g=c.getContext("2d");
  const tot=parts.reduce((a,p)=>a+p.v,0); let a0=-Math.PI/2;
  parts.forEach((p,i)=>{ const a1=a0+2*Math.PI*p.v/tot; g.beginPath(); g.moveTo(300,300); g.arc(300,300,280,a0,a1); g.closePath();
    g.fillStyle=PIE_KOL[i%PIE_KOL.length]; g.fill(); g.lineWidth=6; g.strokeStyle="#fff"; g.stroke();
    const sh=p.v/tot; if(sh>=.06){ const m=(a0+a1)/2; g.fillStyle=i<2||i===6?"#fff":"#15202b"; g.font="bold 40px sans-serif"; g.textAlign="center"; g.textBaseline="middle";
      g.fillText(Math.round(sh*100)+"%",300+180*Math.cos(m),300+180*Math.sin(m)); }
    a0=a1; });
  return c.toDataURL("image/png");
}
// wykres kołowy + legenda + podsumowanie pod tabelą
export function pdfPie(d,y,parts,title,sum){
  const W=d.internal.pageSize.getWidth(), H=d.internal.pageSize.getHeight();
  if(y+56>H-14){ d.addPage(); y=16; }
  d.setDrawColor(201,216,234); d.setLineWidth(.3); d.roundedRect(14,y,W-28,52,1.5,1.5);
  const tot=parts.reduce((a,p)=>a+p.v,0);
  if(tot>0){ d.addImage(pieCanvas(parts),"PNG",18,y+4,44,44); }
  let ly=y+8; const lx=67;
  d.setFont("DV","bold"); d.setFontSize(9); d.setTextColor(...PDF_BLUE); d.text(title,lx,ly); ly+=5.5;
  d.setFontSize(8.2);
  parts.forEach((p,i)=>{ const col=PIE_KOL[i%PIE_KOL.length]; d.setFillColor(parseInt(col.slice(1,3),16),parseInt(col.slice(3,5),16),parseInt(col.slice(5,7),16));
    d.rect(lx,ly-2.6,3,3,"F"); d.setFont("DV","normal"); d.setTextColor(...PDF_TXT);
    d.text(d.splitTextToSize(p.n,40)[0],lx+5,ly); d.setFont("DV","bold"); d.text(pct(p.v,tot),lx+60,ly,{align:"right"}); ly+=5; });
  const sx=W-14-56; d.setDrawColor(201,216,234); d.line(sx-5,y+6,sx-5,y+46);
  let sy=y+12; sum.forEach(([k,v],i)=>{ const big=i===sum.length-1; d.setFont("DV","normal"); d.setFontSize(big?10.5:8.5); d.setTextColor(...PDF_MUTED); d.text(k,sx,sy);
    d.setFont("DV","bold"); d.setTextColor(...PDF_TXT); d.text(v,W-18,sy,{align:"right"}); sy+=big?9:7; });
  return y+58;
}
export function pieParts(rows, n=6){
  const L=rows.filter(r=>r.sum>0).map(r=>({n:r.name,v:r.sum})).sort((a,b)=>b.v-a.v);
  if(L.length<=n+1) return L;
  return L.slice(0,n).concat([{n:"Pozostałe",v:L.slice(n).reduce((a,p)=>a+p.v,0)}]);
}
