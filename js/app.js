/* MCDO EET — eetdagboek. Alles staat in localStorage op dit toestel (sleutel "mcdoeet:v1").
   Snel ingeven: tik een suggestie aan (geleerd uit wat je vroeger at), of typ/spreek kort in.
   Bewust GEEN calorieën: net als de coach in MCDO PT kijken we kwalitatief naar je eten. */

/* =====================================================================
   VASTE LIJSTEN
   ===================================================================== */
const KEY="mcdoeet:v1";
const SLOTS=[
  {id:"ontbijt",    label:"Ontbijt",    tile:"t-cream"},
  {id:"middag",     label:"Middag",     tile:"t-mint"},
  {id:"avond",      label:"Avond",      tile:"t-yellow"},
  {id:"tussendoor", label:"Tussendoor", tile:"t-peach"}
];
const COUNTERS=[
  {id:"water",     label:"Water",            unit:"glazen"},
  {id:"koffie",    label:"Koffie / thee",    unit:"tassen"},
  {id:"groenten",  label:"Groenten & fruit", unit:"porties"},
  {id:"frisdrank", label:"Frisdrank",        unit:"glazen"},
  {id:"alcohol",   label:"Alcohol",          unit:"glazen"}
];
const FEELS=[["goed","Goed"],["oke","Oké"],["minder","Minder"]];
/* startsuggesties zolang de app nog niets geleerd heeft */
const SEEDS={
  ontbijt:["Boterhammen met kaas","Boterhammen met choco","Havermout","Yoghurt met fruit","Muesli","Croissant","Eitjes","Banaan"],
  middag:["Boterhammen","Soep","Slaatje","Broodje","Pasta","Restjes van gisteren","Wrap"],
  avond:["Aardappelen, groenten en vlees","Pasta","Rijst met groenten","Frietjes","Pizza","Wok","Vis met groenten","Soep"],
  tussendoor:["Fruit","Koek","Chocolade","Chips","Noten","Yoghurt","Snoep","Reep"]
};

/* =====================================================================
   DATUMS (dag wisselt pas om 04:00, zoals MCDO FIT)
   ===================================================================== */
function isoDate(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function todayStr(){ const d=new Date(); d.setHours(d.getHours()-4); return isoDate(d); }
function parseISO(s){ const p=s.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]); }
function addDays(s,n){ const d=parseISO(s); d.setDate(d.getDate()+n); return isoDate(d); }
function daysBetween(a,b){ return Math.round((parseISO(b)-parseISO(a))/86400000); }
function prettyDate(s){ return parseISO(s).toLocaleDateString("nl-BE",{weekday:"long",day:"numeric",month:"long"}); }
function shortDate(s){ return parseISO(s).toLocaleDateString("nl-BE",{weekday:"short",day:"numeric",month:"short"}); }
function dayName(s){ const n=daysBetween(s,todayStr()); return n===0?"Vandaag":n===1?"Gisteren":parseISO(s).toLocaleDateString("nl-BE",{weekday:"long"}); }
/* welke maaltijd is het nu, volgens de klok? */
function slotNow(){
  const h=new Date().getHours()+new Date().getMinutes()/60;
  if(h>=4 && h<10.5) return "ontbijt";
  if(h>=10.5 && h<14.5) return "middag";
  if(h>=17 && h<21.5) return "avond";
  return "tussendoor";
}

/* =====================================================================
   DATA
   ===================================================================== */
