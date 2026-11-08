/* MCDO EET — koppeling met MCDO PT (zelfde aanpak als MCDO FIT).
   Na elke wijziging schrijft de app de laatste 21 dagen naar een privé-gist op je GitHub.
   MCDO PT op je Mac leest die gist uit, zodat de coach je eten mee kan bekijken.
   Je mag hetzelfde GitHub-token gebruiken als in MCDO FIT (Gists: read and write);
   het blijft enkel op dit toestel (localStorage), apart van je eetdata. */

const SYNC_KEY="mcdoeet:sync";              // {token, gistId, last, lastErr}
const GIST_DESC="mcdo-eet-sync", GIST_FILE="mcdo-eet.json";
const SYNC_DAYS=21;

function syncCfg(){ try{ return JSON.parse(localStorage.getItem(SYNC_KEY)||"{}"); }catch(e){ return {}; } }
function setSyncCfg(c){ try{ localStorage.setItem(SYNC_KEY,JSON.stringify(c)); }catch(e){} }

/* Wat MCDO PT te zien krijgt: per dag de maaltijden als tekst, de tellers, gevoel en notitie. */
function eetSummary(){
  const t=todayStr(), days={};
  for(let i=0;i<SYNC_DAYS;i++){
    const d=addDays(t,-i), x=state.days[d];
    if(!x || isEmptyDay(x)) continue;
    const o={};
    SLOTS.forEach(s=>{ const it=(x.meals[s.id]||[]).map(m=>m.t+prodTag(m.p)); if(it.length) o[s.id]=it; });
    const c={}; COUNTERS.forEach(k=>{ if(x.count[k.id]) c[k.id]=x.count[k.id]; }); if(Object.keys(c).length) o.tellers=c;
    const dr={}; Object.keys(DRINK_TYPES).forEach(k=>{ if(x.count[k]) dr[k]=drinkSummary(x,k); }); if(Object.keys(dr).length) o.dranken=dr;
    if(x.count.alcohol) o.standaardglazen=stdGlasses(x);
    if(x.feel) o.gevoel=x.feel;
    if(x.note) o.notitie=x.note;
    days[d]=o;
  }
  return { v:1, updated:new Date().toISOString(), day:t, units:Object.fromEntries(COUNTERS.map(k=>[k.id,k.unit])), days };
}

let syncTimer=null, syncBusy=false;
/* wordt na elke save() aangeroepen; wacht even zodat snelle wijzigingen samen één sync worden */
function scheduleSync(){
  if(!syncCfg().token) return;
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>{ syncNow(); },2500);
}
async function syncNow(){
  const c=syncCfg();
  if(!c.token) return {ok:false,error:"Geen token"};
  if(syncBusy) return {ok:false,error:"Bezig"};
  syncBusy=true;
  const h={Authorization:"Bearer "+c.token, Accept:"application/vnd.github+json", "Content-Type":"application/json"};
  const body={description:GIST_DESC, files:{[GIST_FILE]:{content:JSON.stringify(eetSummary(),null,1)}}};
  try{
    let id=c.gistId;
    if(!id){ // bestaande gist opzoeken (bv. na opnieuw installeren), anders straks nieuw maken
      const r=await fetch("https://api.github.com/gists?per_page=100",{headers:h});
      if(r.status===401) throw new Error("Token ongeldig of verlopen");
      if(!r.ok) throw new Error("GitHub antwoordde "+r.status);
      const g=(await r.json()).find(x=>x.description===GIST_DESC);
      if(g) id=g.id;
    }
    let r=id ? await fetch("https://api.github.com/gists/"+id,{method:"PATCH",headers:h,body:JSON.stringify(body)}) : null;
    if(!r || r.status===404) r=await fetch("https://api.github.com/gists",{method:"POST",headers:h,body:JSON.stringify(Object.assign({public:false},body))});
    if(r.status===401) throw new Error("Token ongeldig of verlopen");
    if(r.status===403) throw new Error("Token mag geen gists schrijven");
    if(!r.ok) throw new Error("GitHub antwoordde "+r.status);
    const g=await r.json();
    setSyncCfg(Object.assign(syncCfg(),{gistId:g.id,last:new Date().toISOString(),lastErr:null}));
    return {ok:true};
  }catch(e){
    const msg=e.message==="Failed to fetch"?"Geen verbinding":e.message;
    setSyncCfg(Object.assign(syncCfg(),{lastErr:msg}));
    return {ok:false,error:msg};
  }finally{ syncBusy=false; }
}
