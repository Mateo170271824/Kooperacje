// Kooperacje: raporty kwot, zestawienia projektów, projekt przy zapisie



import { iso, today, addD, fD, fDs, dniMiedzy, esc, plural, projOf, normTxt, kodProjektu } from "../logika.js?v=2";

import { KO, Z, byDate, canSeeAmounts, failed, me, pill, sortedP, supColor, supName, toast, zId } from '../app.js?v=3';
import { $, MIES } from './stale.js?v=3';
import { PDF_BLUE, fStyle, hStyle, kw, loadXlsx, logoData, miesNazwa, newPdf, nowStamp, pct, pdfFooter, pdfHeader, pdfPie, pieParts, r2, safeName, saveBlob, tStyle, tsIso, zl2 } from './pliki.js?v=3';

/* ---------- raporty kwot: grupowanie, zestawienia projektów, Excel, PDF ---------- */
export const R={period:"month", year:new Date().getFullYear(), slice:new Date().getMonth()+1, od:"", do:"", group:"podw", sup:"", open:new Set(), proj:""};
export const GRUPY={
  podw:   {t:"Podwykonawca",   k:z=>z.podw,                 n:k=>supName(k),                       sub:"rodzaj"},
  rodzaj: {t:"Rodzaj usługi",  k:z=>z.rodzaj||"",           n:k=>k||"(bez rodzaju)",               sub:"podw"},
  projekt:{t:"Projekt",        k:z=>projOf(z),              n:k=>k||"(bez projektu)",              sub:"podw"},
  mies:   {t:"Miesiąc",        k:z=>(z.data||"").slice(0,7),n:k=>miesNazwa(k)||"—",                sub:"podw"}
};
export const subKey=(t,z)=> t==="podw"? z.podw : (z.rodzaj||"");
export const subName=(t,k)=> t==="podw"? supName(k) : (k||"(bez rodzaju)");
export const SLICES={month:MIES.map((m,i)=>[i+1,m.replace(/^./,c=>c.toUpperCase())]), quarter:[[1,"I kwartał"],[2,"II kwartał"],[3,"III kwartał"],[4,"IV kwartał"]], half:[[1,"I półrocze"],[2,"II półrocze"]]};
export function rBounds(){
  const y=R.year;
  if(R.period==="custom"){ const od=R.od||(y+"-01-01"), dd=R.do||today(); return {start:od<=dd?od:dd, end:od<=dd?dd:od, label:`${fD(od)} – ${fD(dd)}`}; }
  let sm=0, em=11, label="Rok "+y;
  if(R.period==="month"){ sm=R.slice-1; em=sm; label=SLICES.month[sm][1]+" "+y; }
  else if(R.period==="quarter"){ sm=(R.slice-1)*3; em=sm+2; label=SLICES.quarter[R.slice-1][1]+" "+y; }
  else if(R.period==="half"){ sm=(R.slice-1)*6; em=sm+5; label=SLICES.half[R.slice-1][1]+" "+y; }
  return {start:`${y}-${String(sm+1).padStart(2,"0")}-01`, end:iso(new Date(y,em+1,0)), label};
}
export function rData(){
  const b=rBounds(), G=GRUPY[R.group];
  const orders=Z.filter(z=>z.status!=="Anulowane" && z.data && z.data>=b.start && z.data<=b.end && (!R.sup||z.podw===R.sup));
  const sumOf=L=>r2(L.reduce((a,z)=>a+(kw(z.id)||0),0)), cnt=L=>L.filter(z=>kw(z.id)!=null).length;
  const m=new Map(); orders.forEach(z=>{ const k=G.k(z); if(!m.has(k)) m.set(k,[]); m.get(k).push(z); });
  const rows=[...m].map(([k,L])=>{
    const sm=new Map(); L.forEach(z=>{ const s=subKey(G.sub,z); if(!sm.has(s)) sm.set(s,[]); sm.get(s).push(z); });
    const subs=[...sm].map(([s,SL])=>({k:s,name:subName(G.sub,s),orders:SL,count:SL.length,valued:cnt(SL),sum:sumOf(SL),proj:[...new Set(SL.map(projOf).filter(Boolean))]}))
      .sort((a,c)=>c.sum-a.sum||c.count-a.count||a.name.localeCompare(c.name,"pl"));
    return {k,name:G.n(k),orders:L.slice().sort(byDate),count:L.length,valued:cnt(L),sum:sumOf(L),subs,proj:[...new Set(L.map(projOf).filter(Boolean))]};
  });
  rows.sort(R.group==="mies" ? (a,c)=>a.k.localeCompare(c.k) : (a,c)=>c.sum-a.sum||c.count-a.count||a.name.localeCompare(c.name,"pl"));
  return {b,G,orders,rows,total:sumOf(orders),valued:cnt(orders)};
}
export function fillReportControls(){
  $("rPeriod").value=R.period; $("rYear").value=R.year;
  const sl=SLICES[R.period]; $("rSliceWrap").hidden=!sl; $("rYearWrap").hidden=R.period==="custom"; $("rCustom").hidden=R.period!=="custom";
  if(sl){ $("rSlice").innerHTML=sl.map(([v,l])=>`<option value="${v}">${l}</option>`).join(""); R.slice=Math.min(R.slice,sl.length); $("rSlice").value=String(R.slice); }
  $("rOd").value=R.od; $("rDo").value=R.do;
  document.querySelectorAll("#rGroup button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.g===R.group?"true":"false"));
  const cur=R.sup; $("rSup").innerHTML=`<option value="">Wszyscy podwykonawcy</option>`+sortedP().map(p=>`<option value="${p.id}">${esc(p.nazwa)}</option>`).join(""); $("rSup").value=cur;
}
export function renderRaporty(){
  if(!canSeeAmounts()) return;
  fillReportControls();
  const D=rData(), G=D.G;
  $("rRange").textContent=`Okres: ${D.b.label} (${fD(D.b.start)} – ${fD(D.b.end)}) · według daty odbioru, bez anulowanych`;
  $("rTotal").textContent=zl2(D.total)+" zł";
  $("rCount").textContent=`${D.valued} z ${D.orders.length}`;
  $("rCountHint").textContent=D.orders.length-D.valued ? `${D.orders.length-D.valued} ${plural(D.orders.length-D.valued,"czeka","czekają","czeka")} na kwotę` : "wszystkie wycenione";
  $("rAverage").textContent=D.valued? zl2(D.total/D.valued)+" zł" : "—";
  const top=D.rows.filter(r=>r.sum>0).sort((a,c)=>c.sum-a.sum)[0];
  $("rTopLbl").textContent="Największy · "+G.t.toLowerCase(); $("rTop").textContent=top? top.name : "—"; $("rTopHint").textContent=top? pct(top.sum,D.total)+" wartości" : "brak kwot";
  $("rHead").innerHTML=`<tr><th>${G.t}</th><th class="num">Zlecenia</th><th class="num">Z kwotą</th><th class="num">Wartość</th><th class="num">Udział</th><th></th></tr>`;
  $("rTitle").textContent="Według: "+G.t.toLowerCase();
  const max=Math.max(...D.rows.map(r=>r.sum),0);
  $("rRows").innerHTML = D.rows.length ? D.rows.map(r=>{
    const open=R.open.has(r.k);
    const subTxt=r.subs.map(s=>`${esc(s.name)} ${s.count}`).join(" · ");
    const projBtn=R.group==="projekt" && r.k && r.count>=2 ? `<button class="btn sm" type="button" data-rproj="${esc(r.k)}">Zestawienie</button>` : "";
    let h=`<tr class="click ${open?"open":""}" data-rk="${esc(r.k)}"><td><b>${esc(r.name)}</b><br><span class="small">${subTxt}</span></td><td class="num">${r.count}</td><td class="num">${r.valued}</td><td class="num">${zl2(r.sum)} zł</td><td class="num">${pct(r.sum,D.total)}</td>
      <td class="barcell"><div class="rbar"><span style="width:${max?Math.max(r.sum/max*100,r.sum?2:0):0}%"></span></div>${projBtn}</td></tr>`;
    if(open) h+=`<tr class="rsub"><td colspan="6"><table><thead><tr><th>Data odbioru</th><th>Podwykonawca</th><th>Nr / projekt</th><th>Element / opis</th><th>Rodzaj</th><th>Status</th><th class="num">Wartość</th></tr></thead><tbody>${
      r.orders.map(z=>`<tr class="click" data-z="${z.id}"><td class="mono">${fD(z.data)}</td><td><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td><td class="mono">${esc(projOf(z))}</td><td>${esc(z.opis)}</td><td>${esc(z.rodzaj)}</td><td>${pill(z.status)}</td><td class="num">${kw(z.id)==null?'<span class="small">brak kwoty</span>':zl2(kw(z.id))+" zł"}</td></tr>`).join("")}</tbody></table></td></tr>`;
    return h; }).join("") + `<tr class="tot"><td>Razem</td><td class="num">${D.orders.length}</td><td class="num">${D.valued}</td><td class="num">${zl2(D.total)} zł</td><td class="num">${D.total?"100%":"—"}</td><td></td></tr>`
    : `<tr><td colspan="6" class="small">Brak zleceń w wybranym okresie.</td></tr>`;
  renderMat(D);
  renderProjekt();
}
// inne koszty (materiał) z weryfikacji, w okresie raportu, według projektu
export function matData(b){
  const L=Object.values(KO).filter(k=>k.data && k.data>=b.start && k.data<=b.end);
  const m=new Map(); L.forEach(k=>{ const key=kodProjektu(k.projekt)||"(bez projektu)"; const g=m.get(key)||{projekt:key,n:0,sum:0,rodzaje:new Set(),L:[]}; g.n++; g.sum=r2(g.sum+(k.netto||0)); g.rodzaje.add(k.rodzaj||""); g.L.push(k); m.set(key,g); });
  const rows=[...m.values()].sort((a,c)=>c.sum-a.sum); return {rows,sum:r2(rows.reduce((a,g)=>a+g.sum,0)),n:L.length};
}
export function renderMat(D){
  const M=matData(D.b); $("rMat").hidden=!M.n;
  $("rTotalHint").textContent= M.n? `+ inne koszty (materiał) ${zl2(M.sum)} zł = ${zl2(r2(D.total+M.sum))} zł` : "zlecenia w wybranym okresie";
  if(!M.n) return;
  $("rMatRows").innerHTML=M.rows.map(g=>`<tr><td><b>${esc(g.projekt)}</b></td><td>${esc([...g.rodzaje].filter(Boolean).join(", "))}</td><td class="num">${g.n}</td><td class="num">${zl2(g.sum)} zł</td></tr>`).join("")
    +`<tr class="tot"><td colspan="2">Razem</td><td class="num">${M.n}</td><td class="num">${zl2(M.sum)} zł</td></tr>`;
}
export const matProj = k => Object.values(KO).filter(x=>normTxt(x.projekt)===normTxt(k)).sort((a,b)=>(a.data||"").localeCompare(b.data||""));
// zestawienie jednego projektu (wszystkie jego zlecenia, bez względu na okres)
export function projData(k){
  const L=Z.filter(z=>projOf(z)===k && z.status!=="Anulowane").sort((a,b)=>(tsIso(a.utworzono)||a.data||"").localeCompare(tsIso(b.utworzono)||b.data||""));
  const zam=L.map(z=>tsIso(z.utworzono)||z.data).filter(Boolean).sort(), odb=L.map(z=>z.odebrano).filter(Boolean).sort();
  const sum=r2(L.reduce((a,z)=>a+(kw(z.id)||0),0));
  const mat=matProj(k), sumMat=r2(mat.reduce((a,x)=>a+(x.netto||0),0));
  return {k,L,sum,mat,sumMat,razem:r2(sum+sumMat),first:zam[0]||"",last:odb.length?odb[odb.length-1]:"",odebrane:L.filter(z=>z.status==="Odebrane").length};
}
export function renderProjekt(){
  const box=$("rProj"); if(!R.proj){ box.hidden=true; return; }
  const P_=projData(R.proj); if(!P_.L.length){ R.proj=""; box.hidden=true; return; }
  box.hidden=false;
  $("rpTitle").textContent="Projekt "+P_.k;
  $("rpSum").textContent=zl2(P_.sum)+" zł"; $("rpMat").textContent=zl2(P_.sumMat)+" zł"; $("rpMatH").textContent=P_.mat.length? `${P_.mat.length} ${plural(P_.mat.length,"pozycja","pozycje","pozycji")} · razem ${zl2(P_.razem)} zł` : "brak w zapisanych przyjęciach"; $("rpCnt").textContent=P_.L.length; $("rpCntH").textContent=`${P_.odebrane} ${plural(P_.odebrane,"odebrane","odebrane","odebranych")}`;
  const dni=dniMiedzy(P_.first,P_.last); $("rpDni").textContent=dni==null?"—":dni+" "+plural(dni,"dzień","dni","dni"); $("rpDniH").textContent=P_.first?`${fDs(P_.first)} – ${P_.last?fDs(P_.last):"w toku"}`:"";
  $("rpRows").innerHTML=P_.L.map(z=>{ const zm=tsIso(z.utworzono)||""; const d=dniMiedzy(zm,z.odebrano);
    return `<tr class="click" data-z="${z.id}"><td>${esc(z.opis||z.rodzaj||"zlecenie")}<br><span class="small">${esc(z.rodzaj)}</span></td><td><span class="sw" style="background:${supColor(z.podw)}"></span>${esc(supName(z.podw))}</td><td class="mono">${fD(zm)}</td>
      <td>${z.odebrano?`<span class="mono">${fD(z.odebrano)}</span>`:`<span class="pill st-Gotowe">odbiór ${fDs(z.data)}</span>`}</td><td class="num">${d==null?"–":d}</td><td class="num">${kw(z.id)==null?'<span class="small">brak kwoty</span>':zl2(kw(z.id))+" zł"}</td></tr>`; }).join("")
    + `<tr class="tot"><td colspan="5">Razem kooperacja ${esc(P_.k)}</td><td class="num">${zl2(P_.sum)} zł</td></tr>`;
  $("rpMatBox").hidden=!P_.mat.length;
  $("rpMatRows").innerHTML=P_.mat.map(x=>`<tr><td>${esc(x.rodzaj||"")}<br><span class="small">${esc(x.uwagi||"")}</span></td><td>${esc(x.dost||"")}</td><td class="mono">${esc(x.pz)}</td><td class="mono">${fD(x.data)}</td><td class="num">${zl2(x.netto)} zł</td></tr>`).join("")
    + `<tr class="tot"><td colspan="4">Razem materiał · kooperacja + materiał = ${zl2(P_.razem)} zł</td><td class="num">${zl2(P_.sumMat)} zł</td></tr>`;
}
export async function rXlsx(){
  try{
    await loadXlsx(); const D=rData(), G=D.G, X=window.XLSX;
    const subLbl=G.sub==="podw"?"Podwykonawca":"Rodzaj usługi";
    const aoa=[["Raport wartości zamówień – Kooperacje"],["Okres",`${D.b.label} (${fD(D.b.start)} – ${fD(D.b.end)})`],["Grupowanie",G.t],["Podwykonawca",R.sup?supName(R.sup):"wszyscy"],["Sporządził",me.nazwa||me.login],["Data",fD(today())],[],
      [G.t,subLbl,"Projekty","Zlecenia","Z kwotą","Wartość [zł]","Udział"]];
    const r0=aoa.length;
    D.rows.forEach(r=>r.subs.forEach((s,i)=>aoa.push([i?"":r.name,s.name,s.proj.join(", "),s.count,s.valued,s.sum,D.total?s.sum/D.total:0])));
    aoa.push(["Razem","","",D.orders.length,D.valued,D.total,D.total?1:0]);
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:24},{wch:20},{wch:34},{wch:9},{wch:9},{wch:15},{wch:9}];
    for(let r=r0;r<aoa.length;r++){ const a=ws[X.utils.encode_cell({r,c:5})], b=ws[X.utils.encode_cell({r,c:6})]; if(a&&a.t==="n") a.z='#,##0.00 "zł"'; if(b&&b.t==="n") b.z="0.0%"; }
    const lista=[["Data odbioru","Podwykonawca","Nr / projekt","Element / opis","Rodzaj","Ilość","Status","Zamówiono","Odebrano","Wartość [zł]","Uwagi"]];
    D.orders.slice().sort(byDate).forEach(z=>lista.push([fD(z.data),supName(z.podw),projOf(z),z.opis||"",z.rodzaj||"",z.ilosc??"",z.status,fD(tsIso(z.utworzono)),fD(z.odebrano),kw(z.id)??"",z.uwagi||""]));
    const ws2=X.utils.aoa_to_sheet(lista); ws2["!cols"]=[{wch:12},{wch:16},{wch:16},{wch:30},{wch:16},{wch:7},{wch:16},{wch:12},{wch:12},{wch:13},{wch:30}];
    for(let r=1;r<lista.length;r++){ const c=ws2[X.utils.encode_cell({r,c:9})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; }
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Raport"); X.utils.book_append_sheet(wb,ws2,"Zlecenia");
    const M=matData(D.b);
    if(M.n){ const am=[["Projekt","Rodzaj","PZ","Data","Dostawca","Uwagi","Netto [zł]"]]; M.rows.forEach(g=>g.L.forEach(k=>am.push([g.projekt,k.rodzaj||"",k.pz,fD(k.data),k.dost||"",k.uwagi||"",k.netto??""]))); am.push(["Razem","","","","","",M.sum]);
      const wm=X.utils.aoa_to_sheet(am); wm["!cols"]=[{wch:16},{wch:14},{wch:20},{wch:11},{wch:24},{wch:30},{wch:13}];
      for(let r=1;r<am.length;r++){ const c=wm[X.utils.encode_cell({r,c:6})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; } X.utils.book_append_sheet(wb,wm,"Inne koszty"); }
    saveBlob(`raport-kooperacje-${safeName(D.b.label)}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
    toast("Pobrano raport w Excelu");
  }catch(x){ failed(x); }
}
export async function rPdf(){
  try{
    const D=rData(), G=D.G, d=await newPdf("portrait"), logo=$("rLogo").checked? await logoData():null;
    const subLbl=G.sub==="podw"?"Podwykonawca":"Rodzaj usługi", zProj=R.group!=="projekt";
    let y=pdfHeader(d,{title:"Raport wartości zamówień",okres:`Okres: ${D.b.label} · ${fD(D.b.start)} – ${fD(D.b.end)}`,
      sub:`Kooperacje · według: ${G.t.toLowerCase()} · ${R.sup?supName(R.sup):"wszyscy podwykonawcy"}`,meta:["Sporządził: "+(me.nazwa||me.login),"Data: "+fD(today())],logo});
    const head=[[subLbl,...(zProj?["Projekty"]:[]),"Zlecenia","Z kwotą","Wartość [zł]","Udział"]], body=[], ncol=head[0].length;
    D.rows.forEach(r=>{ body.push([{content:r.name+"   ·   "+zl2(r.sum)+" zł ("+pct(r.sum,D.total)+")",colSpan:ncol,styles:{fontStyle:"bold",textColor:PDF_BLUE,fillColor:[255,255,255],fontSize:8.8}}]);
      r.subs.forEach(s=>body.push([s.name,...(zProj?[s.proj.join(", ")]:[]),s.count,s.valued,zl2(s.sum),pct(s.sum,D.total)])); });
    const cs=zProj?{0:{cellWidth:38},1:{cellWidth:62},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"},5:{halign:"right"}}:{0:{cellWidth:70},1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"}};
    d.autoTable({head,body,foot:[[{content:"Razem",styles:{halign:"left"}},...(zProj?[""]:[]),D.orders.length,D.valued,zl2(D.total),D.total?"100%":"—"]],startY:y,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
      columnStyles:cs,alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"});
    y=d.lastAutoTable.finalY+6;
    y=pdfPie(d,y,pieParts(D.rows),"Udział w wartości",[["Zlecenia z kwotą",`${D.valued} z ${D.orders.length}`],["Średnio na zlecenie",D.valued?zl2(D.total/D.valued)+" zł":"—"],["Razem",zl2(D.total)+" zł"]]);
    const M=matData(D.b);
    if(M.n){ d.setFont("DV","bold"); d.setFontSize(10); d.setTextColor(...PDF_BLUE); d.text("Inne koszty (materiał) według projektu",14,y+2);
      d.autoTable({head:[["Projekt","Rodzaje","Pozycji","Netto [zł]"]],body:M.rows.map(g=>[g.projekt,[...g.rodzaje].filter(Boolean).join(", "),g.n,zl2(g.sum)]),
        foot:[[{content:"Razem materiał · kooperacja + materiał = "+zl2(r2(D.total+M.sum))+" zł",colSpan:2,styles:{halign:"left"}},M.n,zl2(M.sum)]],startY:y+5,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
        columnStyles:{2:{halign:"right"},3:{halign:"right"}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"}); }
    pdfFooter(d,"Kooperacje · wydruk "+nowStamp());
    saveBlob(`raport-kooperacje-${safeName(D.b.label)}.pdf`, d.output("blob"));
  }catch(x){ failed(x); }
}
export async function projXlsx(){
  try{
    await loadXlsx(); const P_=projData(R.proj), X=window.XLSX;
    const aoa=[["Zestawienie projektu "+P_.k],["Zlecenia",P_.L.length],["Wartość",P_.sum],["Data",fD(today())],[],["Element / opis","Rodzaj","Podwykonawca","Zamówiono","Termin odbioru","Odebrano","Dni","Wartość [zł]"]];
    const r0=aoa.length;
    P_.L.forEach(z=>{ const zm=tsIso(z.utworzono); aoa.push([z.opis||"",z.rodzaj||"",supName(z.podw),fD(zm),fD(z.data),fD(z.odebrano),dniMiedzy(zm,z.odebrano)??"",kw(z.id)??""]); });
    aoa.push(["Razem kooperacja","","","","","","",P_.sum]);
    if(P_.mat.length){ aoa.push([],["Inne koszty (materiał)","Dostawca","PZ","Data","","","","Netto [zł]"]); P_.mat.forEach(x=>aoa.push([(x.rodzaj||"")+" – "+(x.uwagi||""),x.dost||"",x.pz,fD(x.data),"","","",x.netto??""]));
      aoa.push(["Razem materiał","","","","","","",P_.sumMat],["Razem projekt","","","","","","",P_.razem]); }
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:30},{wch:16},{wch:16},{wch:12},{wch:14},{wch:12},{wch:6},{wch:14}];
    for(let r=r0;r<aoa.length;r++){ const c=ws[X.utils.encode_cell({r,c:7})]; if(c&&c.t==="n") c.z='#,##0.00 "zł"'; }
    const c2=ws["B3"]; if(c2) c2.z='#,##0.00 "zł"';
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Projekt");
    saveBlob(`projekt-${safeName(P_.k)}.xlsx`, new Blob([X.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/octet-stream"}));
  }catch(x){ failed(x); }
}
export async function projPdf(){
  try{
    const P_=projData(R.proj), d=await newPdf("portrait"), logo=$("rLogo").checked? await logoData():null;
    let y=pdfHeader(d,{title:"Zestawienie projektu "+P_.k,okres:`Okres: ${fD(P_.first)} – ${P_.last?fD(P_.last):"w toku"}`,
      sub:`Kooperacje · ${P_.L.length} ${plural(P_.L.length,"zlecenie","zlecenia","zleceń")} · ${[...new Set(P_.L.map(z=>supName(z.podw)))].join(", ")}`,meta:["Sporządził: "+(me.nazwa||me.login),"Data: "+fD(today())],logo});
    const body=P_.L.map(z=>{ const zm=tsIso(z.utworzono); const dd=dniMiedzy(zm,z.odebrano); return [z.opis||z.rodzaj||"zlecenie",z.rodzaj||"",supName(z.podw),fD(zm),z.odebrano?fD(z.odebrano):"odbiór "+fD(z.data),dd==null?"–":dd,kw(z.id)==null?"brak":zl2(kw(z.id))]; });
    d.autoTable({head:[["Element / opis","Rodzaj","Podwykonawca","Zamówiono","Odebrano","Dni","Wartość [zł]"]],body,foot:[[{content:"Razem",styles:{halign:"left"}},"","","","","",zl2(P_.sum)]],startY:y,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
      columnStyles:{0:{cellWidth:50},5:{halign:"right"},6:{halign:"right"}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"});
    y=d.lastAutoTable.finalY+6;
    const bySup=new Map(); P_.L.forEach(z=>{ if(kw(z.id)) bySup.set(supName(z.podw),(bySup.get(supName(z.podw))||0)+kw(z.id)); });
    if(P_.mat.length){ d.setFont("DV","bold"); d.setFontSize(10); d.setTextColor(...PDF_BLUE); d.text("Inne koszty (materiał)",14,y+2);
      d.autoTable({head:[["Materiał","Dostawca","PZ","Data","Netto [zł]"]],body:P_.mat.map(x=>[(x.rodzaj||"")+(x.uwagi?" – "+x.uwagi:""),x.dost||"",x.pz,fD(x.data),zl2(x.netto)]),
        foot:[[{content:"Razem materiał",colSpan:4,styles:{halign:"left"}},zl2(P_.sumMat)]],startY:y+5,styles:tStyle,headStyles:hStyle,footStyles:{...fStyle,halign:"right"},
        columnStyles:{0:{cellWidth:62},4:{halign:"right"}},alternateRowStyles:{fillColor:[243,247,252]},margin:{left:14,right:14,bottom:16},showFoot:"lastPage"});
      y=d.lastAutoTable.finalY+6; }
    if(P_.mat.length) bySup.set("Materiał",P_.sumMat);
    pdfPie(d,y,pieParts([...bySup].map(([name,sum])=>({name,sum}))),"Udział w kosztach",[["Kooperacja",zl2(P_.sum)+" zł"],["Materiał",zl2(P_.sumMat)+" zł"],["Razem projekt",zl2(P_.razem)+" zł"]]);
    pdfFooter(d,"Kooperacje · wydruk "+nowStamp());
    saveBlob(`projekt-${safeName(P_.k)}.pdf`, d.output("blob"));
  }catch(x){ failed(x); }
}
$("rPeriod").addEventListener("change",e=>{ R.period=e.target.value; R.slice=R.period==="month"?new Date().getMonth()+1:R.period==="quarter"?Math.floor(new Date().getMonth()/3)+1:R.period==="half"?(new Date().getMonth()<6?1:2):1; R.open.clear(); renderRaporty(); });
$("rYear").addEventListener("change",e=>{ R.year=Number(e.target.value)||new Date().getFullYear(); R.open.clear(); renderRaporty(); });
$("rSlice").addEventListener("change",e=>{ R.slice=Number(e.target.value)||1; R.open.clear(); renderRaporty(); });
$("rOd").addEventListener("change",e=>{ R.od=e.target.value; renderRaporty(); });
$("rDo").addEventListener("change",e=>{ R.do=e.target.value; renderRaporty(); });
$("rSup").addEventListener("change",e=>{ R.sup=e.target.value; R.open.clear(); renderRaporty(); });
$("rGroup").addEventListener("click",e=>{ const b=e.target.closest("button[data-g]"); if(!b) return; R.group=b.dataset.g; R.open.clear(); renderRaporty(); });
$("rRows").addEventListener("click",e=>{
  const pb=e.target.closest("[data-rproj]"); if(pb){ e.stopPropagation(); R.proj=pb.dataset.rproj; renderProjekt(); $("rProj").scrollIntoView({behavior:"smooth",block:"start"}); return; }
  if(e.target.closest("[data-z]")) return;
  const tr=e.target.closest("tr[data-rk]"); if(!tr) return; const k=tr.dataset.rk; R.open.has(k)?R.open.delete(k):R.open.add(k); renderRaporty();
});
$("btnRXlsx").onclick=rXlsx; $("btnRPdf").onclick=rPdf;
$("btnPXlsx").onclick=projXlsx; $("btnPPdf").onclick=projPdf; $("btnPClose").onclick=()=>{ R.proj=""; renderProjekt(); };

/* ---------- projekt przy zapisie: ta sama nazwa po ponad miesiącu → pytanie ---------- */
export function askProject(nr, data, groups){
  return new Promise(res=>{
    const dlg=$("dlgP"), nowy=`${nr} · ${data.slice(5,7)}.${data.slice(0,4)}`;
    let key=nowy, i=2; while(Z.some(z=>projOf(z)===key)) key=`${nowy} (${i++})`;
    $("pqT").textContent=`Projekt „${nr}” już był`;
    const g=groups[0];
    $("pqTxt").innerHTML=`Ostatnie zlecenie dla ${esc(nr)} było <b>${fD(g.last)}</b>, czyli ponad miesiąc temu (${g.n} ${plural(g.n,"zlecenie","zlecenia","zleceń")}${canSeeAmounts()&&g.sum?", "+zl2(g.sum)+" zł":""}). Do którego projektu dodać to zlecenie?`;
    $("pqCh").innerHTML=`<label class="on"><input type="radio" name="pq" value="${esc(key)}" checked><b>Nowy projekt ${esc(key)}</b><span class="small">osobne zestawienie</span></label>`+
      groups.map(x=>`<label><input type="radio" name="pq" value="${esc(x.k)}"><b>Dopisz do ${esc(x.k)}</b><span class="small">${x.n} ${plural(x.n,"zlecenie","zlecenia","zleceń")}, ostatnie ${fD(x.last)}</span></label>`).join("");
    $("pqCh").onchange=()=>$("pqCh").querySelectorAll("label").forEach(l=>l.classList.toggle("on",l.querySelector("input").checked));
    const done=v=>{ dlg.removeEventListener("close",onClose); res(v); };
    const onClose=()=>done(dlg.returnValue==="ok"? ($("pqCh").querySelector("input:checked")?.value ?? null) : null);
    dlg.returnValue=""; dlg.addEventListener("close",onClose); dlg.showModal();
  });
}
// zwraca klucz projektu do zapisania w polu `projekt` ("" = taki sam jak nr), albo null gdy anulowano
export async function resolveProject(d){
  const cur=zId? Z.find(x=>x.id===zId) : null, nr=(d.nr||"").trim();
  if(!nr) return "";
  if(cur && normTxt(cur.nr)===normTxt(nr)) return cur.projekt||"";
  const others=Z.filter(z=>z.id!==zId && z.status!=="Anulowane" && normTxt(z.nr)===normTxt(nr));
  if(!others.length) return "";
  const gm=new Map();
  others.forEach(z=>{ const k=projOf(z), last=[z.data,tsIso(z.utworzono),z.odebrano].filter(Boolean).sort().pop()||""; const g=gm.get(k)||{k,n:0,last:"",sum:0}; g.n++; if(last>g.last) g.last=last; g.sum+=kw(z.id)||0; gm.set(k,g); });
  const G=[...gm.values()].sort((a,b)=>b.last.localeCompare(a.last));
  const kiedy=d.data||today();
  const key = (!G[0].last || G[0].last>=addD(kiedy,-30)) ? G[0].k : await askProject(nr,kiedy,G);
  if(key==null) return null;
  return normTxt(key)===normTxt(nr) ? "" : key;
}