function freshState(){ return { v:1, days:{}, products:{}, settings:{theme:"system"} }; }
let state=freshState();
function blankDay(){ return { meals:{ontbijt:[],middag:[],avond:[],tussendoor:[]}, count:{}, feel:"", note:"" }; }
function getDay(d){ return state.days[d]||blankDay(); }
function ensureDay(d){
  if(!state.days[d]) state.days[d]=blankDay();
  const x=state.days[d]; x.meals=Object.assign(blankDay().meals,x.meals||{}); x.count=x.count||{};
  return x;
}
function isEmptyDay(x){
  return !x || (!SLOTS.some(s=>(x.meals[s.id]||[]).length) && !Object.values(x.count||{}).some(v=>v>0) && !x.feel && !x.note);
}
function itemCount(x){ return SLOTS.reduce((n,s)=>n+((x.meals[s.id]||[]).length),0); }
function mainMealsDone(x){ return ["ontbijt","middag","avond"].filter(s=>(x.meals[s]||[]).length).length; }
function norm(t){ return String(t).trim().toLowerCase().replace(/\s+/g," "); }
function tidy(t){ t=String(t).trim().replace(/\s+/g," "); return t.charAt(0).toUpperCase()+t.slice(1); }

function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw){ const s=JSON.parse(raw), f=freshState(); state=Object.assign(f,s); state.settings=Object.assign(f.settings,s.settings||{}); state.days=s.days||{}; state.products=s.products||{}; }
  }catch(e){}
}
function save(){
  // lege dagen niet bewaren
  Object.keys(state.days).forEach(d=>{ if(isEmptyDay(state.days[d])) delete state.days[d]; });
  try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){ alert("Kon niet bewaren op dit toestel."); }
  if(typeof scheduleSync==="function") scheduleSync(); // koppeling met MCDO PT (js/sync.js)
}

function addItem(d,slot,text,prod){
  text=tidy(text); if(!text) return false;
  const x=ensureDay(d);
  if(x.meals[slot].some(m=>norm(m.t)===norm(text))) return false; // geen dubbels in dezelfde maaltijd
  if(prod) state.products[norm(text)]=prod;                     // gescand product onthouden voor de volgende keer
  const p=prod||state.products[norm(text)];
  const m={t:text, at:new Date().toISOString()}; if(p) m.p=p;
  x.meals[slot].push(m);
  save(); return true;
}

/* Suggesties: wat je vaak at (vooral bij deze maaltijd en recent), aangevuld met startsuggesties. */
function suggestions(slot,q,d){
  const score={}, label={}, t=todayStr();
  Object.entries(state.days).forEach(([day,x])=>{
    const age=Math.max(0,daysBetween(day,t)), w=age<=14?1:age<=60?.6:.3;
    SLOTS.forEach(s=>(x.meals[s.id]||[]).forEach(m=>{
      const k=norm(m.t); if(!label[k]) label[k]=m.t;
      score[k]=(score[k]||0)+(s.id===slot?3:.6)*w;
    }));
  });
  (SEEDS[slot]||[]).forEach((txt,i)=>{ const k=norm(txt); if(!(k in score)){ score[k]=.4-i*.01; label[k]=txt; } });
  const have=new Set((getDay(d).meals[slot]||[]).map(m=>norm(m.t)));
  let list=Object.keys(score).filter(k=>!have.has(k));
  const qq=norm(q||"");
  if(qq) list=list.filter(k=>k.includes(qq));
  list.sort((a,b)=>score[b]-score[a]);
  return list.slice(0,qq?10:14).map(k=>label[k]);
}

/* =====================================================================
   PRODUCT SCANNEN (Open Food Facts — gratis, open databank met veel Belgische producten)
   Middenweg: per product Nutri-Score, bewerkingsgraad en kcal per portie tonen, GEEN dagtotaal.
   ===================================================================== */
const NOVA={1:"onbewerkt",2:"keukeningrediënt",3:"bewerkt",4:"sterk bewerkt"};
const NS_TXT={a:"heel goede keuze",b:"goede keuze",c:"middelmatig",d:"minder goede keuze",e:"af en toe"};
async function lookupProduct(code){
  code=String(code).replace(/\D/g,"");
  if(code.length<8) throw new Error("Dat lijkt geen geldige barcode");
  const f="product_name,product_name_nl,product_name_fr,generic_name_nl,brands,nutriscore_grade,nova_group,nutriments,serving_size,serving_quantity,quantity";
  let r;
  try{ r=await fetch("https://world.openfoodfacts.org/api/v2/product/"+code+".json?fields="+f); }catch(e){ throw new Error("Geen verbinding"); }
  if(r.status===404) throw new Error("Product niet gevonden");
  if(!r.ok) throw new Error("Open Food Facts antwoordde "+r.status);
  const j=await r.json(), x=j.product;
  if(!x || j.status===0) throw new Error("Product niet gevonden");
  const nm=x.nutriments||{}, sq=+x.serving_quantity||0;
  const k100=nm["energy-kcal_100g"]!=null?Math.round(nm["energy-kcal_100g"]):null;
  let kp=nm["energy-kcal_serving"]!=null?Math.round(nm["energy-kcal_serving"]):(k100!=null&&sq?Math.round(k100*sq/100):null);
  const ns=/^[a-e]$/.test(x.nutriscore_grade||"")?x.nutriscore_grade:"";
  const name=(x.product_name_nl||x.product_name||x.product_name_fr||x.generic_name_nl||"").trim();
  return { code, n:name||("Product "+code), b:(x.brands||"").split(",")[0].trim(), ns, nova:+x.nova_group||0, k100, kp, por:x.serving_size||"" };
}
function prodLabel(p){ return tidy(p.n); }
function nsBadge(p,big){ return p&&p.ns?`<b class="ns ns-${p.ns}${big?" big":""}" title="Nutri-Score ${p.ns.toUpperCase()}">${p.ns.toUpperCase()}</b>`:""; }
/* tekst voor de coach: kwaliteit wel, calorieën niet */
function prodTag(p){ if(!p) return ""; const a=[]; if(p.ns) a.push("Nutri-Score "+p.ns.toUpperCase()); if(p.nova) a.push(NOVA[p.nova]); return a.length?" ["+a.join(", ")+"]":""; }

/* camera-scanner: html5-qrcode wordt pas geladen als je echt scant */
let scanner=null;
function loadScript(src){ return new Promise((ok,ko)=>{ if(window.Html5Qrcode) return ok(); const e=document.createElement("script"); e.src=src; e.onload=ok; e.onerror=()=>ko(new Error("Kon de scanner niet laden (internet?)")); document.head.appendChild(e); }); }
async function openScanner(){
  const host=$("scan"); host.hidden=false; document.body.classList.add("noscroll");
  host.innerHTML=`<div class="ov-top"><div class="ov-title">Scan barcode</div><button class="iconbtn" data-act="scanclose" aria-label="Sluiten">${CLOSE}</button></div>
    <div class="sheet-in"><div id="reader"></div><div class="hint" id="scanmsg">Camera starten…</div>
      <div class="lab">Of typ de cijfers onder de barcode</div>
      <form class="addrow" id="codeform" autocomplete="off"><input class="fld" id="codetxt" inputmode="numeric" placeholder="bv. 5410041001204"><button class="btn primary" type="submit">Zoek</button></form></div>`;
  $("codeform").addEventListener("submit",e=>{ e.preventDefault(); const v=$("codetxt").value; if(v.trim()) gotCode(v); });
  try{
    await loadScript("https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js");
    const F=Html5QrcodeSupportedFormats;
    scanner=new Html5Qrcode("reader",{formatsToSupport:[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E],verbose:false});
    await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:260,height:130}},txt=>gotCode(txt),()=>{});
    $("scanmsg").textContent="Hou de barcode in het kader.";
  }catch(e){
    const m=$("scanmsg"); if(m) m.textContent=(e&&e.name==="NotAllowedError")?"Geen toegang tot de camera. Typ de code hieronder, of geef toegang in de instellingen van je iPhone.":(e.message||"Camera niet beschikbaar")+" — typ de code hieronder.";
  }
}
async function closeScanner(){
  if(scanner){ try{ await scanner.stop(); }catch(e){} try{ scanner.clear(); }catch(e){} scanner=null; }
  const host=$("scan"); host.hidden=true; host.innerHTML=""; if(!sheet) document.body.classList.remove("noscroll");
}
let lookingUp=false;
async function gotCode(code){
  if(lookingUp) return; lookingUp=true;
  await closeScanner();
  if(!sheet){ lookingUp=false; return; }
  sheet.prod={busy:true}; renderSheet();
  try{ sheet.prod=await lookupProduct(code); }catch(e){ sheet.prod={err:e.message, code}; }
  lookingUp=false; if(sheet) renderSheet();
}

/* =====================================================================
   HULPJES & ICONEN
   ===================================================================== */
const CHEV_L='<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>';
const CHEV_R='<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>';
const CLOSE='<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function esc(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
const $=id=>document.getElementById(id);

let tab="today", viewDay=todayStr(), sheet=null; // sheet = {slot, just:[]}

function render(){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("on", p.id==="p-"+tab));
  document.querySelectorAll(".tabs button").forEach(b=>b.classList.toggle("on", b.dataset.tab===tab));
  $("fab").classList.toggle("on", tab==="set");
  if(tab==="today") renderToday();
  if(tab==="week") renderWeek();
  if(tab==="set") renderSet();
  renderSheet();
  document.querySelector('meta[name=theme-color]').content=getComputedStyle(document.body).backgroundColor;
}

/* ---------- Dag ---------- */
function renderToday(){
  const d=viewDay, t=todayStr(), x=getDay(d), n=itemCount(x), isToday=d===t;
  const yest=getDay(addDays(d,-1)), nowSlot=isToday?slotNow():null;
  const greet = n===0 ? (isToday?"Nog niks genoteerd. <b>Wat at je?</b>":"Niets genoteerd. <b>Nog aanvullen?</b>")
    : mainMealsDone(x)===3 ? "Alle maaltijden staan erin. <b>Goed bezig.</b>"
    : isToday ? "Hou het bij. <b>Elke tik telt.</b>" : "Even aanvullen?";
  const addSlot = nowSlot || (SLOTS.find(s=>!(x.meals[s.id]||[]).length)||SLOTS[3]).id;

  let h=`<div class="stack">
    <section class="tile t-orange">
      <div class="tl"><span>${dayName(d)}</span>
        <span class="daynav"><button class="iconbtn" data-act="day" data-n="-1" aria-label="Vorige dag">${CHEV_L}</button>
        <span>${shortDate(d)}</span>
        <button class="iconbtn" data-act="day" data-n="1" aria-label="Volgende dag"${isToday?" disabled":""}>${CHEV_R}</button></span></div>
      <p class="greet">${greet}</p>
      <div class="bignum">${n}<span class="of">${n===1?"ding":"dingen"}</span></div>
      <div class="bignumcap">genoteerd · ${mainMealsDone(x)} van 3 maaltijden</div>
      <button class="btn primary big addbig" data-act="add" data-slot="${addSlot}">Wat at je?</button>
    </section>`;

  SLOTS.forEach(s=>{
    const items=x.meals[s.id]||[], y=yest.meals[s.id]||[];
    h+=`<section class="tile ${s.tile} meal${s.id===nowSlot?" now":""}">
      <div class="tl"><span>${s.label}${s.id===nowSlot?" · <b>nu</b>":""}</span><span>${items.length||""}</span></div>
      ${items.length?`<div class="items">${items.map((m,i)=>`<button class="item" data-act="del" data-slot="${s.id}" data-i="${i}" aria-label="${esc(m.t)} verwijderen">${nsBadge(m.p)}<span>${esc(m.t)}</span><i>✕</i></button>`).join("")}</div>`
        :`<div class="empty">Nog niets.</div>`}
      <div class="mealbtns">
        <button class="chip add" data-act="add" data-slot="${s.id}">+ Toevoegen</button>
        ${!items.length&&y.length?`<button class="chip" data-act="copy" data-slot="${s.id}">Zelfde als gisteren</button>`:""}
      </div>
    </section>`;
  });

  h+=`<section class="tile t-blue"><div class="tl"><span>Drinken & extra's</span><span>tik + of −</span></div>
    ${COUNTERS.map(c=>{ const v=x.count[c.id]||0; return `<div class="ctr"><div class="cn">${c.label}<small>${c.unit}</small></div>
      <button class="rb" data-act="cnt" data-c="${c.id}" data-n="-1" aria-label="${c.label} min één"${v?"":" disabled"}>−</button>
      <div class="cv">${v}</div>
      <button class="rb plus" data-act="cnt" data-c="${c.id}" data-n="1" aria-label="${c.label} plus één">+</button></div>`; }).join("")}
  </section>`;

  h+=`<section class="tile t-forest"><div class="tl"><span>Hoe at je ${isToday?"vandaag":"die dag"}?</span></div>
    <div class="seg">${FEELS.map(([v,l])=>`<button class="${x.feel===v?"on":""}" data-act="feel" data-v="${v}">${l}</button>`).join("")}</div>
    <div class="lab">Notitie voor de coach (optioneel)</div>
    <textarea class="fld" id="note" placeholder="bv. feestje, veel honger na de rit, weinig tijd…">${esc(x.note||"")}</textarea>
  </section>`;

  h+=`</div>`;
  $("p-today").innerHTML=h;
  const note=$("note"); let nt=null;
  note.addEventListener("input",()=>{ clearTimeout(nt); nt=setTimeout(()=>{ ensureDay(viewDay).note=note.value.trim(); save(); },600); });
  note.addEventListener("blur",()=>{ clearTimeout(nt); ensureDay(viewDay).note=note.value.trim(); save(); });
}

/* ---------- Overzicht ---------- */
function renderWeek(){
  const t=todayStr(), last7=[...Array(7)].map((_,i)=>addDays(t,-i));
  const filled=last7.filter(d=>itemCount(getDay(d))>0);
  const sum=k=>last7.reduce((n,d)=>n+(getDay(d).count[k]||0),0);
  const waterAvg=filled.length?Math.round(sum("water")/filled.length*10)/10:0;
  let h=`<div class="stack">
    <div class="sechead"><h3>Afgelopen week</h3><span>tik een dag om aan te vullen</span></div>
    <div class="stat3">
      <div class="tile stat t-orange"><div class="k">Ingevuld</div><div class="v">${filled.length}<small>/7</small></div></div>
      <div class="tile stat t-mint"><div class="k">Water / dag</div><div class="v">${String(waterAvg).replace(".",",")}</div></div>
      <div class="tile stat t-black"><div class="k">Alcohol</div><div class="v">${sum("alcohol")}</div></div>
    </div>
    <section class="tile">`;
  for(let i=0;i<14;i++){
    const d=addDays(t,-i), x=getDay(d), n=itemCount(x);
    const txt=SLOTS.map(s=>(x.meals[s.id]||[]).map(m=>m.t).join(", ")).filter(Boolean).join(" · ");
    const extra=COUNTERS.filter(c=>x.count[c.id]).map(c=>x.count[c.id]+" "+c.label.toLowerCase().split(" ")[0]).join(", ");
    const feel=FEELS.find(f=>f[0]===x.feel);
    h+=`<button class="dayrow${n?"":" blank"}" data-act="goto" data-d="${d}">
      <div class="dh"><span class="dn">${i<2?dayName(d):shortDate(d)}${feel?`<span class="pill ${feel[0]}">${feel[1]}</span>`:""}</span><span class="dm">${n?n+" "+(n===1?"ding":"dingen"):"leeg"}</span></div>
      ${txt||extra?`<div class="ds">${esc(txt)}${txt&&extra?" · ":""}${esc(extra)}</div>`:""}
    </button>`;
  }
  h+=`</section></div>`;
  $("p-week").innerHTML=h;
}

/* ---------- Instellingen ---------- */
function renderSet(){
  const S=state.settings, sc=syncCfg();
  const syncStatus = !sc.token ? "Nog niet gekoppeld."
    : sc.lastErr ? `⚠ ${esc(sc.lastErr)}`
    : sc.last ? `✓ Gekoppeld · laatste sync ${new Date(sc.last).toLocaleString("nl-BE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}`
    : "Token bewaard · nog niet gesynchroniseerd.";
  const nDays=Object.keys(state.days).length;
  let h=`<div class="stack">
    <section class="tile"><div class="card-h">Weergave</div><p class="card-d">Systeem volgt de instelling van je telefoon.</p>
      <div class="seg">${[["system","Systeem"],["light","Licht"],["dark","Donker"]].map(([v,l])=>`<button class="${S.theme===v?"on":""}" data-act="theme" data-v="${v}">${l}</button>`).join("")}</div></section>
    <section class="tile"><div class="card-h">Koppeling met MCDO PT</div><p class="card-d">Dan kan de coach in MCDO PT je eten van de laatste ${SYNC_DAYS} dagen mee bekijken. Gebruik gerust <b>hetzelfde GitHub-token als in MCDO FIT</b> (Gists: read and write); het blijft enkel op dit toestel.</p>
      <div class="hint" style="margin:0 0 12px">${syncStatus}</div>
      ${sc.token?`<div class="btnrow" style="margin-top:0"><button class="btn primary" data-act="syncnow">Nu synchroniseren</button><button class="btn secondary" data-act="syncoff">Ontkoppel</button></div>`
        :`<input class="fld" id="synctoken" type="password" autocomplete="off" placeholder="github_pat_…"><div class="btnrow"><button class="btn primary" data-act="syncsave">Koppel</button></div>`}
    </section>
    <section class="tile t-yellow"><div class="card-h">Back-up</div><p class="card-d">Je dagboek staat enkel op deze telefoon (${nDays} ${nDays===1?"dag":"dagen"}). Maak af en toe een back-up, zeker vóór je de app ooit van je beginscherm haalt — dat wist alles.</p>
      <div class="btnrow" style="margin-top:0"><button class="btn primary" data-act="export">Bewaar back-up</button><button class="btn secondary" data-act="import">Zet terug</button></div>
    </section>
    <div class="foot">MCDO EET · geen calorieën, gewoon eerlijk bijhouden.<br><button class="danger" data-act="reset">Alles wissen</button></div>
  </div>`;
  $("p-set").innerHTML=h;
}

/* ---------- Toevoegen (overlay) ---------- */
function renderSheet(){
  const host=$("sheet");
  if(!sheet){ host.hidden=true; host.innerHTML=""; document.body.classList.remove("noscroll"); return; }
  const s=SLOTS.find(z=>z.id===sheet.slot);
  host.className="ov "+s.tile;
  host.hidden=false; document.body.classList.add("noscroll");
  host.innerHTML=`<div class="ov-top"><div class="ov-title">${s.label}</div><button class="iconbtn" data-act="sheetclose" aria-label="Sluiten">${CLOSE}</button></div>
    <div class="sheet-in">
      <div class="seg four">${SLOTS.map(z=>`<button class="${z.id===sheet.slot?"on":""}" data-act="sheetslot" data-slot="${z.id}">${z.label}</button>`).join("")}</div>
      <div class="lab">Typ of spreek in</div>
      <form class="addrow" id="addform" autocomplete="off"><input class="fld" id="addtxt" enterkeyhint="done" placeholder="bv. 2 boterhammen met kaas"><button class="btn primary" type="submit">Voeg toe</button></form>
      <button class="btn secondary scanbtn" data-act="scan">▦ Scan barcode van een product</button>
      ${prodCard()}
      <div class="hint">Tip: tik op de 🎤 van je toetsenbord om in te spreken.${viewDay!==todayStr()?` Je vult <b>${esc(dayName(viewDay).toLowerCase())}</b> aan.`:""}</div>
      ${sheet.just.length?`<div class="just">${sheet.just.map(t=>`<span>✓ ${esc(t)}</span>`).join("")}</div>`:""}
      <div class="lab" id="sugglab">Vaak bij ${s.label.toLowerCase()} — tik om toe te voegen</div>
      <div class="sugg" id="sugg"></div>
      <div class="btnrow"><button class="btn secondary big" data-act="sheetclose">Klaar</button></div>
    </div>`;
  fillSugg("");
  const inp=$("addtxt");
  inp.addEventListener("input",()=>fillSugg(inp.value));
  $("addform").addEventListener("submit",e=>{
    e.preventDefault(); const v=inp.value;
    if(addItem(viewDay,sheet.slot,v)){ sheet.just.push(tidy(v)); render(); const n=$("addtxt"); if(n) n.focus(); }
    else inp.value="";
  });
}
function prodCard(){
  const p=sheet.prod; if(!p) return "";
  if(p.busy) return `<div class="prod"><div class="hint" style="margin:0">Product opzoeken…</div></div>`;
  if(p.err) return `<div class="prod"><div class="pn">${esc(p.err)}</div><div class="hint">Niet elk product staat in de databank. Typ het gewoon in.</div><div class="btnrow"><button class="btn secondary" data-act="scan">Opnieuw scannen</button><button class="btn secondary" data-act="prodcancel">Sluit</button></div></div>`;
  const s=SLOTS.find(z=>z.id===sheet.slot);
  return `<div class="prod">
    <div class="ph">${p.ns?nsBadge(p,true):`<b class="ns big ns-x">?</b>`}<div><div class="pn">${esc(prodLabel(p))}</div><div class="pd">${p.b?esc(p.b)+" · ":""}${p.ns?"Nutri-Score "+p.ns.toUpperCase()+" · "+NS_TXT[p.ns]:"Geen Nutri-Score bekend"}</div></div></div>
    <div class="pf">
      <div><span>Bewerking</span><b>${p.nova?NOVA[p.nova]:"—"}</b></div>
      <div><span>Per portie</span><b>${p.kp!=null?p.kp+" kcal":"—"}</b>${p.por?`<small>${esc(p.por)}</small>`:""}</div>
      <div><span>Per 100 g</span><b>${p.k100!=null?p.k100+" kcal":"—"}</b></div>
    </div>
    <div class="btnrow"><button class="btn primary" data-act="prodadd">Voeg toe</button><button class="btn secondary" data-act="prodcancel">Annuleer</button></div>
  </div>`;
}
function fillSugg(q){
  const list=suggestions(sheet.slot,q,viewDay), box=$("sugg"); if(!box) return;
  box.innerHTML=list.map(t=>`<button class="${q?"hit":""}" data-act="pick" data-t="${esc(t)}">${esc(t)}</button>`).join("")
    || `<span class="empty">${q?"Geen suggestie — tik op Voeg toe.":"Nog geen suggesties."}</span>`;
}

/* =====================================================================
   ACTIES
   ===================================================================== */
function isDark(){ const th=state.settings.theme; return th==="dark" || (th==="system" && !(window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches)); }
function applyTheme(){ const th=state.settings.theme; if(th==="system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme=th; }

async function exportBackup(){
  const name="mcdo-eet-backup-"+todayStr()+".json";
  const blob=new Blob([JSON.stringify(state,null,1)],{type:"application/json"});
  try{
    const file=new File([blob],name,{type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"MCDO EET back-up"}); return; }
  }catch(e){ if(e && e.name==="AbortError") return; }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
}
$("importfile").addEventListener("change",async e=>{
  const f=e.target.files[0]; e.target.value=""; if(!f) return;
  try{
    const s=JSON.parse(await f.text());
    if(!s || typeof s.days!=="object") throw new Error("geen MCDO EET-back-up");
    const n=Object.keys(s.days).length;
    if(!confirm("Back-up met "+n+" dagen terugzetten? Wat nu op dit toestel staat, wordt samengevoegd (de back-up wint bij dezelfde dag).")) return;
    Object.assign(state.days,s.days); save(); render(); alert("Teruggezet: "+n+" dagen.");
  }catch(err){ alert("Kon die back-up niet lezen ("+err.message+")."); }
});

const ACT={
  tab:el=>{ tab=el.dataset.tab; if(tab==="today") viewDay=viewDay||todayStr(); render(); window.scrollTo(0,0); },
  themeflip:()=>{ state.settings.theme=isDark()?"light":"dark"; applyTheme(); save(); render(); },
  theme:el=>{ state.settings.theme=el.dataset.v; applyTheme(); save(); render(); },
  day:el=>{ const d=addDays(viewDay,+el.dataset.n); if(d<=todayStr()){ viewDay=d; render(); } },
  goto:el=>{ viewDay=el.dataset.d; tab="today"; render(); window.scrollTo(0,0); },
  add:el=>{ sheet={slot:el.dataset.slot, just:[]}; render(); $("sheet").scrollTop=0; },
  sheetslot:el=>{ sheet.slot=el.dataset.slot; sheet.just=[]; renderSheet(); },
  scan:()=>{ if(sheet) sheet.prod=null; openScanner(); },
  scanclose:()=>closeScanner(),
  prodcancel:()=>{ sheet.prod=null; renderSheet(); },
  prodadd:()=>{ const p=sheet.prod, t=prodLabel(p); if(addItem(viewDay,sheet.slot,t,p)) sheet.just.push(t); sheet.prod=null; render(); },
  sheetclose:()=>{ sheet=null; closeScanner(); render(); },
  pick:el=>{ const t=el.dataset.t; if(addItem(viewDay,sheet.slot,t)){ sheet.just.push(t); render(); } },
  del:el=>{ const x=ensureDay(viewDay), arr=x.meals[el.dataset.slot], i=+el.dataset.i; if(!arr[i]) return; arr.splice(i,1); save(); render(); },
  copy:el=>{ const s=el.dataset.slot; getDay(addDays(viewDay,-1)).meals[s].forEach(m=>addItem(viewDay,s,m.t)); render(); },
  cnt:el=>{ const x=ensureDay(viewDay), k=el.dataset.c; x.count[k]=Math.max(0,(x.count[k]||0)+(+el.dataset.n)); if(!x.count[k]) delete x.count[k]; save(); render(); },
  feel:el=>{ const x=ensureDay(viewDay); x.feel = x.feel===el.dataset.v ? "" : el.dataset.v; save(); render(); },
  syncsave:async()=>{ const v=($("synctoken")||{}).value||""; if(!v.trim()) return; setSyncCfg({token:v.trim()}); render(); await syncNow(); render(); },
  syncnow:async()=>{ await syncNow(); render(); },
  syncoff:()=>{ if(!confirm("Koppeling met MCDO PT verbreken? Je eetdagboek blijft gewoon staan.")) return; setSyncCfg({}); render(); },
  export:()=>exportBackup(),
  import:()=>$("importfile").click(),
  reset:()=>{
    if(!confirm("Echt alles wissen? Maak eerst een back-up als je twijfelt.")) return;
    if(!confirm("Zeker? Dit kan niet ongedaan gemaakt worden.")) return;
    const th=state.settings.theme; state=freshState(); state.settings.theme=th; save(); viewDay=todayStr(); tab="today"; render();
  }
};
document.addEventListener("click",e=>{
  const el=e.target.closest("[data-act]"); if(!el || el.disabled) return;
  const f=ACT[el.dataset.act]; if(f) f(el);
});
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{ applyTheme(); render(); }); }catch(e){}
/* terug naar de app (bv. de volgende ochtend): naar vandaag springen en sync bijwerken */
let lastToday=todayStr();
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState!=="visible") return;
  if(todayStr()!==lastToday){ lastToday=todayStr(); viewDay=lastToday; sheet=null; render(); }
  if(syncCfg().token) syncNow().then(()=>{ if(tab==="set") render(); });
});

load(); applyTheme(); render();
