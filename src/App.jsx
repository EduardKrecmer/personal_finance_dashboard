import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import {
  Wallet, TrendingUp, Building2, CreditCard, Plus, Trash2, X, Target,
  Settings, Flag, ArrowUp, ArrowDown, FileText, Save, Check, RotateCcw,
  Printer, Moon, Sun, Download, Upload, BarChart3, PieChart, Calendar,
  Clock, Edit, Box, ChevronRight, GripVertical, Coins, Repeat, Bell,
  AlertTriangle, TrendingDown, LogOut, Mail, Lock, Eye, EyeOff, Loader2, Camera, Image, MessageSquare, ArrowUpDown, ArrowLeftRight
} from "lucide-react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toPng, toCanvas } from "html-to-image";
import { jsPDF } from "jspdf";

const LOGIN_QUOTES = [
  {text:"Wealth is the ability to fully experience life.", author:"Henry David Thoreau"},
  {text:"Seek wealth, not money or status.", author:"Naval Ravikant"},
  {text:"Someone is sitting in the shade today because someone planted a tree a long time ago.", author:"Warren Buffett"},
  {text:"Wealth is the ability to live life on your own terms.", author:"James Clear"},
];
const pickQuote = () => {
  let last = -1;
  try { last = parseInt(localStorage.getItem("fidu_lastQuote") || "-1", 10); } catch {}
  const pool = LOGIN_QUOTES.map((q, i) => i).filter(i => i !== last);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  try { localStorage.setItem("fidu_lastQuote", String(idx)); } catch {}
  return LOGIN_QUOTES[idx];
};
const fmt = (v) => new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(v);
const fmtFull = (v) => new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR"}).format(v);
const fmtC = (v) => new Intl.NumberFormat("sk-SK",{notation:"compact",compactDisplay:"short",maximumFractionDigits:1}).format(v);

const STORAGE_KEYS = {
  accounts: "fidu_accounts",
  expenses: "fidu_expenses",
  settings: "fidu_settings",
  history: "fidu_history",
  notes: "fidu_notes",
  dark: "fidu_dark",
  portfolio: "fidu_portfolio",
  cashflow: "fidu_cashflow",
  alerts: "fidu_alerts",
  stockPortfolio: "fidu_stockPortfolio",
};

/* CoinMarketCap name → CoinGecko ID mapping */
const NAME_TO_CG = {
  "bitcoin":"bitcoin","ethereum":"ethereum","solana":"solana","bnb":"binancecoin",
  "xrp":"ripple","cardano":"cardano","dogecoin":"dogecoin","polkadot":"polkadot",
  "chainlink":"chainlink","avalanche":"avalanche-2","polygon":"matic-network",
  "litecoin":"litecoin","uniswap":"uniswap","tron":"tron","zcash":"zcash",
  "woo":"woo-network","curve dao token":"curve-dao-token","shiba inu":"shiba-inu",
  "stellar":"stellar","cosmos":"cosmos","near protocol":"near","aptos":"aptos",
  "sui":"sui","toncoin":"the-open-network","pepe":"pepe","arbitrum":"arbitrum",
  "optimism":"optimism","fantom":"fantom","aave":"aave","maker":"maker",
  "render token":"render-token","injective":"injective-protocol","fetch.ai":"fetch-ai",
};

/* Ikony a farby pre kryptomeny */
const COIN_STYLE = {
  "bitcoin":      { abbr:"BTC", bg:"#f7931a", text:"#fff" },
  "ethereum":     { abbr:"ETH", bg:"#627eea", text:"#fff" },
  "solana":       { abbr:"SOL", bg:"#9945ff", text:"#fff" },
  "binancecoin":  { abbr:"BNB", bg:"#f3ba2f", text:"#1a1a2e" },
  "ripple":       { abbr:"XRP", bg:"#0085c0", text:"#fff" },
  "cardano":      { abbr:"ADA", bg:"#0033ad", text:"#fff" },
  "dogecoin":     { abbr:"DOGE",bg:"#c3a634", text:"#fff" },
  "polkadot":     { abbr:"DOT", bg:"#e6007a", text:"#fff" },
  "chainlink":    { abbr:"LINK",bg:"#2a5ada", text:"#fff" },
  "avalanche-2":  { abbr:"AVAX",bg:"#e84142", text:"#fff" },
  "matic-network":{ abbr:"POL", bg:"#8247e5", text:"#fff" },
  "litecoin":     { abbr:"LTC", bg:"#345d9d", text:"#fff" },
  "uniswap":      { abbr:"UNI", bg:"#ff007a", text:"#fff" },
  "tron":         { abbr:"TRX", bg:"#ef0027", text:"#fff" },
  "zcash":        { abbr:"ZEC", bg:"#ecb244", text:"#1a1a2e" },
  "woo-network":  { abbr:"WOO", bg:"#1f4d46", text:"#00d1a4" },
  "curve-dao-token":{abbr:"CRV",bg:"#0000ff", text:"#fff" },
  "shiba-inu":    { abbr:"SHIB",bg:"#ffa409", text:"#fff" },
  "stellar":      { abbr:"XLM", bg:"#14b6e7", text:"#fff" },
  "cosmos":       { abbr:"ATOM",bg:"#2e3148", text:"#a5a8c8" },
  "near":         { abbr:"NEAR",bg:"#000", text:"#fff" },
  "aptos":        { abbr:"APT", bg:"#2ed8a3", text:"#1a1a2e" },
  "sui":          { abbr:"SUI", bg:"#4da2ff", text:"#fff" },
  "the-open-network":{abbr:"TON",bg:"#0098ea",text:"#fff" },
  "pepe":         { abbr:"PEPE",bg:"#3d8c40", text:"#fff" },
  "arbitrum":     { abbr:"ARB", bg:"#213147", text:"#12aaff" },
  "optimism":     { abbr:"OP",  bg:"#ff0420", text:"#fff" },
  "aave":         { abbr:"AAVE",bg:"#b6509e", text:"#fff" },
  "maker":        { abbr:"MKR", bg:"#1aab9b", text:"#fff" },
};
const getCoinStyle = (cgId, name) => COIN_STYLE[cgId] || { abbr: name.slice(0, 3).toUpperCase(), bg: "#64748b", text: "#fff" };

const DEFAULT_ACCOUNTS = [
  {id:"1",name:"Bežný účet",balance:2400,type:"CASH",category:"LIQUID",transactions:[]},
  {id:"2",name:"ETF Portfólio",balance:12500,type:"STOCK",category:"LIQUID",transactions:[]},
  {id:"3",name:"Byt Ružinov",balance:210000,type:"REAL_ESTATE",category:"ILLIQUID",transactions:[]}
];
const DEFAULT_EXPENSES = [{id:"e1",name:"Rekonštrukcia",amount:5000,category:"HOUSING"}];
const DEFAULT_SETTINGS = {financialGoal:500000,monthlyBurn:2000,showCrypto:true,showStocks:false,hiddenAccCats:[],hiddenAccTypes:[],hiddenExpCats:[],hiddenCfCats:[],cryptoCostBasis:0};

const TYPE_LABELS = {
  CASH:"Hotovosť", CHECKING:"Bežný účet", SAVINGS:"Sporiaci účet",
  STOCK:"Akcie / ETF", FIREFISH:"Firefish", CRYPTO:"Kryptomeny",
  REAL_ESTATE:"Nehnuteľnosti", RECEIVABLE:"Pohľadávky", OTHER_ASSET:"Iné aktíva"
};
const BUILTIN_TYPES = Object.keys(TYPE_LABELS);
const CATEGORY_LABELS = {LIQUID:"Likvidné aktíva",INVESTMENT:"Investície",RECEIVABLE:"Pohľadávky",DEBT:"Dlhy",ILLIQUID:"Nelikvidné aktíva"};
const CAT_STYLE = {
  LIQUID:     {color:"#3b82f6",bg:"bg-blue-50",    border:"border-blue-200",   text:"text-blue-700",    badge:"bg-blue-100 text-blue-700",     icon:"bg-blue-500"},
  INVESTMENT: {color:"#10b981",bg:"bg-emerald-50", border:"border-emerald-200",text:"text-emerald-700", badge:"bg-emerald-100 text-emerald-700",icon:"bg-emerald-500"},
  RECEIVABLE: {color:"#06b6d4",bg:"bg-cyan-50",    border:"border-cyan-200",   text:"text-cyan-700",    badge:"bg-cyan-100 text-cyan-700",     icon:"bg-cyan-500"},
  DEBT:       {color:"#ef4444",bg:"bg-rose-50",    border:"border-rose-200",   text:"text-rose-700",    badge:"bg-rose-100 text-rose-700",     icon:"bg-rose-500"},
  ILLIQUID:   {color:"#6366f1",bg:"bg-indigo-50",  border:"border-indigo-200", text:"text-indigo-700",  badge:"bg-indigo-100 text-indigo-700", icon:"bg-indigo-500"},
};
const EXP_CATEGORIES = {
  HOUSING:"Bývanie",FOOD:"Strava",TRANSPORT:"Doprava",
  UTILITIES:"Energie",ENTERTAINMENT:"Zábava",HEALTH:"Zdravie",OTHER:"Ostatné"
};
const CF_CATEGORIES = {
  SALARY:"Plat",BUSINESS:"Podnikanie",RENTAL:"Prenájom",DIVIDENDS:"Dividendy",
  RENT:"Nájomné",INSURANCE:"Poistenie",SUBSCRIPTION:"Predplatné",
  LOAN:"Splátka",UTILITIES_CF:"Energie",FOOD:"Strava",TRANSPORT:"Doprava",HEALTH:"Zdravie",EDUCATION:"Vzdelávanie",OTHER_CF:"Ostatné"
};
const CF_INCOME_CATS = ["SALARY","BUSINESS","RENTAL","DIVIDENDS","OTHER_CF"];
const CF_EXPENSE_CATS = ["RENT","INSURANCE","SUBSCRIPTION","LOAN","UTILITIES_CF","FOOD","TRANSPORT","HEALTH","EDUCATION","OTHER_CF"];
const ALERT_METRICS = {
  NW:"Čisté imanie",ASSETS:"Celkové aktíva",RUNWAY:"Runway (mesiace)",BTC:"Cena BTC (€)"
};
const BUILTIN_CATS = ["LIQUID","INVESTMENT","RECEIVABLE","ILLIQUID"];
const BUILTIN_EXP_CATS = Object.keys(EXP_CATEGORIES);

function usePersistedState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch {}
    return initial;
  });
  const setter = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, setter, true];
}

const Toast = memo(({message, type="success", onClose}) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-20 right-4 z-[100] px-5 py-3 rounded-xl shadow-2xl border flex items-center gap-2 text-sm font-semibold transition-all ${type==="success"?"bg-emerald-50 border-emerald-200 text-emerald-800":"bg-rose-50 border-rose-200 text-rose-800"}`}>
      <Check size={16}/>{message}
    </div>
  );
});

/* ── SelectWithDelete — custom dropdown s ikonkou koša pri každej možnosti ── */
const SelectWithDelete = ({value, onChange, options, onDelete, dark, className, addLabel, addValue="__CUSTOM__"}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if(!open) return;
    const h = (e) => { if(ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const selected = options.find(o=>o.value===value);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={()=>setOpen(!open)}
        className={`${className} flex items-center justify-between text-left`}>
        <span className="truncate">{selected?.label || value}</span>
        <ChevronRight size={14} className={`shrink-0 ml-2 transition-transform ${open?"rotate-90":""}`}/>
      </button>
      {open&&(
        <div className={`absolute z-[60] mt-1 w-full rounded-xl border shadow-xl max-h-52 overflow-y-auto ${dark?"bg-slate-700 border-slate-600":"bg-white border-slate-200"}`}>
          {options.map(opt=>(
            <div key={opt.value} className={`flex items-center group px-3 py-2 text-sm ${value===opt.value?(dark?"bg-slate-600 font-semibold":"bg-emerald-50 font-semibold"):""} ${dark?"hover:bg-slate-600 text-slate-200":"hover:bg-slate-50 text-slate-700"}`}>
              <span className="flex-1 cursor-pointer truncate" onClick={()=>{onChange(opt.value);setOpen(false);}}>{opt.label}</span>
              {options.length>1&&(<button onClick={(e)=>{e.stopPropagation();onDelete(opt.value);}}
                className={`p-1 rounded shrink-0 opacity-40 hover:opacity-100 transition-opacity ${dark?"text-rose-400 hover:bg-rose-500/20":"text-rose-500 hover:bg-rose-50"}`}
                title="Odstrániť zo zoznamu">
                <Trash2 size={13}/>
              </button>)}
            </div>
          ))}
          {addLabel&&(
            <div className={`px-3 py-2 text-sm font-medium cursor-pointer border-t ${dark?"border-slate-600 text-violet-400 hover:bg-violet-500/10":"border-slate-100 text-violet-600 hover:bg-violet-50"}`}
              onClick={()=>{onChange(addValue);setOpen(false);}}>
              {addLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AreaChart = memo(({data, dark: dk, onCompare, compareDate}) => {
  const [hover, setHover] = useState(null);
  const [range, setRange] = useState("ALL");
  const [animKey, setAnimKey] = useState(0);
  const [compareIdx, setCompareIdx] = useState(null);
  const [compareMenu, setCompareMenu] = useState(false);
  const ref = useRef(null);

  /* ── Časový filter ── */
  const filtered = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (range === "ALL") return data;
    const now = new Date();
    const days = {"7D":7,"1M":30,"3M":90,"6M":180,"1Y":365}[range] || Infinity;
    const cut = new Date(now); cut.setDate(cut.getDate() - days);
    const r = data.filter(d => new Date(d.date) >= cut);
    return r.length >= 1 ? r : data;
  }, [data, range]);

  useEffect(() => { setAnimKey(k => k + 1); }, [range]);

  /* ── Sync compareIdx s compareDate z vonku ── */
  useEffect(() => {
    if (!compareDate || !filtered.length) { setCompareIdx(null); return; }
    const idx = filtered.findIndex(d => d.date === compareDate);
    setCompareIdx(idx >= 0 ? idx : null);
  }, [compareDate, filtered]);

  /* ── Prázdny / 1 záznam ── */
  if (!data || data.length === 0) return (
    <div className={`h-56 w-full flex flex-col items-center justify-center rounded-xl border border-dashed ${dk?"border-slate-600 text-slate-500 bg-slate-700/30":"border-slate-200 text-slate-400 bg-slate-50/50"}`}>
      <BarChart3 size={28} className="mb-2 opacity-40"/>
      <span className="text-xs font-medium">Uložte denný záznam pre zobrazenie grafu</span>
    </div>
  );

  if (filtered.length === 1) {
    const d = filtered[0];
    return (
      <div>
        <div className={`h-48 w-full flex flex-col items-center justify-center rounded-xl border ${dk?"border-slate-600 bg-slate-700/30":"border-slate-100 bg-gradient-to-b from-emerald-50/50 to-white"}`}>
          <span className={`text-[10px] font-bold uppercase tracking-wider ${dk?"text-slate-400":"text-slate-500"} mb-1`}>Počiatočná hodnota</span>
          <span className={`text-3xl font-extrabold tabular-nums ${dk?"text-white":"text-slate-800"}`}>{fmtFull(d.value)}</span>
          <span className="text-[10px] text-slate-400 mt-1">{new Date(d.date).toLocaleDateString("sk-SK",{day:"numeric",month:"long",year:"numeric"})}</span>
          <span className={`text-[10px] mt-3 px-3 py-1 rounded-full ${dk?"bg-slate-600 text-slate-300":"bg-slate-100 text-slate-500"}`}>Graf sa zobrazí po 2+ záznamoch</span>
        </div>
      </div>
    );
  }

  /* ── Výpočty ── */
  const vals = filtered.map(d => d.value);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const avg = vals.reduce((a, v) => a + v, 0) / vals.length;
  const mnI = vals.indexOf(mn), mxI = vals.indexOf(mx);
  const pad = (mx - mn) * 0.18 || mx * 0.05 || 1;
  const cMin = mn - pad, cMax = mx + pad, rng = cMax - cMin || 1;
  const gX = i => (i / (filtered.length - 1)) * 100;
  const gY = v => 100 - ((v - cMin) / rng) * 100;

  /* ── Farba podľa trendu ── */
  const refIdx = compareIdx != null ? compareIdx : 0;
  const refVal = filtered[refIdx].value;
  const f0 = filtered[0].value, fN = filtered[filtered.length - 1].value;
  const up = fN >= refVal;
  const clr = up ? "#10b981" : "#ef4444";
  const totalDiff = fN - refVal;
  const totalPct = refVal ? (totalDiff / refVal) * 100 : 0;

  /* ── Plynulá Bézier krivka (Catmull-Rom) ── */
  const pts = filtered.map((d, i) => ({x: gX(i), y: gY(d.value)}));
  const T = 0.25;
  let linePath = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[i + 1], d2 = pts[Math.min(pts.length - 1, i + 2)];
    linePath += ` C${b.x+(c.x-a.x)*T},${b.y+(c.y-a.y)*T} ${c.x-(d2.x-b.x)*T},${c.y-(d2.y-b.y)*T} ${c.x},${c.y}`;
  }
  const areaPath = linePath + ` L100,100 L0,100 Z`;

  /* ── Y os (5 úrovní) + X os ── */
  const yL = Array.from({length: 5}, (_, i) => ({pos: (i / 4) * 100, val: cMin + (rng * (4 - i)) / 4}));
  const xC = Math.min(6, filtered.length);
  const xL = Array.from({length: xC}, (_, i) => {
    const idx = Math.round((i / (xC - 1)) * (filtered.length - 1));
    const d = filtered[idx];
    const isLast = i === xC - 1;
    return {label: isLast ? "Dnes" : new Date(d.date).toLocaleDateString("sk-SK",{day:"numeric",month:"short"}), pos: gX(idx)};
  });

  /* ── Helper: zisti index z mouse/touch pozície ── */
  const idxFromEvent = e => {
    if (!ref.current) return -1;
    const rect = ref.current.getBoundingClientRect();
    const cL = 48, cW = rect.width - cL;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const rx = clientX - rect.left - cL;
    if (rx < 0 || rx > cW) return -1;
    return Math.min(Math.max(Math.round((rx / cW) * (filtered.length - 1)), 0), filtered.length - 1);
  };

  /* ── Hover handler ── */
  const onMove = e => {
    const idx = idxFromEvent(e);
    if (idx < 0) { setHover(null); return; }
    const d = filtered[idx];
    const base = filtered[refIdx];
    const hDiff = d.value - base.value, hPct = base.value ? (hDiff / base.value) * 100 : 0;
    setHover({...d, idx, xPos: gX(idx), yPos: gY(d.value), diff: hDiff, pct: hPct});
  };

  /* ── Click = vyber compare bod ── */
  const onClick = e => {
    const idx = idxFromEvent(e);
    if (idx < 0) return;
    const newIdx = idx === compareIdx ? null : idx;
    setCompareIdx(newIdx);
    if (onCompare) onCompare(newIdx != null ? filtered[newIdx].date : null);
  };

  /* ── Touch handlery ── */
  const onTouchMove = e => { e.preventDefault(); onMove(e); };
  const onTouchEnd = () => setHover(null);

  /* ── Compare dropdown: predefinované obdobia ── */
  const setCompareByDays = (days) => {
    const target = new Date(); target.setDate(target.getDate() - days);
    let bestIdx = 0, bestDist = Infinity;
    filtered.forEach((d, i) => {
      const dist = Math.abs(new Date(d.date) - target);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    setCompareIdx(bestIdx);
    if (onCompare) onCompare(filtered[bestIdx].date);
    setCompareMenu(false);
  };
  const clearCompare = () => {
    setCompareIdx(null);
    if (onCompare) onCompare(null);
    setCompareMenu(false);
  };

  const gid = `ag${animKey}`;
  const cmpGid = `cg${animKey}`;
  const ranges = [{k:"7D",l:"7D"},{k:"1M",l:"1M"},{k:"3M",l:"3M"},{k:"6M",l:"6M"},{k:"1Y",l:"1R"},{k:"ALL",l:"Všetko"}];
  const cmpLabel = compareIdx != null ? new Date(filtered[compareIdx].date).toLocaleDateString("sk-SK",{day:"numeric",month:"short"}) : null;

  return (
    <div>
      {/* ── Filtre + Sumár ── */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-0.5 rounded-lg p-0.5 ${dk?"bg-slate-700":"bg-slate-100"}`}>
            {ranges.map(r => (
              <button key={r.k} onClick={() => setRange(r.k)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  range === r.k
                    ? (dk?"bg-slate-600 text-white shadow-sm":"bg-white text-slate-800 shadow-sm")
                    : (dk?"text-slate-400 hover:text-white":"text-slate-500 hover:text-slate-700")
                }`}>
                {r.l}
              </button>
            ))}
          </div>
          {/* Compare dropdown */}
          <div className="relative">
            <button onClick={() => setCompareMenu(!compareMenu)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                compareIdx != null
                  ? (dk?"bg-emerald-900/50 text-emerald-400 border border-emerald-700":"bg-emerald-50 text-emerald-700 border border-emerald-200")
                  : (dk?"bg-slate-700 text-slate-400 hover:text-white":"bg-slate-100 text-slate-500 hover:text-slate-700")
              }`}>
              <ArrowLeftRight size={11}/>
              {compareIdx != null ? `vs ${cmpLabel}` : "Porovnať"}
            </button>
            {compareMenu && (
              <div className={`absolute top-full left-0 mt-1 z-30 rounded-lg shadow-xl border py-1 min-w-[160px] ${dk?"bg-slate-800 border-slate-700":"bg-white border-slate-200"}`}>
                {[{l:"Pred 7 dňami",d:7},{l:"Pred 30 dňami",d:30},{l:"Pred 90 dňami",d:90},{l:"Pred rokom",d:365},{l:"Prvý záznam",d:99999}].map(o=>(
                  <button key={o.d} onClick={()=>setCompareByDays(o.d)} className={`w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors ${dk?"text-slate-300 hover:bg-slate-700":"text-slate-600 hover:bg-slate-50"}`}>{o.l}</button>
                ))}
                {compareIdx != null && <>
                  <div className={`my-1 border-t ${dk?"border-slate-700":"border-slate-100"}`}/>
                  <button onClick={clearCompare} className="w-full text-left px-3 py-1.5 text-[11px] font-medium text-rose-500 hover:bg-rose-50/10">Zrušiť porovnanie</button>
                </>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${dk?"bg-slate-700 text-slate-300":"bg-slate-100 text-slate-600"}`}>
            <span className="opacity-60">{filtered.length} zázn.</span>
          </div>
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${up ? (dk?"bg-emerald-900/40 text-emerald-400":"bg-emerald-50 text-emerald-700") : (dk?"bg-rose-900/40 text-rose-400":"bg-rose-50 text-rose-700")}`}>
            {up ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
            {totalDiff >= 0 ? "+" : ""}{fmtFull(totalDiff)}
            <span className="opacity-60">({totalPct >= 0 ? "+" : ""}{totalPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* ── Graf ── */}
      <div className="w-full h-56 relative group select-none cursor-crosshair" ref={ref}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick}
        onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

        {/* Y os */}
        <div className={`absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] font-medium pointer-events-none py-1 w-12 pr-2 text-right ${dk?"text-slate-500":"text-slate-400"}`}>
          {yL.map((y, i) => <span key={i}>{fmtC(y.val)}</span>)}
        </div>

        {/* Animovaný wrapper (SVG + labely) */}
        <div className="absolute top-0 h-full chart-reveal" key={animKey} style={{left: "3rem", width: "calc(100% - 3rem)"}}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={clr} stopOpacity="0.25"/>
                <stop offset="60%" stopColor={clr} stopOpacity="0.08"/>
                <stop offset="100%" stopColor={clr} stopOpacity="0.01"/>
              </linearGradient>
              {compareIdx != null && (
                <linearGradient id={cmpGid} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02"/>
                </linearGradient>
              )}
            </defs>

            {/* Mriežka */}
            {yL.map((y, i) => <line key={i} x1="0" y1={y.pos} x2="100" y2={y.pos} stroke={dk?"#334155":"#e2e8f0"} strokeWidth="0.5" vectorEffect="non-scaling-stroke"/>)}

            {/* Priemer — čiarkovaná čiara */}
            <line x1="0" y1={gY(avg)} x2="100" y2={gY(avg)} stroke={dk?"#64748b":"#94a3b8"} strokeWidth="1" strokeDasharray="6 4" vectorEffect="non-scaling-stroke" opacity="0.4"/>

            {/* Compare referenčná čiara */}
            {compareIdx != null && (
              <line x1="0" y1={gY(refVal)} x2="100" y2={gY(refVal)} stroke="#8b5cf6" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" opacity="0.5"/>
            )}

            {/* Plocha */}
            <path d={areaPath} fill={`url(#${gid})`}/>

            {/* Plynulá Bézier krivka */}
            <path d={linePath} fill="none" stroke={clr} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/>

            {/* Bodky na dátových bodoch (ak < 15) */}
            {filtered.length <= 14 && pts.map((p,i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2" fill={clr} stroke={dk?"#1e293b":"white"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" opacity="0.7"/>
            ))}

            {/* Min / Max body */}
            {mnI !== mxI && <>
              <circle cx={gX(mnI)} cy={gY(mn)} r="4" fill={dk?"#1e293b":"white"} stroke="#ef4444" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
              <circle cx={gX(mxI)} cy={gY(mx)} r="4" fill={dk?"#1e293b":"white"} stroke="#10b981" strokeWidth="2" vectorEffect="non-scaling-stroke"/>
            </>}

            {/* Počiatočný + koncový bod */}
            <circle cx={gX(0)} cy={gY(f0)} r="3" fill={dk?"#1e293b":"white"} stroke={clr} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
            <circle cx={gX(filtered.length-1)} cy={gY(fN)} r="4" fill={clr} stroke={dk?"#1e293b":"white"} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>

            {/* ── Compare pin ── */}
            {compareIdx != null && (
              <>
                <line x1={gX(compareIdx)} y1="0" x2={gX(compareIdx)} y2="100" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4 2" vectorEffect="non-scaling-stroke" opacity="0.7"/>
                <circle cx={gX(compareIdx)} cy={gY(refVal)} r="6" fill="#8b5cf6" stroke={dk?"#1e293b":"white"} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
                <circle cx={gX(compareIdx)} cy={gY(refVal)} r="2.5" fill="white" vectorEffect="non-scaling-stroke"/>
              </>
            )}

            {/* Hover kurzor */}
            {hover && <>
              <line x1={hover.xPos} y1="0" x2={hover.xPos} y2="100" stroke={dk?"#64748b":"#94a3b8"} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.6"/>
              <circle cx={hover.xPos} cy={hover.yPos} r="5.5" fill={clr} stroke={dk?"#1e293b":"white"} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
            </>}
          </svg>

          {/* Min / Max / Priemer labely */}
          <div className="absolute inset-0 pointer-events-none">
            {mnI !== mxI && <>
              <div className="absolute text-[11px] font-bold text-rose-500 chart-label-fade" style={{left: `${gX(mnI)}%`, top: `${gY(mn)}%`, transform: `translate(-50%, ${gY(mn) > 80 ? "-18px" : "8px"})`}}>
                {fmtC(mn)}
              </div>
              <div className="absolute text-[11px] font-bold text-emerald-600 chart-label-fade" style={{left: `${gX(mxI)}%`, top: `${gY(mx)}%`, transform: `translate(-50%, ${gY(mx) < 20 ? "8px" : "-18px"})`}}>
                {fmtC(mx)}
              </div>
            </>}
            <div className={`absolute text-[11px] font-medium chart-label-fade ${dk?"text-slate-500":"text-slate-400"}`} style={{right: "4px", top: `${gY(avg)}%`, transform: "translateY(-50%)"}}>
              ø {fmtC(avg)}
            </div>
            {/* Compare pin label */}
            {compareIdx != null && (
              <div className="absolute text-[10px] font-bold text-purple-500 chart-label-fade" style={{left: `${gX(compareIdx)}%`, top: `${gY(refVal)}%`, transform: `translate(-50%, ${gY(refVal) < 30 ? "12px" : "-20px"})`}}>
                {fmtC(refVal)}
              </div>
            )}
            {/* Koncová hodnota label */}
            <div className="absolute text-[11px] font-bold chart-label-fade" style={{color: clr, right: "-2px", top: `${gY(fN)}%`, transform: "translate(0, -50%)"}}>
              {fmtC(fN)}
            </div>
          </div>
        </div>

        {/* Tooltip */}
        {hover && (
          <div className="absolute top-0 h-full pointer-events-none z-20" style={{left: "3rem", width: "calc(100% - 3rem)"}}>
            <div className="absolute bg-slate-800/95 backdrop-blur-sm text-white text-xs rounded-xl px-3.5 py-2.5 shadow-2xl border border-slate-700/50"
              style={{
                left: `${hover.xPos}%`, top: `${hover.yPos}%`,
                transform: `translate(${hover.xPos > 70 ? "-105%" : hover.xPos < 25 ? "5%" : "-50%"}, -140%)`,
                whiteSpace: "nowrap"
              }}>
              <div className="font-extrabold text-sm tabular-nums" style={{color: clr}}>{fmtFull(hover.value)}</div>
              <div className="text-slate-400 text-[10px] font-semibold tracking-wider mt-0.5">
                {new Date(hover.date).toLocaleDateString("sk-SK",{day:"numeric",month:"long",year:"numeric"})}
              </div>
              {hover.assets != null && (
                <div className="flex gap-3 mt-1.5 pt-1.5 border-t border-slate-700/50 text-[11px]">
                  <span className="text-blue-400">A: {fmtC(hover.assets)}</span>
                  <span className="text-rose-400">P: -{fmtC((hover.liab||0)+(hover.totalExp||0))}</span>
                  <span className="text-cyan-400">L: {fmtC(hover.liquid||0)}</span>
                </div>
              )}
              <div className={`text-[10px] font-bold mt-1 pt-1 border-t border-slate-700/50 flex items-center gap-1 ${hover.diff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {hover.diff >= 0 ? <ArrowUp size={10}/> : <ArrowDown size={10}/>}
                {hover.diff >= 0 ? "+" : ""}{fmtFull(hover.diff)}
                <span className="opacity-60">({hover.pct >= 0 ? "+" : ""}{hover.pct.toFixed(1)}%)</span>
              </div>
              {compareIdx != null && (
                <div className="text-[9px] text-purple-400 mt-0.5">vs {new Date(filtered[compareIdx].date).toLocaleDateString("sk-SK",{day:"numeric",month:"short"})}</div>
              )}
            </div>
          </div>
        )}

        {/* X os */}
        <div className={`absolute bottom-0 pointer-events-none ${dk?"text-slate-500":"text-slate-400"}`} style={{left: "3rem", width: "calc(100% - 3rem)"}}>
          {xL.map((x, i) => (
            <span key={i} className="absolute text-[10px] font-medium" style={{left: `${x.pos}%`, transform: "translateX(-50%)"}}>{x.label}</span>
          ))}
        </div>
      </div>

      {/* ── Hint ── */}
      <div className={`text-center mt-1 text-[10px] ${dk?"text-slate-600":"text-slate-300"}`}>
        Klikni na graf pre výber referenčného bodu porovnania
      </div>
    </div>
  );
});

const Donut = memo(({data, total, dark: dk}) => {
  const sz=200, r=80, circ=2*Math.PI*r;
  if(total<=0) return <div className={`h-[200px] w-[200px] flex items-center justify-center text-xs rounded-full border ${dk?"bg-slate-700/30 border-slate-600 text-slate-500":"bg-slate-50 border-slate-100 text-slate-400"}`}>Žiadne dáta</div>;
  let acc=0;
  return (
    <div className="relative flex items-center justify-center" style={{width:sz,height:sz}}>
      <svg width={sz} height={sz} className="-rotate-90"><defs><filter id="ds"><feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1"/></filter></defs>
        {data.map((it,i)=>{const pct=it.value/total,da=pct*circ,off=acc;acc+=da;return <circle key={i} cx={sz/2} cy={sz/2} r={r} fill="none" stroke={it.color} strokeWidth="20" strokeDasharray={`${da} ${circ-da}`} strokeDashoffset={-off} filter="url(#ds)" className="transition-all duration-500 hover:opacity-80"/>;})}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aktíva</span>
        <span className={`text-xl font-bold ${dk?"text-white":"text-slate-800"}`}>{new Intl.NumberFormat("sk-SK",{style:"currency",currency:"EUR",notation:"compact"}).format(total)}</span>
      </div>
    </div>
  );
});

const ChangeBadge = memo(({current, previous, label, secondary}) => {
  if(previous==null) return null;
  const diff=current-previous, abs=Math.abs(diff), pos=diff>=0;
  const pct=previous!==0?(diff/previous)*100:0;
  if(label&&label.startsWith("Od")&&diff===0) return (
    <div className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border bg-slate-50 text-slate-500 border-slate-100 ${secondary?"mt-1":""}`}>
      <span className="mr-1">{label}</span> Bez zmeny
    </div>
  );
  return (
    <div className={`inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full border ${pos?"bg-emerald-50 text-emerald-700 border-emerald-100":"bg-rose-50 text-rose-700 border-rose-100"} ${secondary?"mt-1":""}`}>
      {pos?<ArrowUp size={12}/>:<ArrowDown size={12}/>}
      <span className="ml-1">{fmt(abs)}</span>
      <span className="ml-1 opacity-80">({Math.abs(pct).toFixed(1)}%)</span>
      {label&&<span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-60">{label}</span>}
    </div>
  );
});

const Transactions = ({accountId, transactions, onAdd, onDelete, dark: dk}) => {
  const [adding, setAdding] = useState(false);
  const [tx, setTx] = useState({amount:"",description:"",date:new Date().toISOString().split("T")[0]});
  const add = () => {
    if(!tx.amount||!tx.description) return;
    onAdd(accountId,{...tx,amount:Number(tx.amount),id:Date.now().toString()});
    setTx({amount:"",description:"",date:new Date().toISOString().split("T")[0]});
    setAdding(false);
  };
  return (
    <div className={`mt-4 border-t pt-4 ${dk?"border-slate-700":"border-slate-100"}`}>
      <div className="flex justify-between items-center mb-3">
        <h5 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${dk?"text-slate-400":"text-slate-500"}`}><Clock size={14}/> Transakcie</h5>
        <button onClick={()=>setAdding(!adding)} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">{adding?"Zrušiť":"+ Pridať"}</button>
      </div>
      {adding&&(
        <div className={`mb-3 p-3 rounded-lg space-y-2 ${dk?"bg-slate-700/50":"bg-slate-50"}`}>
          <input type="number" placeholder="Suma (€)" value={tx.amount} onChange={e=>setTx({...tx,amount:e.target.value})} className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-emerald-500 ${dk?"bg-slate-700 border-slate-600 text-white placeholder-slate-400":"bg-white border-slate-200 text-slate-900"}`}/>
          <input type="text" placeholder="Popis" value={tx.description} onChange={e=>setTx({...tx,description:e.target.value})} className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-emerald-500 ${dk?"bg-slate-700 border-slate-600 text-white placeholder-slate-400":"bg-white border-slate-200 text-slate-900"}`}/>
          <input type="date" value={tx.date} onChange={e=>setTx({...tx,date:e.target.value})} className={`w-full px-3 py-2.5 text-sm rounded-lg border outline-none focus:ring-2 focus:ring-emerald-500 ${dk?"bg-slate-700 border-slate-600 text-white placeholder-slate-400":"bg-white border-slate-200 text-slate-900"}`}/>
          <button onClick={add} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold">Potvrdiť</button>
        </div>
      )}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {(!transactions||transactions.length===0)&&<p className={`text-xs text-center py-4 ${dk?"text-slate-500":"text-slate-400"}`}>Žiadne transakcie</p>}
        {transactions&&transactions.map(t=>(
          <div key={t.id} className={`flex justify-between items-center p-2 rounded-lg group ${dk?"bg-slate-700/50":"bg-slate-50"}`}>
            <div className="flex-1"><p className={`text-xs font-semibold ${dk?"text-slate-200":"text-slate-700"}`}>{t.description}</p><p className={`text-[10px] ${dk?"text-slate-500":"text-slate-400"}`}>{new Date(t.date).toLocaleDateString("sk-SK")}</p></div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${t.amount>=0?"text-emerald-600":"text-rose-600"}`}>{t.amount>=0?"+":""}{fmt(t.amount)}</span>
              <button onClick={()=>onDelete(accountId,t.id)} className="sm:opacity-0 sm:group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity"><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MarketTicker = memo(({dark: dk}) => {
  const [markets, setMarkets] = useState([]);
  const [upd, setUpd] = useState(null);

  const fetchMarkets = useCallback(async () => {
    const next = [];

    // 1) Crypto — CoinGecko (BTC + ETH, EUR, 24h change)
    try {
      const r = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=eur&include_24hr_change=true"
      );
      const d = await r.json();
      if (d.bitcoin) next.push({ id:"btc", name:"Bitcoin", price:d.bitcoin.eur, change:d.bitcoin.eur_24h_change||0, cur:"€", decimals:0 });
      if (d.ethereum) next.push({ id:"eth", name:"Ethereum", price:d.ethereum.eur, change:d.ethereum.eur_24h_change||0, cur:"€", decimals:2 });
    } catch {}

    // 2) S&P 500 + Nasdaq — Yahoo Finance (cez CORS proxy s fallback)
    const proxiedFetch = async (targetUrl) => {
      const proxies = [
        (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
        (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      ];
      for (const mkUrl of proxies) {
        try {
          const r = await fetch(mkUrl(targetUrl));
          if (!r.ok) continue;
          return await r.json();
        } catch { continue; }
      }
      return null;
    };
    const indices = [
      { sym:"%5EGSPC", id:"spx", name:"S&P 500" },
      { sym:"%5EIXIC", id:"ndx", name:"Nasdaq" },
    ];
    await Promise.all(indices.map(async (idx) => {
      try {
        const d = await proxiedFetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${idx.sym}?interval=1d&range=2d`
        );
        const meta = d?.chart?.result?.[0]?.meta;
        if (meta) {
          const curr = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose;
          const chg = prev ? ((curr - prev) / prev) * 100 : 0;
          next.push({ id:idx.id, name:idx.name, price:curr, change:chg, cur:"$", decimals:2 });
        }
      } catch {}
    }));

    // 3) EUR/USD — Frankfurter (ECB)
    try {
      const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD");
      const d = await r.json();
      if (d.rates?.USD) next.push({ id:"eurusd", name:"EUR/USD", price:d.rates.USD, change:null, cur:"", decimals:4 });
    } catch {}

    if (next.length > 0) setMarkets(next);
    setUpd(new Date());
  }, []);

  useEffect(() => {
    fetchMarkets();
    const iv = setInterval(fetchMarkets, 900_000);
    return () => clearInterval(iv);
  }, [fetchMarkets]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 w-full backdrop-blur-xl border-t py-2 sm:py-3 z-50 print-hidden ${dk?"bg-slate-800/95 border-slate-700":"bg-white/95 border-slate-200"}`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-3 sm:gap-6 overflow-x-auto" style={{scrollbarWidth:"none"}}>
        <div className="hidden sm:flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
          <div className={`w-1.5 h-1.5 rounded-full ${markets.length>0?"bg-emerald-500 animate-pulse":"bg-slate-300"}`}/>Live Markets
        </div>
        <div className="flex items-center gap-3 sm:gap-6 flex-grow justify-center min-w-max">
          {markets.length===0&&<span className="text-xs text-slate-400">Načítavam dáta…</span>}
          {markets.map(m=>(
            <div key={m.id} className="flex items-center gap-2 text-sm whitespace-nowrap">
              <span className={`font-bold text-xs ${dk?"text-slate-300":"text-slate-700"}`}>{m.name}</span>
              <span className={`font-semibold tabular-nums text-xs ${dk?"text-slate-400":"text-slate-600"}`}>
                {m.cur}{m.price.toLocaleString("sk-SK",{maximumFractionDigits:m.decimals??2,minimumFractionDigits:m.decimals??2})}
              </span>
              {m.change!=null&&(
                <span className={`font-bold text-[10px] px-1.5 py-0.5 rounded ${m.change>=0?(dk?"bg-emerald-900/40 text-emerald-400":"bg-emerald-50 text-emerald-600"):(dk?"bg-rose-900/40 text-rose-400":"bg-rose-50 text-rose-600")}`}>
                  {m.change>0?"+":""}{m.change.toFixed(2)}%
                </span>
              )}
            </div>
          ))}
        </div>
        {upd&&<div className="text-[10px] text-slate-400 hidden md:block tabular-nums whitespace-nowrap">Aktualizované: {upd.toLocaleTimeString("sk-SK")}</div>}
      </div>
    </div>
  );
});

const AccIcon = ({type, category}) => {
  if(category==="DEBT") return <CreditCard size={20}/>;
  if(category==="RECEIVABLE") return <FileText size={20}/>;
  if(type==="REAL_ESTATE") return <Building2 size={20}/>;
  if(type==="STOCK"||type==="CRYPTO") return <TrendingUp size={20}/>;
  if(type==="OTHER_ASSET") return <Box size={20}/>;
  return <Wallet size={20}/>;
};

const accIconClasses = (type, cat) => {
  if(cat==="INVESTMENT") return "bg-emerald-50 text-emerald-500 border-emerald-100";
  if(cat==="RECEIVABLE") return "bg-cyan-50 text-cyan-600 border-cyan-100";
  if(cat==="DEBT") return "bg-rose-50 text-rose-600 border-rose-100";
  if(type==="REAL_ESTATE") return "bg-indigo-50 text-indigo-500 border-indigo-100";
  if(type==="STOCK"||type==="CRYPTO") return "bg-emerald-50 text-emerald-500 border-emerald-100";
  if(type==="OTHER_ASSET") return "bg-slate-200 text-slate-600 border-slate-300";
  return "bg-slate-50 text-slate-600 border-slate-100";
};

/* ────────────────── MAIN APP ────────────────── */

export default function App() {
  /* ─── Auth state ─── */
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const loginQuote = useMemo(() => pickQuote(), []);
  const [authForm, setAuthForm] = useState({email:"",password:""});
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  /* ─── Persisted state ─── */
  const [accounts, setAccounts] = usePersistedState(STORAGE_KEYS.accounts, []);
  const [expenses, setExpenses] = usePersistedState(STORAGE_KEYS.expenses, []);
  const [settings, setSettings] = usePersistedState(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const [history, setHistory] = usePersistedState(STORAGE_KEYS.history, []);
  const [notes, setNotes] = usePersistedState(STORAGE_KEYS.notes, {});
  const [dark, setDark] = usePersistedState(STORAGE_KEYS.dark, false);
  const [portfolio, setPortfolio] = usePersistedState(STORAGE_KEYS.portfolio, []);
  const [cashflow, setCashflow] = usePersistedState(STORAGE_KEYS.cashflow, []);
  const [alerts, setAlerts] = usePersistedState(STORAGE_KEYS.alerts, []);
  const [stockPortfolio, setStockPortfolio] = usePersistedState(STORAGE_KEYS.stockPortfolio, []);
  const [cryptoPrices, setCryptoPrices] = useState({});
  const [now, setNow] = useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);

  /* ─── Auth listener ─── */
  useEffect(()=>{
    const unsub = onAuthStateChanged(auth,(u)=>{
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  },[]);

  /* ─── Firestore: load user data on login ─── */
  useEffect(()=>{
    if(!user) { setDataLoaded(false); return; }
    const load = async ()=>{
      try {
        const snap = await getDoc(doc(db,"users",user.uid));
        if(snap.exists()){
          const d = snap.data();
          if(d.accounts) setAccounts(d.accounts);
          if(d.expenses) setExpenses(d.expenses);
          if(d.settings) setSettings(d.settings);
          if(d.history) setHistory(d.history);
          if(d.notes) setNotes(d.notes);
          if(d.dark!==undefined) setDark(d.dark);
          if(d.portfolio) setPortfolio(d.portfolio);
          if(d.cashflow) setCashflow(d.cashflow);
          if(d.alerts) setAlerts(d.alerts);
          if(d.stockPortfolio) setStockPortfolio(d.stockPortfolio);
          /* Welcome screen pre prvé 2 prihlásenia */
          const cnt = typeof d.loginCount === "number" ? d.loginCount : 99;
          if(cnt < 2) {
            setShowWelcome(true);
            await setDoc(doc(db,"users",user.uid),{...d, loginCount: cnt + 1},{merge:true});
          }
        } else {
          /* Nový používateľ — prázdny dashboard */
          const initSnap = {date:new Date().toISOString(),value:0,assets:0,liab:0,totalExp:0,liquid:0,runway:0,auto:false};
          setAccounts([]);setExpenses([]);setSettings(DEFAULT_SETTINGS);
          setHistory([initSnap]);setNotes({});setDark(false);setPortfolio([]);setCashflow([]);setAlerts([]);setStockPortfolio([]);
          setShowWelcome(true);
          await setDoc(doc(db,"users",user.uid),{
            accounts:[], expenses:[], settings:DEFAULT_SETTINGS,
            history:[initSnap], notes:{}, dark:false, portfolio:[], cashflow:[], alerts:[], stockPortfolio:[], loginCount:1
          });
        }
      } catch(e){ console.error("Firestore load error:",e); }
      setDataLoaded(true);
    };
    load();
  },[user]);

  /* ─── Firestore: debounced save on data change ─── */
  const saveTimer = useRef(null);
  const saveToFirestore = useCallback(()=>{
    if(!user) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async ()=>{
      try {
        await setDoc(doc(db,"users",user.uid),{accounts,expenses,settings,history,notes,dark,portfolio,cashflow,alerts,stockPortfolio});
      } catch(e){ console.error("Firestore save error:",e); }
    },1500);
  },[user,accounts,expenses,settings,history,notes,dark,portfolio,cashflow,alerts,stockPortfolio]);

  useEffect(()=>{
    if(user && dataLoaded) saveToFirestore();
  },[accounts,expenses,settings,history,notes,dark,portfolio,cashflow,alerts,stockPortfolio]);

  /* ─── Auth handlers ─── */
  const handleLogin = async ()=>{
    setAuthError("");setAuthBusy(true);
    try { await signInWithEmailAndPassword(auth,authForm.email,authForm.password); }
    catch(e){
      const msg = e.code==="auth/invalid-credential"?"Nesprávny email alebo heslo"
        :e.code==="auth/user-not-found"?"Účet neexistuje"
        :e.code==="auth/too-many-requests"?"Príliš veľa pokusov, skúste neskôr"
        :"Chyba prihlásenia";
      setAuthError(msg);
    }
    setAuthBusy(false);
  };
  const handleRegister = async ()=>{
    setAuthError("");setAuthBusy(true);
    try { await createUserWithEmailAndPassword(auth,authForm.email,authForm.password); }
    catch(e){
      const msg = e.code==="auth/email-already-in-use"?"Email je už registrovaný"
        :e.code==="auth/weak-password"?"Heslo musí mať aspoň 6 znakov"
        :e.code==="auth/invalid-email"?"Neplatný email"
        :"Chyba registrácie";
      setAuthError(msg);
    }
    setAuthBusy(false);
  };
  const handleLogout = async ()=>{
    await signOut(auth);
    setAuthForm({email:"",password:""});
    setAuthError("");
  };
  const handleAuthSubmit = (e)=>{ e.preventDefault(); authMode==="login"?handleLogin():handleRegister(); };

  const [modal, setModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pwResetSent, setPwResetSent] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [modalType, setModalType] = useState("ACCOUNT");
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({name:"",balance:"",type:"CASH",category:"LIQUID"});
  const [todayNote, setTodayNote] = useState("");
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [noteExpanded, setNoteExpanded] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [cryptoExpanded, setCryptoExpanded] = useState(false);
  const [cryptoForm, setCryptoForm] = useState({name:"",amount:""});
  const [stocksExpanded, setStocksExpanded] = useState(false);
  const [stockForm, setStockForm] = useState({name:"",ticker:"",shares:"",price:""});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [compareDate, setCompareDate] = useState(null);
  const [expDragId, setExpDragId] = useState(null);
  const [expDragOverId, setExpDragOverId] = useState(null);
  const [cashflowOpen, setCashflowOpen] = useState(false);
  const [cfForm, setCfForm] = useState({name:"",amount:"",type:"INCOME",category:"SALARY"});
  const [cfEditId, setCfEditId] = useState(null);
  const [cfDragId, setCfDragId] = useState(null);
  const [cfDragOverId, setCfDragOverId] = useState(null);
  const [cfSort, setCfSort] = useState(null);
  const [cfCustomCat, setCfCustomCat] = useState("");
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertForm, setAlertForm] = useState({name:"",metric:"NW",condition:"ABOVE",value:""});
  const [alertEditId, setAlertEditId] = useState(null);

  const fileInputRef = useRef(null);
  const portfolioFileRef = useRef(null);
  const dashboardRef = useRef(null);

  /* Načítaj dnešnú poznámku po načítaní dát */
  useEffect(() => {
    if(!dataLoaded) return;
    const today = new Date().toISOString().split("T")[0];
    if(notes[today]) setTodayNote(notes[today]);
  }, [dataLoaded, notes]);

  const show = (msg, type="success") => { setToast({message:msg,type}); };

  /* ─── Metrics ─── */
  const metrics = useMemo(() => {
    const assets=accounts.filter(a=>a.category!=="DEBT").reduce((s,a)=>s+Number(a.balance),0);
    const liab=accounts.filter(a=>a.category==="DEBT").reduce((s,a)=>s+Number(a.balance),0);
    const totalExp=expenses.reduce((s,e)=>s+Number(e.amount),0);
    const liquid=accounts.filter(a=>a.category==="LIQUID").reduce((s,a)=>s+Number(a.balance),0);
    const nw=assets-liab-totalExp;
    const runway=settings.monthlyBurn>0?(liquid/settings.monthlyBurn).toFixed(1):0;
    const lmd=new Date();lmd.setDate(lmd.getDate()-30);
    const prev=history.find(h=>new Date(h.date)>=lmd)||history[0];
    const prevNW=prev?prev.value:nw;
    const todayStr=new Date().toISOString().split("T")[0];
    const past=history.filter(h=>h.date.split("T")[0]!==todayStr);
    const lastPt=past.length>0?past[past.length-1]:null;
    const lastVal=lastPt?lastPt.value:null;
    const lastDate=lastPt?new Date(lastPt.date).toLocaleDateString("sk-SK"):null;
    const nonDebt=accounts.filter(a=>a.category!=="DEBT");
    const cd=[
      {name:"Nehnuteľnosti",value:nonDebt.filter(a=>a.type==="REAL_ESTATE").reduce((s,a)=>s+Number(a.balance),0),color:"#6366f1"},
      {name:"Investície",value:nonDebt.filter(a=>["STOCK","CRYPTO","FIREFISH"].includes(a.type)).reduce((s,a)=>s+Number(a.balance),0),color:"#10b981"},
      {name:"Hotovosť a účty",value:nonDebt.filter(a=>["CASH","CHECKING","SAVINGS"].includes(a.type)).reduce((s,a)=>s+Number(a.balance),0),color:"#3b82f6"},
      {name:"Pohľadávky",value:nonDebt.filter(a=>a.type==="RECEIVABLE").reduce((s,a)=>s+Number(a.balance),0),color:"#06b6d4"},
      {name:"Iné",value:nonDebt.filter(a=>a.type==="OTHER_ASSET").reduce((s,a)=>s+Number(a.balance),0),color:"#94a3b8"},
    ].filter(i=>i.value>0).sort((a,b)=>b.value-a.value);
    return {assets,liab,totalExp,nw,liquid,runway,prevNW,lastVal,lastDate,cd};
  },[accounts,expenses,settings.monthlyBurn,history]);

  /* ─── Snapshot helper (cryptoTotal/stockTotal added where called) ─── */
  const buildSnapshot = useCallback(()=>({
    date: new Date().toISOString(),
    value: metrics.nw,
    assets: metrics.assets,
    liab: metrics.liab,
    totalExp: metrics.totalExp,
    liquid: metrics.liquid,
    runway: Number(metrics.runway),
    auto: false,
  }),[metrics]);

  const gapFilledRef = useRef(false);

  /* Same-day update — never overwrite manually saved snapshots */
  useEffect(() => {
    const today=new Date().toISOString().split("T")[0];
    setHistory(prev=>{
      if(prev.length===0) return prev;
      const last=prev[prev.length-1];
      const lastDay=last.date.split("T")[0];
      if(lastDay===today){
        if(!last.auto) return prev; /* Keep manual saves untouched */
        if(last.value!==metrics.nw){const c=[...prev];c[c.length-1]={...last,value:metrics.nw,assets:metrics.assets,liab:metrics.liab,totalExp:metrics.totalExp,liquid:metrics.liquid,runway:Number(metrics.runway),cryptoTotal:portfolioTotal||0,stockTotal:stockTotal||0};return c;}
        return prev;
      }
      return [...prev,{...buildSnapshot(),cryptoTotal:portfolioTotal||0,stockTotal:stockTotal||0,auto:true}];
    });
  },[metrics.nw]);

  /* Fill missing days with real historical crypto prices from CoinGecko */
  useEffect(()=>{
    if(gapFilledRef.current||history.length<2) return;
    const sorted=[...history].sort((a,b)=>a.date.localeCompare(b.date));
    /* Find first gap > 1 day */
    let gapIdx=-1,gapFrom="",gapTo="";
    for(let i=1;i<sorted.length;i++){
      const pDay=sorted[i-1].date.split("T")[0];
      const cDay=sorted[i].date.split("T")[0];
      if(Math.round((new Date(cDay)-new Date(pDay))/86400000)>1){gapIdx=i-1;gapFrom=pDay;gapTo=cDay;break;}
    }
    if(gapIdx===-1) return;
    gapFilledRef.current=true;
    const before=sorted[gapIdx];
    const after=sorted[gapIdx+1];
    const coins=portfolio.length>0?portfolio:[];
    (async()=>{
      /* Fetch historical daily prices for each crypto coin */
      const priceMap={};
      if(coins.length>0){
        const fromTs=Math.floor(new Date(gapFrom).getTime()/1000);
        const toTs=Math.floor(new Date(gapTo).getTime()/1000)+86400;
        for(const coin of coins){
          try{
            const r=await fetch(`https://api.coingecko.com/api/v3/coins/${coin.cgId}/market_chart/range?vs_currency=eur&from=${fromTs}&to=${toTs}`);
            if(r.ok){const d=await r.json();priceMap[coin.cgId]=d.prices||[];}
          }catch{}
        }
      }
      /* Build snapshots for each missing day */
      const filled=[];
      const d=new Date(gapFrom);d.setDate(d.getDate()+1);
      const toDate=new Date(gapTo);
      const lastCrypto=before.cryptoTotal||0;
      const lastStock=before.stockTotal||0;
      while(d<toDate){
        const dayTs=d.getTime()+79200000; /* ~22:00 */
        /* Calculate real crypto value for this day */
        let dayCrypto=0;
        for(const coin of coins){
          const prices=priceMap[coin.cgId]||[];
          if(prices.length>0){
            let closest=prices[0];
            for(const p of prices){if(Math.abs(p[0]-dayTs)<Math.abs(closest[0]-dayTs))closest=p;}
            dayCrypto+=closest[1]*coin.amount;
          }else{dayCrypto+=lastCrypto/Math.max(coins.length,1);}
        }
        const cryptoDelta=dayCrypto-lastCrypto;
        const iso=d.toISOString().split("T")[0];
        filled.push({
          date:iso+"T22:00:00.000Z",
          value:Math.round((before.value+cryptoDelta)*100)/100,
          assets:Math.round((before.assets+cryptoDelta)*100)/100,
          liab:before.liab,totalExp:before.totalExp,liquid:before.liquid,
          runway:before.runway,cryptoTotal:Math.round(dayCrypto*100)/100,
          stockTotal:lastStock,auto:true,
        });
        d.setDate(d.getDate()+1);
      }
      if(filled.length>0){
        setHistory(prev=>{
          const copy=[...prev].sort((a,b)=>a.date.localeCompare(b.date));
          /* Insert filled days at gap position */
          const insertIdx=copy.findIndex(h=>h.date.split("T")[0]===gapTo);
          if(insertIdx===-1) return [...copy,...filled].sort((a,b)=>a.date.localeCompare(b.date));
          copy.splice(insertIdx,0,...filled);
          return copy;
        });
      }
    })();
  },[history,portfolio]);

  /* ─── Auto-save snapshot o 22:00 ─── */
  useEffect(()=>{
    const check=()=>{
      const n=new Date();
      if(n.getHours()===22 && n.getMinutes()===0){
        const today=n.toISOString().split("T")[0];
        setHistory(prev=>{
          const last=prev.length>0?prev[prev.length-1]:null;
          if(last && last.date.split("T")[0]===today && last.auto) return prev;
          const snap={...buildSnapshot(),cryptoTotal:portfolioTotal||0,stockTotal:stockTotal||0,auto:true};
          if(last && last.date.split("T")[0]===today){
            const c=[...prev];c[c.length-1]=snap;return c;
          }
          return [...prev,snap];
        });
        const today2=n.toISOString().split("T")[0];
        setNotes(prev=>{
          const existing=prev[today2]||"";
          if(existing.includes("[auto-save]")) return prev;
          return {...prev,[today2]: existing?(existing+"\n[auto-save 22:00]"):("[auto-save 22:00]")};
        });
      }
    };
    const iv=setInterval(check,60000);
    return()=>clearInterval(iv);
  },[buildSnapshot]);

  /* ─── Handlers ─── */
  const saveDay = () => {
    const today=new Date().toISOString().split("T")[0];
    setHistory(prev=>{
      const snap={...buildSnapshot(),cryptoTotal:portfolioTotal||0,stockTotal:stockTotal||0,auto:false};
      const last=prev.length>0?prev[prev.length-1]:null;
      if(last && last.date.split("T")[0]===today){
        const c=[...prev];c[c.length-1]=snap;return c;
      }
      return [...prev,snap];
    });
    setNotes({...notes,[today]:todayNote});
    show("Denný snapshot bol uložený!");
  };

  const exportJSON = () => {
    const d=JSON.stringify({accounts,expenses,settings,history,notes,dark,portfolio,cashflow,alerts,stockPortfolio},null,2);
    const b=new Blob([d],{type:"application/json"});
    const u=URL.createObjectURL(b);
    const l=document.createElement("a");l.href=u;l.download=`fidu-backup-${new Date().toISOString().split("T")[0]}.json`;l.click();
    URL.revokeObjectURL(u);show("Dáta boli exportované!");
  };

  /* Pomocná fn: zapne kompaktný režim pre export, vráti cleanup fn */
  const enterExportMode = async () => {
    const el = dashboardRef.current;
    if(!el) throw new Error("Dashboard element nenájdený");
    el.setAttribute("data-export-compact","");
    el.style.width = Math.max(el.scrollWidth,1280)+"px";
    el.style.maxWidth = "none";
    await new Promise(r=>setTimeout(r,150));
    return () => {
      el.removeAttribute("data-export-compact");
      el.style.width = "";
      el.style.maxWidth = "";
    };
  };

  const exportPNG = async () => {
    show("Generujem PNG screenshot...");
    let cleanup;
    try {
      cleanup = await enterExportMode();
      const el = dashboardRef.current;
      const dataUrl = await toPng(el,{
        pixelRatio: 2,
        backgroundColor: dark ? "#0f172a" : "#f8fafc",
        style: { overflow: "visible", height: "auto" },
      });
      cleanup(); cleanup = null;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `fidu-dashboard-${new Date().toISOString().split("T")[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      show("PNG screenshot bol uložený!");
    } catch(e){ console.error("PNG export error:",e); show("Chyba pri generovaní PNG","error"); }
    finally { if(cleanup) cleanup(); }
  };

  const exportPDF = async () => {
    show("Generujem PDF...");
    let cleanup;
    try {
      cleanup = await enterExportMode();
      const el = dashboardRef.current;
      const canvas = await toCanvas(el,{
        pixelRatio: 2,
        backgroundColor: dark ? "#0f172a" : "#f8fafc",
        style: { overflow: "visible", height: "auto" },
      });
      cleanup(); cleanup = null;
      const imgData = canvas.toDataURL("image/jpeg",0.95);
      /* Automatická orientácia podľa obsahu */
      const imgRatio = canvas.height / canvas.width;
      const orientation = imgRatio > 1.2 ? "portrait" : "landscape";
      const pdf = new jsPDF({orientation,unit:"mm",format:"a4"});
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 5;
      const usableW = pageW - margin*2;
      const usableH = pageH - margin*2;
      /* Fitovať celé na 1 stranu */
      let imgW = usableW;
      let imgH = imgW * imgRatio;
      if(imgH > usableH){ imgH = usableH; imgW = imgH / imgRatio; }
      /* Centrovať na stránke */
      const ox = margin + (usableW - imgW)/2;
      const oy = margin + (usableH - imgH)/2;
      pdf.addImage(imgData,"JPEG",ox,oy,imgW,imgH);
      pdf.save(`fidu-dashboard-${new Date().toISOString().split("T")[0]}.pdf`);
      show("PDF bol uložený!");
    } catch(e){ console.error("PDF export error:",e); show("Chyba pri generovaní PDF","error"); }
    finally { if(cleanup) cleanup(); }
  };

  const exportComprehensivePDF = () => {
    show("Generujem kompletný PDF report...");
    try {
      const pdf = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"});
      const W = pdf.internal.pageSize.getWidth();
      const H = pdf.internal.pageSize.getHeight();
      const M = 15; // margin
      const cW = W - M*2; // content width
      let y = 0;
      let pageNum = 1;

      /* ── Helpers ── */
      const hex = (h) => {
        const c = h.replace("#","");
        return [parseInt(c.substring(0,2),16),parseInt(c.substring(2,4),16),parseInt(c.substring(4,6),16)];
      };
      const checkPage = (need) => {
        if(y + need > H - 15){ pdf.addPage(); y = M + 2; pageNum++; return true; }
        return false;
      };
      // Truncate text to fit within maxW mm
      const truncate = (text, maxW, fontSize) => {
        pdf.setFontSize(fontSize);
        if(pdf.getTextWidth(text) <= maxW) return text;
        while(text.length > 3 && pdf.getTextWidth(text + "...") > maxW) text = text.slice(0, -1);
        return text + "...";
      };

      /* ── Header banner ── */
      pdf.setFillColor(...hex("#0f172a"));
      pdf.rect(0, 0, W, 40, "F");
      pdf.setFillColor(...hex("#10b981"));
      pdf.rect(0, 38, W, 2, "F");
      pdf.setFontSize(24);
      pdf.setFont("helvetica","bold");
      pdf.setTextColor(255,255,255);
      pdf.text("FIDU", M, 17);
      pdf.setFontSize(11);
      pdf.setFont("helvetica","normal");
      pdf.setTextColor(...hex("#94a3b8"));
      pdf.text("Kompletny financny prehlad", M, 25);
      const dateStr = new Date().toLocaleDateString("sk-SK",{day:"numeric",month:"long",year:"numeric"});
      const timeStr = new Date().toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"});
      pdf.setFontSize(9);
      pdf.setTextColor(...hex("#64748b"));
      pdf.text(`${dateStr}  •  ${timeStr}`, M, 33);
      if(user?.email){
        pdf.setFontSize(8);
        pdf.setTextColor(...hex("#cbd5e1"));
        pdf.text(user.email, W - M, 33, {align:"right"});
      }
      y = 50;

      /* ── Metric cards — 2 rows: 3 + 2 ── */
      const row1 = [
        {label:"Ciste imanie",value:fmt(metrics.nw),color:"#10b981",bg:"#ecfdf5"},
        {label:"Aktiva celkom",value:fmt(metrics.assets),color:"#3b82f6",bg:"#eff6ff"},
        {label:"Zavazky celkom",value:"-"+fmt(metrics.liab+metrics.totalExp),color:"#ef4444",bg:"#fef2f2"},
      ];
      const row2 = [
        {label:"Likvidne prostriedky",value:fmt(metrics.liquid),color:"#06b6d4",bg:"#ecfeff"},
        {label:"Financny runway",value:`${metrics.runway} mes.`,color:"#f59e0b",bg:"#fffbeb"},
      ];
      const drawCardRow = (cards, cols) => {
        const gap = 4;
        const w = (cW - gap*(cols-1)) / cols;
        cards.forEach((c,i) => {
          const cx = M + i*(w+gap);
          pdf.setFillColor(...hex(c.bg));
          pdf.rect(cx, y, w, 20, "F");
          pdf.setFillColor(...hex(c.color));
          pdf.rect(cx, y, 1.5, 20, "F");
          pdf.setFontSize(7);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#64748b"));
          pdf.text(c.label.toUpperCase(), cx + 5, y + 7);
          pdf.setFontSize(12);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex(c.color));
          const valTrunc = truncate(c.value, w - 8, 12);
          pdf.text(valTrunc, cx + 5, y + 15);
        });
        y += 24;
      };
      drawCardRow(row1, 3);
      drawCardRow(row2, 2);

      /* ── Breakdown bar ── */
      const totalP = metrics.liab + metrics.totalExp;
      if(totalP > 0){
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica","normal");
        pdf.setTextColor(...hex("#94a3b8"));
        pdf.text(`Dlhy: -${fmt(metrics.liab)}  |  Planovane vydavky: -${fmt(metrics.totalExp)}`, M, y);
        y += 4;
        const barH = 3.5;
        const debtPct = metrics.liab / totalP;
        pdf.setFillColor(...hex("#fca5a5"));
        pdf.rect(M, y, cW, barH, "F");
        if(debtPct > 0){
          pdf.setFillColor(...hex("#ef4444"));
          pdf.rect(M, y, Math.max(cW * debtPct, 3), barH, "F");
        }
        y += 9;
      }

      /* ── Section helper ── */
      const sectionHeader = (title, color, count) => {
        checkPage(22);
        y += 3;
        pdf.setFillColor(...hex(color));
        pdf.rect(M, y, cW, 0.8, "F");
        y += 5;
        pdf.setFontSize(12);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex("#1e293b"));
        pdf.text(title, M, y);
        if(count !== undefined){
          pdf.setFontSize(11);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#1e293b"));
          const titleW = pdf.getTextWidth(title);
          pdf.setFontSize(9);
          pdf.setFont("helvetica","normal");
          pdf.setTextColor(...hex("#94a3b8"));
          pdf.text(`(${count})`, M + titleW + 3, y);
        }
        y += 7;
      };

      /* ── Item row helper — name on line 1, value on right, note below ── */
      const itemRow = (name, value, valueColor, note, accentColor) => {
        // Pre-calculate note lines with correct font
        pdf.setFontSize(8);
        pdf.setFont("helvetica","normal");
        const noteLines = note ? pdf.splitTextToSize(String(note), cW - 16) : [];
        const nameLineH = 8;
        const noteH = noteLines.length > 0 ? noteLines.length * 4 + 2 : 0;
        const rowH = nameLineH + noteH;
        checkPage(rowH + 3);
        // Background
        pdf.setFillColor(...hex("#f8fafc"));
        pdf.rect(M, y, cW, rowH, "F");
        // Left accent bar
        pdf.setFillColor(...hex(accentColor || "#e2e8f0"));
        pdf.rect(M, y, 1.5, rowH, "F");
        // Name — truncate to not overlap with value
        const maxNameW = cW * 0.55;
        pdf.setFontSize(9);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex("#334155"));
        const nameTrunc = truncate(name, maxNameW, 9);
        pdf.text(nameTrunc, M + 6, y + 5.5);
        // Value — right aligned
        pdf.setFontSize(9);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex(valueColor || "#334155"));
        pdf.text(value, W - M - 4, y + 5.5, {align:"right"});
        // Note lines below
        if(noteLines.length > 0){
          pdf.setFontSize(8);
          pdf.setFont("helvetica","normal");
          pdf.setTextColor(...hex("#64748b"));
          noteLines.forEach((line, li) => {
            pdf.text(line, M + 6, y + nameLineH + 1 + li * 4);
          });
        }
        y += rowH + 2;
      };

      /* ── AKTÍVA ── */
      const activeAccounts = accounts.filter(a=>a.category!=="DEBT");
      sectionHeader("Aktiva", "#3b82f6", activeAccounts.length);
      if(activeAccounts.length === 0){
        pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.setTextColor(...hex("#94a3b8")); pdf.text("Ziadne aktiva", M + 5, y); y += 7;
      } else {
        const types = [...new Set(activeAccounts.map(a=>a.type))];
        types.forEach(type => {
          const group = activeAccounts.filter(a=>a.type===type);
          const groupTotal = group.reduce((s,a)=>s+a.balance, 0);
          checkPage(10);
          pdf.setFontSize(8);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#64748b"));
          pdf.text(`${type}  —  ${fmt(groupTotal)}`, M + 3, y);
          y += 5;
          group.forEach(acc => {
            itemRow(acc.name, fmt(acc.balance), "#1e293b", acc.note, "#3b82f6");
          });
          y += 3;
        });
      }
      y += 2;

      /* ── PASÍVA — Dlhy ── */
      const debts = accounts.filter(a=>a.category==="DEBT");
      sectionHeader("Dlhy a zavazky", "#ef4444", debts.length);
      if(debts.length === 0){
        pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.setTextColor(...hex("#94a3b8")); pdf.text("Ziadne dlhy", M + 5, y); y += 7;
      } else {
        debts.forEach(debt => {
          itemRow(debt.name, "-" + fmt(debt.balance), "#ef4444", debt.note, "#ef4444");
        });
      }
      y += 2;

      /* ── PASÍVA — Plánované výdavky ── */
      sectionHeader("Planovane vydavky", "#f97316", expenses.length);
      if(expenses.length === 0){
        pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.setTextColor(...hex("#94a3b8")); pdf.text("Ziadne planovane vydavky", M + 5, y); y += 7;
      } else {
        expenses.forEach(exp => {
          const cat = EXP_CATEGORIES[exp.category] || exp.category;
          itemRow(`${exp.name}  (${cat})`, "-" + fmt(exp.amount), "#ea580c", exp.note, "#f97316");
        });
      }
      y += 2;

      /* ── CRYPTO PORTFÓLIO ── */
      if(portfolio.length > 0){
        sectionHeader("Crypto portfolio", "#8b5cf6", portfolio.length);
        checkPage(10);
        pdf.setFontSize(9);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex("#7c3aed"));
        pdf.text(`Celkova hodnota: ${fmtFull(portfolioTotal||0)}`, M + 3, y);
        y += 7;
        // Table header
        checkPage(10);
        pdf.setFillColor(...hex("#f1f5f9"));
        pdf.rect(M, y, cW, 7, "F");
        pdf.setFontSize(7);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex("#64748b"));
        const colName = M + 5;
        const colAmt = M + cW * 0.38;
        const colPrice = M + cW * 0.58;
        const colVal = W - M - 4;
        pdf.text("NAZOV", colName, y + 4.5);
        pdf.text("MNOZSTVO", colAmt, y + 4.5);
        pdf.text("CENA", colPrice, y + 4.5);
        pdf.text("HODNOTA", colVal, y + 4.5, {align:"right"});
        y += 9;
        portfolio.forEach((coin, ci) => {
          checkPage(8);
          if(ci % 2 === 0){ pdf.setFillColor(...hex("#f8fafc")); pdf.rect(M, y - 1.5, cW, 7, "F"); }
          const val = (coin.price||0) * (coin.amount||0);
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#334155"));
          const coinName = `${coin.name||"?"} (${(coin.symbol||"").toUpperCase()})`;
          pdf.text(truncate(coinName, cW * 0.32, 8.5), colName, y + 3);
          pdf.setFont("helvetica","normal");
          pdf.setTextColor(...hex("#475569"));
          pdf.text(String(coin.amount||0), colAmt, y + 3);
          pdf.text(fmtFull(coin.price||0), colPrice, y + 3);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#334155"));
          pdf.text(fmtFull(val), colVal, y + 3, {align:"right"});
          y += 7;
        });
        y += 4;
      }

      /* ── ETF / AKCIE ── */
      if(stockPortfolio.length > 0){
        sectionHeader("ETF / Akciove portfolio", "#0ea5e9", stockPortfolio.length);
        checkPage(10);
        pdf.setFontSize(9);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex("#0284c7"));
        pdf.text(`Celkova hodnota: ${fmtFull(stockTotal||0)}`, M + 3, y);
        y += 7;
        // Table header
        checkPage(10);
        pdf.setFillColor(...hex("#f1f5f9"));
        pdf.rect(M, y, cW, 7, "F");
        pdf.setFontSize(7);
        pdf.setFont("helvetica","bold");
        pdf.setTextColor(...hex("#64748b"));
        pdf.text("NAZOV", M + 5, y + 4.5);
        pdf.text("TICKER", M + cW * 0.45, y + 4.5);
        pdf.text("HODNOTA", W - M - 4, y + 4.5, {align:"right"});
        y += 9;
        stockPortfolio.forEach((s, si) => {
          checkPage(8);
          if(si % 2 === 0){ pdf.setFillColor(...hex("#f8fafc")); pdf.rect(M, y - 1.5, cW, 7, "F"); }
          pdf.setFontSize(8.5);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#334155"));
          pdf.text(truncate(s.name||"?", cW * 0.38, 8.5), M + 5, y + 3);
          pdf.setFont("helvetica","normal");
          pdf.setTextColor(...hex("#475569"));
          pdf.text(s.ticker||"?", M + cW * 0.45, y + 3);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#334155"));
          pdf.text(fmtFull((s.shares||0) * (s.price||0)), W - M - 4, y + 3, {align:"right"});
          y += 7;
        });
        y += 4;
      }

      /* ── MESAČNÝ CASH-FLOW ── */
      if(cashflow.length > 0){
        sectionHeader("Mesacny cash-flow", "#10b981");
        // Summary cards
        checkPage(24);
        const cfCards = [
          {label:"Mesacne prijmy",value:"+"+fmt(cfMetrics.monthlyIncome),color:"#10b981",bg:"#ecfdf5"},
          {label:"Mesacne vydavky",value:"-"+fmt(cfMetrics.monthlyExpense),color:"#ef4444",bg:"#fef2f2"},
          {label:"Mesacny prebytok",value:(cfMetrics.surplus>=0?"+":"")+fmt(cfMetrics.surplus),color:cfMetrics.surplus>=0?"#10b981":"#ef4444",bg:cfMetrics.surplus>=0?"#ecfdf5":"#fef2f2"},
        ];
        const cfGap = 4;
        const cfCardW = (cW - cfGap*2) / 3;
        cfCards.forEach((c,i) => {
          const cx = M + i*(cfCardW+cfGap);
          pdf.setFillColor(...hex(c.bg));
          pdf.rect(cx, y, cfCardW, 16, "F");
          pdf.setFillColor(...hex(c.color));
          pdf.rect(cx, y, 1.2, 16, "F");
          pdf.setFontSize(7);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex("#64748b"));
          pdf.text(c.label.toUpperCase(), cx + 5, y + 6);
          pdf.setFontSize(11);
          pdf.setFont("helvetica","bold");
          pdf.setTextColor(...hex(c.color));
          pdf.text(truncate(c.value, cfCardW - 8, 11), cx + 5, y + 13);
        });
        y += 21;
        // Items
        const incomes = cashflow.filter(c=>c.type==="INCOME");
        const expensesCF = cashflow.filter(c=>c.type==="EXPENSE");
        if(incomes.length > 0){
          checkPage(8);
          pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(...hex("#10b981"));
          pdf.text("PRIJMY", M + 3, y); y += 5;
          incomes.forEach(i => {
            checkPage(7);
            pdf.setFontSize(8.5); pdf.setFont("helvetica","normal"); pdf.setTextColor(...hex("#334155"));
            const freq = i.frequency==="ONCE"?"jednorazovo":"mesacne";
            const cfName = truncate(`${i.name} (${freq})`, cW * 0.6, 8.5);
            pdf.text(cfName, M + 6, y + 3);
            pdf.setFont("helvetica","bold"); pdf.setTextColor(...hex("#10b981"));
            pdf.text("+"+fmt(i.amount), W - M - 4, y + 3, {align:"right"});
            y += 6;
          });
          y += 3;
        }
        if(expensesCF.length > 0){
          checkPage(8);
          pdf.setFontSize(8); pdf.setFont("helvetica","bold"); pdf.setTextColor(...hex("#ef4444"));
          pdf.text("VYDAVKY", M + 3, y); y += 5;
          expensesCF.forEach(e => {
            checkPage(7);
            pdf.setFontSize(8.5); pdf.setFont("helvetica","normal"); pdf.setTextColor(...hex("#334155"));
            const freq = e.frequency==="ONCE"?"jednorazovo":"mesacne";
            const cfName = truncate(`${e.name} (${freq})`, cW * 0.6, 8.5);
            pdf.text(cfName, M + 6, y + 3);
            pdf.setFont("helvetica","bold"); pdf.setTextColor(...hex("#ef4444"));
            pdf.text("-"+fmt(e.amount), W - M - 4, y + 3, {align:"right"});
            y += 6;
          });
        }
        y += 4;
      }

      /* ── ALERTY ── */
      if(alerts.length > 0){
        sectionHeader("Aktivne alerty", "#f59e0b", alerts.length);
        alerts.forEach(a => {
          checkPage(12);
          const symbol = a.condition==="ABOVE"?"\u2265":"\u2264";
          pdf.setFillColor(...hex("#fffbeb"));
          pdf.rect(M, y, cW, 9, "F");
          pdf.setFillColor(...hex("#f59e0b"));
          pdf.rect(M, y, 1.5, 9, "F");
          pdf.setFontSize(9); pdf.setFont("helvetica","bold"); pdf.setTextColor(...hex("#92400e"));
          pdf.text(truncate(a.name||"?", cW * 0.55, 9), M + 6, y + 6);
          pdf.setFont("helvetica","normal"); pdf.setTextColor(...hex("#a16207"));
          pdf.text(`NW ${symbol} ${fmt(a.value||0)}`, W - M - 4, y + 6, {align:"right"});
          y += 12;
        });
        y += 4;
      }

      /* ── Footer on every page ── */
      const totalPages = pdf.internal.getNumberOfPages();
      for(let p = 1; p <= totalPages; p++){
        pdf.setPage(p);
        pdf.setFontSize(7);
        pdf.setFont("helvetica","normal");
        pdf.setTextColor(...hex("#94a3b8"));
        pdf.text(`FIDU Financial Dashboard  |  Strana ${p} z ${totalPages}`, W/2, H - 7, {align:"center"});
        pdf.text(`Vygenerovane: ${new Date().toLocaleString("sk-SK")}`, W - M, H - 7, {align:"right"});
      }

      pdf.save(`fidu-kompletny-prehlad-${new Date().toISOString().split("T")[0]}.pdf`);
      show("Kompletny PDF report bol ulozeny!");
    } catch(e){
      console.error("Comprehensive PDF error:",e);
      show("Chyba pri generovani PDF reportu","error");
    }
  };

  const exportCSV = () => {
    let csv="Typ,Názov,Kategória,Hodnota,Dátum\n";
    accounts.forEach(a=>{csv+=`${a.category==="DEBT"?"Dlh":"Aktívum"},${a.name},${a.category==="DEBT"?"Dlh":a.type},${a.balance},${new Date().toISOString()}\n`;});
    expenses.forEach(e=>{csv+=`Výdavok,${e.name},${e.category},${e.amount},${new Date().toISOString()}\n`;});
    const b=new Blob([csv],{type:"text/csv"});const u=URL.createObjectURL(b);
    const l=document.createElement("a");l.href=u;l.download=`fidu-export-${new Date().toISOString().split("T")[0]}.csv`;l.click();
    URL.revokeObjectURL(u);show("CSV súbor bol exportovaný!");
  };

  const importJSON = (e) => {
    const f=e.target.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=(ev)=>{try{const d=JSON.parse(ev.target.result);if(d.accounts)setAccounts(d.accounts);if(d.expenses)setExpenses(d.expenses);if(d.settings)setSettings(d.settings);if(d.history)setHistory(d.history);if(d.notes)setNotes(d.notes);if(d.dark!==undefined)setDark(d.dark);if(d.portfolio)setPortfolio(d.portfolio);if(d.cashflow)setCashflow(d.cashflow);if(d.alerts)setAlerts(d.alerts);if(d.stockPortfolio)setStockPortfolio(d.stockPortfolio);show("Dáta boli importované!");}catch{show("Chyba pri importe!","error");}};
    r.readAsText(f);
  };

  const resetData = async () => {
    if(!confirm("Naozaj chcete vymazať všetky údaje? Začnete úplne od nuly.")) return;
    for(const k of Object.values(STORAGE_KEYS)){
      try { localStorage.removeItem(k); } catch {}
    }
    const initialSnap = {
      date: new Date().toISOString(), value: 0,
      assets: 0, liab: 0, totalExp: 0,
      liquid: 0, runway: 0, auto: false,
    };
    setAccounts([]);
    setExpenses([]);
    setSettings(DEFAULT_SETTINGS);
    setHistory([initialSnap]);
    setNotes({});
    setDark(false);
    setPortfolio([]);
    setCashflow([]);
    setAlerts([]);
    setStockPortfolio([]);
    setTodayNote("");
    if(user){
      try{await setDoc(doc(db,"users",user.uid),{accounts:[],expenses:[],settings:DEFAULT_SETTINGS,history:[initialSnap],notes:{},dark:false,portfolio:[],cashflow:[],alerts:[],stockPortfolio:[]});}catch(e){console.error("Reset Firestore error:",e);}
    }
    show("Všetky údaje vymazané — začínate od nuly!");
  };

  const openAdd = (type) => {
    setModalType(type);
    setEditId(null);
    if(type==="DEBT") setForm({name:"",balance:"",type:"CASH",category:"DEBT",customCat:"",customType:""});
    else if(type==="ACCOUNT") setForm({name:"",balance:"",type:"CASH",category:"LIQUID",customCat:"",customType:""});
    else setForm({name:"",balance:"",type:"HOUSING",category:"",customCat:"",customType:""});
    setModal(true);
  };

  const openEdit = (type, item) => {
    setModalType(type);
    setEditId(item.id);
    if(type==="ACCOUNT"||type==="DEBT") {
      const isCustomCat = type==="ACCOUNT"&&!BUILTIN_CATS.includes(item.category);
      const isCustomType = !BUILTIN_TYPES.includes(item.type);
      setForm({name:item.name,balance:String(item.balance),type:isCustomType?"__CUSTOM_TYPE__":item.type,category:isCustomCat?"__CUSTOM__":(item.category||"LIQUID"),customCat:isCustomCat?item.category:"",customType:isCustomType?item.type:""});
    } else {
      const isCustom = !BUILTIN_EXP_CATS.includes(item.category);
      setForm({name:item.name,balance:String(item.amount),type:isCustom?"__CUSTOM__":(item.category||"HOUSING"),category:"",customCat:isCustom?item.category:"",customType:""});
    }
    setModal(true);
  };

  const saveModal = () => {
    if(!form.name||!form.balance) return;
    if(modalType==="ACCOUNT"||modalType==="DEBT"){
      const cat = modalType==="DEBT" ? "DEBT" : (form.category==="__CUSTOM__"?(form.customCat||"").trim():(form.category||"LIQUID"));
      if(!cat) return;
      const typ = form.type==="__CUSTOM_TYPE__"?(form.customType||"").trim():(form.type||"CASH");
      if(!typ) return;
      if(editId){
        setAccounts(prev=>prev.map(a=>a.id===editId?{...a,name:form.name,balance:Number(form.balance),type:typ,category:cat}:a));
        show(modalType==="DEBT"?"Dlh bol aktualizovaný!":"Účet bol aktualizovaný!");
      } else {
        setAccounts(prev=>[...prev,{id:Date.now().toString(),name:form.name,balance:Number(form.balance),type:typ,category:cat,transactions:[]}]);
        show(modalType==="DEBT"?"Dlh bol pridaný!":"Účet bol pridaný!");
      }
    } else {
      const expCat = form.type==="__CUSTOM__"?(form.customCat||"").trim():(form.type||"OTHER");
      if(!expCat) return;
      if(editId){
        setExpenses(prev=>prev.map(e=>e.id===editId?{...e,name:form.name,amount:Number(form.balance),category:expCat}:e));
        show("Výdavok bol aktualizovaný!");
      } else {
        setExpenses(prev=>[...prev,{id:"e"+Date.now(),name:form.name,amount:Number(form.balance),category:expCat}]);
        show("Výdavok bol pridaný!");
      }
    }
    setModal(false);
  };

  const deleteAccount = (id) => {
    if(!confirm("Naozaj chcete odstrániť tento účet?")) return;
    setAccounts(prev=>prev.filter(a=>a.id!==id));
    if(expanded===id) setExpanded(null);
    show("Účet bol odstránený!");
  };

  const deleteExpense = (id) => {
    if(!confirm("Naozaj chcete odstrániť tento výdavok?")) return;
    setExpenses(prev=>prev.filter(e=>e.id!==id));
    show("Výdavok bol odstránený!");
  };

  const addTransaction = (accountId, tx) => {
    setAccounts(prev=>prev.map(a=>{
      if(a.id!==accountId) return a;
      return {...a, balance:a.balance+tx.amount, transactions:[...(a.transactions||[]),tx]};
    }));
    show("Transakcia bola pridaná!");
  };

  const deleteTransaction = (accountId, txId) => {
    setAccounts(prev=>prev.map(a=>{
      if(a.id!==accountId) return a;
      const tx=a.transactions.find(t=>t.id===txId);
      return {...a, balance:a.balance-(tx?tx.amount:0), transactions:a.transactions.filter(t=>t.id!==txId)};
    }));
    show("Transakcia bola odstránená!");
  };

  const updateAccountNote = (id, note) => {
    setAccounts(prev=>prev.map(a=>a.id===id?{...a,note}:a));
  };
  const updateExpenseNote = (id, note) => {
    setExpenses(prev=>prev.map(e=>e.id===id?{...e,note}:e));
  };

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    requestAnimationFrame(() => {
      if(e.target) e.target.style.opacity = "0.4";
    });
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = "1";
    setDragId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if(id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if(!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    setAccounts(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(a => a.id === dragId);
      const toIdx = arr.findIndex(a => a.id === targetId);
      if(fromIdx === -1 || toIdx === -1) return prev;
      if(arr[fromIdx].category !== arr[toIdx].category) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setDragId(null);
    setDragOverId(null);
  };

  /* ─── Drag & Drop pre výdavky ─── */
  const handleExpDragStart = (e, id) => {
    setExpDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    requestAnimationFrame(() => { if(e.target) e.target.style.opacity = "0.4"; });
  };
  const handleExpDragEnd = (e) => {
    e.target.style.opacity = "1";
    setExpDragId(null);
    setExpDragOverId(null);
  };
  const handleExpDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if(id !== expDragOverId) setExpDragOverId(id);
  };
  const handleExpDrop = (e, targetId) => {
    e.preventDefault();
    if(!expDragId || expDragId === targetId) { setExpDragId(null); setExpDragOverId(null); return; }
    setExpenses(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(x => x.id === expDragId);
      const toIdx = arr.findIndex(x => x.id === targetId);
      if(fromIdx === -1 || toIdx === -1) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setExpDragId(null);
    setExpDragOverId(null);
  };

  /* ─── Krypto portfólio — CMC CSV import ─── */
  const parseCmcCsv = (text) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const headerIdx = lines.findIndex(l => l.startsWith('"Name"'));
    if (headerIdx === -1) { show("Neplatný CMC CSV formát!", "error"); return; }
    const items = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const cols = [];
      let cur = "", inQ = false;
      for (const ch of lines[i]) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      cols.push(cur.trim());
      if (cols.length < 7) continue;
      const name = cols[0];
      const amount = parseFloat(cols[6].replace(/,/g, "")) || 0;
      const cgId = NAME_TO_CG[name.toLowerCase()] || name.toLowerCase().replace(/\s+/g, "-");
      if (amount > 0) items.push({ id: cgId, name, cgId, amount });
    }
    if (items.length === 0) { show("Žiadne položky v CSV!", "error"); return; }
    setPortfolio(items);
    show(`Portfólio importované — ${items.length} coinov!`);
  };

  const importPortfolioCsv = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => parseCmcCsv(ev.target.result);
    r.readAsText(f);
    e.target.value = "";
  };

  const addToPortfolioManual = () => {
    const name = cryptoForm.name.trim();
    const amount = parseFloat(cryptoForm.amount);
    if(!name || !amount || amount <= 0) return;
    const cgId = NAME_TO_CG[name.toLowerCase()] || name.toLowerCase().replace(/\s+/g, "-");
    setPortfolio(prev => {
      const existing = prev.find(p => p.cgId === cgId);
      if(existing) return prev.map(p => p.cgId === cgId ? {...p, amount: p.amount + amount} : p);
      return [...prev, {id: cgId, name, cgId, amount}];
    });
    setCryptoForm({name:"",amount:""});
    show(`${name} bol pridaný do portfólia!`);
  };

  const removeFromPortfolio = (cgId) => {
    setPortfolio(prev => prev.filter(p => p.cgId !== cgId));
    show("Coin bol odstránený z portfólia!");
  };

  /* ─── CoinGecko live ceny pre portfólio ─── */
  const fetchPortfolioPrices = useCallback(async () => {
    if (portfolio.length === 0) return;
    const ids = portfolio.map(p => p.cgId).join(",");
    try {
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`);
      const d = await r.json();
      setCryptoPrices(d);
    } catch {}
  }, [portfolio]);

  useEffect(() => {
    fetchPortfolioPrices();
    const iv = setInterval(fetchPortfolioPrices, 900_000);
    return () => clearInterval(iv);
  }, [fetchPortfolioPrices]);

  const portfolioTotal = useMemo(() => {
    return portfolio.reduce((sum, p) => {
      const price = cryptoPrices[p.cgId]?.eur || 0;
      return sum + price * p.amount;
    }, 0);
  }, [portfolio, cryptoPrices]);

  /* Synchronizácia hodnoty krypto portfólia do účtu typu CRYPTO */
  useEffect(() => {
    if (portfolio.length === 0 || portfolioTotal === 0) return;
    setAccounts(prev => {
      const idx = prev.findIndex(a => a.type === "CRYPTO");
      if (idx !== -1) {
        if (Math.round(prev[idx].balance) === Math.round(portfolioTotal)) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], balance: Math.round(portfolioTotal) };
        return copy;
      }
      return [...prev, { id: "crypto_auto", name: "Krypto portfólio", balance: Math.round(portfolioTotal), type: "CRYPTO", category: "LIQUID", transactions: [] }];
    });
  }, [portfolioTotal]);

  /* ─── Akciové portfólio — manuálne ─── */
  const stockTotal = useMemo(() => stockPortfolio.reduce((s, st) => s + st.shares * st.price, 0), [stockPortfolio]);

  const addStock = () => {
    const {name,ticker,shares,price} = stockForm;
    if(!name.trim()||!shares||!price) { show("Vyplňte názov, počet a cenu!","error"); return; }
    setStockPortfolio(prev => [...prev, {id:Date.now().toString(),name:name.trim(),ticker:ticker.trim().toUpperCase(),shares:Number(shares),price:Number(price)}]);
    setStockForm({name:"",ticker:"",shares:"",price:""});
    show("Akcia pridaná do portfólia!");
  };

  const removeStock = (id) => {
    setStockPortfolio(prev => prev.filter(s => s.id !== id));
    show("Akcia odstránená z portfólia!");
  };

  const updateStockPrice = (id, newPrice) => {
    setStockPortfolio(prev => prev.map(s => s.id === id ? {...s, price: Number(newPrice)} : s));
  };

  /* Synchronizácia hodnoty akciového portfólia do účtu typu STOCK */
  useEffect(() => {
    if (stockPortfolio.length === 0 || stockTotal === 0) return;
    setAccounts(prev => {
      const idx = prev.findIndex(a => a.id === "stock_auto");
      if (idx !== -1) {
        if (Math.round(prev[idx].balance) === Math.round(stockTotal)) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], balance: Math.round(stockTotal) };
        return copy;
      }
      return [...prev, { id: "stock_auto", name: "Akciové portfólio", balance: Math.round(stockTotal), type: "STOCK", category: "INVESTMENT", transactions: [] }];
    });
  }, [stockTotal]);

  /* ─── Cash-flow výpočty ─── */
  const cfMetrics = useMemo(() => {
    const monthlyIncome = cashflow.filter(c=>c.type==="INCOME").reduce((s,c)=>s+Number(c.amount),0);
    const monthlyExpense = cashflow.filter(c=>c.type==="EXPENSE").reduce((s,c)=>s+Number(c.amount),0);
    const surplus = monthlyIncome - monthlyExpense;
    const savingsRate = monthlyIncome > 0 ? ((surplus / monthlyIncome) * 100) : 0;
    const proj3 = metrics.liquid + surplus * 3;
    const proj6 = metrics.liquid + surplus * 6;
    const proj12 = metrics.liquid + surplus * 12;
    /* Net worth projection:
       - surplus = zmena likvidných aktív/mes
       - splátky dlhov (LOAN) znižujú aj pasíva → pre NW je efekt neutrálny
       - skutočná zmena NW/mes = surplus + splátky (lebo splátka znižuje cash AJ dlh)
    */
    const loanPayments = cashflow.filter(c=>c.type==="EXPENSE"&&c.category==="LOAN").reduce((s,c)=>s+Number(c.amount),0);
    const monthlyNwDelta = surplus + loanPayments;
    const nwProj3 = metrics.nw + monthlyNwDelta * 3;
    const nwProj6 = metrics.nw + monthlyNwDelta * 6;
    const nwProj12 = metrics.nw + monthlyNwDelta * 12;
    /* Expense breakdown by category */
    const expByCategory = {};
    cashflow.filter(c=>c.type==="EXPENSE").forEach(c=>{
      expByCategory[c.category] = (expByCategory[c.category]||0) + Number(c.amount);
    });
    const expBreakdown = Object.entries(expByCategory)
      .map(([cat,val])=>({cat, label:CF_CATEGORIES[cat]||cat, value:val, pct: monthlyExpense>0?(val/monthlyExpense*100):0}))
      .sort((a,b)=>b.value-a.value);
    return {monthlyIncome, monthlyExpense, surplus, savingsRate, proj3, proj6, proj12, loanPayments, monthlyNwDelta, nwProj3, nwProj6, nwProj12, expBreakdown};
  }, [cashflow, metrics.liquid, metrics.nw]);

  /* ─── Cash-flow CRUD ─── */
  const saveCf = () => {
    if(!cfForm.name||!cfForm.amount) return;
    const finalCat = cfForm.category === "__CUSTOM__" ? (cfCustomCat.trim() || "Vlastná") : cfForm.category;
    if(cfEditId){
      setCashflow(prev=>prev.map(c=>c.id===cfEditId?{...c,name:cfForm.name,amount:Number(cfForm.amount),type:cfForm.type,category:finalCat}:c));
      show("Položka bola aktualizovaná!");
    } else {
      setCashflow(prev=>[...prev,{id:"cf"+Date.now(),name:cfForm.name,amount:Number(cfForm.amount),type:cfForm.type,category:finalCat}]);
      show("Položka bola pridaná!");
    }
    setCfForm({name:"",amount:"",type:"INCOME",category:"SALARY"});
    setCfEditId(null);
    setCfCustomCat("");
  };
  const editCf = (item) => {
    setCfEditId(item.id);
    setCfForm({name:item.name,amount:String(item.amount),type:item.type,category:item.category});
  };
  const deleteCf = (id) => {
    setCashflow(prev=>prev.filter(c=>c.id!==id));
    show("Položka bola odstránená!");
  };

  /* ─── Cash-flow drag-and-drop ─── */
  const handleCfDragStart = (e, id) => {
    setCfDragId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    requestAnimationFrame(() => { if(e.target) e.target.style.opacity = "0.4"; });
  };
  const handleCfDragEnd = (e) => {
    e.target.style.opacity = "1";
    setCfDragId(null);
    setCfDragOverId(null);
  };
  const handleCfDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if(id !== cfDragOverId) setCfDragOverId(id);
  };
  const handleCfDrop = (e, targetId) => {
    e.preventDefault();
    if(!cfDragId || cfDragId === targetId) { setCfDragId(null); setCfDragOverId(null); return; }
    setCashflow(prev => {
      const arr = [...prev];
      const fromIdx = arr.findIndex(c => c.id === cfDragId);
      const toIdx = arr.findIndex(c => c.id === targetId);
      if(fromIdx === -1 || toIdx === -1) return prev;
      if(arr[fromIdx].type !== arr[toIdx].type) return prev;
      const [item] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, item);
      return arr;
    });
    setCfDragId(null);
    setCfDragOverId(null);
  };

  const sortedCf = (type) => {
    const items = cashflow.filter(c=>c.type===type);
    if(!cfSort) return items;
    return [...items].sort((a,b)=>cfSort==="asc"?a.amount-b.amount:b.amount-a.amount);
  };

  const toggleCfSort = () => setCfSort(prev => prev === null ? "desc" : prev === "desc" ? "asc" : null);

  /* Dynamické custom kategórie z existujúcich položiek */
  const cfCustomIncomeCats = useMemo(() => {
    const builtIn = new Set([...CF_INCOME_CATS]);
    return [...new Set(cashflow.filter(c=>c.type==="INCOME"&&!builtIn.has(c.category)).map(c=>c.category))];
  }, [cashflow]);
  const cfCustomExpenseCats = useMemo(() => {
    const builtIn = new Set([...CF_EXPENSE_CATS]);
    return [...new Set(cashflow.filter(c=>c.type==="EXPENSE"&&!builtIn.has(c.category)).map(c=>c.category))];
  }, [cashflow]);

  /* ─── Alerty CRUD ─── */
  const saveAlert = () => {
    if(!alertForm.name||!alertForm.value) return;
    if(alertEditId){
      setAlerts(prev=>prev.map(a=>a.id===alertEditId?{...a,name:alertForm.name,metric:alertForm.metric,condition:alertForm.condition,value:Number(alertForm.value),triggered:false}:a));
      show("Alert bol aktualizovaný!");
    } else {
      setAlerts(prev=>[...prev,{id:"al"+Date.now(),name:alertForm.name,metric:alertForm.metric,condition:alertForm.condition,value:Number(alertForm.value),triggered:false}]);
      show("Alert bol pridaný!");
    }
    setAlertForm({name:"",metric:"NW",condition:"ABOVE",value:""});
    setAlertEditId(null);
  };
  const editAlert = (item) => {
    setAlertEditId(item.id);
    setAlertForm({name:item.name,metric:item.metric,condition:item.condition,value:String(item.value)});
  };
  const deleteAlert = (id) => {
    setAlerts(prev=>prev.filter(a=>a.id!==id));
    show("Alert bol odstránený!");
  };

  /* ─── Kontrola alertov ─── */
  const btcPrice = cryptoPrices["bitcoin"]?.eur || 0;
  useEffect(() => {
    if(alerts.length === 0) return;
    const getVal = (metric) => {
      if(metric==="NW") return metrics.nw;
      if(metric==="ASSETS") return metrics.assets;
      if(metric==="RUNWAY") return Number(metrics.runway);
      if(metric==="BTC") return btcPrice;
      return 0;
    };
    setAlerts(prev => {
      let changed = false;
      const next = prev.map(a => {
        const cur = getVal(a.metric);
        const met = a.condition === "ABOVE" ? cur >= a.value : cur <= a.value;
        if(met && !a.triggered) {
          changed = true;
          show(`Alert: ${a.name}`, "success");
          return {...a, triggered: true};
        }
        if(!met && a.triggered) {
          changed = true;
          return {...a, triggered: false};
        }
        return a;
      });
      return changed ? next : prev;
    });
  }, [metrics.nw, metrics.assets, metrics.runway, btcPrice]);

  const goalProgress = settings.financialGoal>0?Math.min((metrics.nw/settings.financialGoal)*100,100):0;

  /* ────────────────── JSX ────────────────── */

  /* Loading splash */
  if(authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950">
      <div className="text-center">
        <div className="login-enter-1 login-glow w-20 h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 rounded-3xl flex items-center justify-center mx-auto mb-5">
          <Wallet size={34} className="text-white drop-shadow-lg"/>
        </div>
        <h1 className="login-enter-1 text-sm font-bold text-emerald-400 uppercase tracking-[0.3em] mb-1">Personal Finance</h1>
        <h2 className="login-enter-2 text-2xl font-black text-white tracking-tight">Dashboard</h2>
        <Loader2 size={20} className="text-emerald-500 animate-spin mx-auto mt-6"/>
      </div>
    </div>
  );

  /* Login / Register screen */
  if(!user) return (
    <div className="min-h-svh flex items-start sm:items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 pt-10 pb-6 sm:py-6 relative overflow-hidden">
      {/* Floating ambient orbs */}
      <div className="login-orb absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none"/>
      <div className="login-orb-2 absolute bottom-[20%] right-[5%] w-80 h-80 rounded-full bg-emerald-400/6 blur-3xl pointer-events-none"/>
      <div className="login-orb-3 absolute top-[60%] left-[50%] w-48 h-48 rounded-full bg-teal-500/5 blur-3xl pointer-events-none"/>

      <div className="w-full max-w-md relative z-10">
        {/* Logo + title */}
        <div className="text-center mb-6 sm:mb-10">
          <div className="login-enter-1 login-glow w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Wallet size={28} className="text-white drop-shadow-lg sm:hidden"/>
            <Wallet size={34} className="text-white drop-shadow-lg hidden sm:block"/>
          </div>
          <h1 className="login-enter-1 text-xs sm:text-sm font-bold text-emerald-400 uppercase tracking-[0.25em] sm:tracking-[0.3em] mb-1.5 sm:mb-2">Personal Finance</h1>
          <h2 className="login-enter-2 text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">Dashboard</h2>
          <div className="login-quote mt-4 sm:mt-5 max-w-xs mx-auto px-2">
            <p className="text-xs sm:text-sm text-slate-400 italic leading-relaxed">&ldquo;{loginQuote.text}&rdquo;</p>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-1 sm:mt-1.5 font-medium">— {loginQuote.author}</p>
          </div>
        </div>

        {/* Card */}
        <div className="login-enter-3 bg-slate-800/60 backdrop-blur-2xl border border-slate-700/50 rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-2xl shadow-black/20">
          {/* Toggle */}
          <div className="flex bg-slate-700/40 rounded-2xl p-1 mb-6">
            <button onClick={()=>{setAuthMode("login");setAuthError("");}} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${authMode==="login"?"bg-emerald-600 text-white shadow-lg shadow-emerald-500/25":"text-slate-400 hover:text-white"}`}>
              Prihlásenie
            </button>
            <button onClick={()=>{setAuthMode("register");setAuthError("");}} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${authMode==="register"?"bg-emerald-600 text-white shadow-lg shadow-emerald-500/25":"text-slate-400 hover:text-white"}`}>
              Registrácia
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label htmlFor="auth-email" className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input
                  id="auth-email" name="email"
                  type="email" required autoComplete="email"
                  value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})}
                  placeholder="vas@email.sk"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-700/40 border border-slate-600/50 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-500 transition-all"
                />
              </div>
            </div>
            <div>
              <label htmlFor="auth-password" className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Heslo</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input
                  id="auth-password" name="password"
                  type={showPw?"text":"password"} required autoComplete={authMode==="login"?"current-password":"new-password"}
                  value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})}
                  placeholder={authMode==="register"?"Minimálne 6 znakov":"Vaše heslo"}
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-700/40 border border-slate-600/50 text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-500 transition-all"
                />
                <button type="button" onClick={()=>setShowPw(!showPw)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPw?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </div>

            {authError&&(
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <AlertTriangle size={14}/> {authError}
              </div>
            )}

            <button type="submit" disabled={authBusy} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 text-white py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]">
              {authBusy&&<Loader2 size={16} className="animate-spin"/>}
              {authMode==="login"?"Prihlásiť sa":"Vytvoriť účet"}
            </button>
          </form>
        </div>

        <p className="login-enter-4 text-center text-xs text-slate-500 mt-4 sm:mt-6">
          {authMode==="login"?"Nemáte účet? ":"Už máte účet? "}
          <button onClick={()=>{setAuthMode(authMode==="login"?"register":"login");setAuthError("");}} className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
            {authMode==="login"?"Zaregistrujte sa":"Prihláste sa"}
          </button>
        </p>

        <p className="login-enter-5 text-center text-[11px] text-slate-600 mt-5 sm:mt-8">
          {"Built with \u2764\uFE0F by Edo"}
        </p>
      </div>
    </div>
  );

  /* Loading user data from Firestore */
  if(!dataLoaded) return (
    <div className={`min-h-screen flex items-center justify-center ${dark?"bg-slate-900":"bg-gradient-to-br from-slate-50 to-slate-100"}`}>
      <div className="text-center">
        <Loader2 size={24} className="text-emerald-500 animate-spin mx-auto mb-3"/>
        <p className={`text-sm font-semibold ${dark?"text-slate-300":"text-slate-600"}`}>Načítavam údaje...</p>
      </div>
    </div>
  );

  /* ── Welcome screen — prvé 2 prihlásenia ── */
  if(showWelcome) return (
    <div className="min-h-svh flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 relative overflow-hidden">
      <div className="login-orb absolute top-[15%] left-[10%] w-64 h-64 rounded-full bg-emerald-500/8 blur-3xl pointer-events-none"/>
      <div className="login-orb-2 absolute bottom-[20%] right-[5%] w-80 h-80 rounded-full bg-emerald-400/6 blur-3xl pointer-events-none"/>
      <div className="w-full max-w-sm text-center relative z-10">
        <div className="login-enter-1 login-glow w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-700 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-8">
          <Wallet size={30} className="text-white drop-shadow-lg"/>
        </div>
        <h1 className="login-enter-2 text-2xl sm:text-3xl font-black text-white tracking-tight mb-6">Ahoj.</h1>
        <div className="login-enter-3 space-y-3 mb-10">
          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">Super, že si tu.</p>
          <p className="text-sm text-slate-400 leading-relaxed">Ide o prvú verziu —<br/>spätná väzba je vítaná :)</p>
          <p className="text-sm text-slate-400 mt-4">Ďakujem.</p>
          <p className="text-sm text-emerald-400 font-semibold italic">Edo</p>
        </div>
        <button
          onClick={()=>setShowWelcome(false)}
          className="login-enter-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-8 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/25 transition-all duration-300 active:scale-[0.97]"
        >
          Ok, poďme na to
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${dark?"bg-slate-900 text-white":"bg-gradient-to-br from-slate-50 to-slate-100"} pb-20 transition-colors duration-300`}>
      {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}
      <input type="file" ref={fileInputRef} accept=".json" className="hidden" onChange={importJSON}/>

      {/* ── HEADER ── */}
      <header className={`sticky top-0 z-40 print-hidden ${dark?"bg-slate-800/95 border-slate-700":"bg-white/95 border-slate-200"} backdrop-blur-xl border-b`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Wallet size={18} className="text-white"/>
            </div>
            <div>
              <h1 className={`text-lg font-extrabold tracking-tight ${dark?"text-white":"text-slate-800"}`}>FIDU</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest -mt-0.5">Financial Dashboard</p>
            </div>
            <div className={`hidden md:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-xl ${dark?"bg-slate-700/50":"bg-slate-50"} border ${dark?"border-slate-600":"border-slate-200"}`}>
              <Calendar size={13} className="text-emerald-500"/>
              <span className={`text-xs font-semibold tabular-nums ${dark?"text-slate-300":"text-slate-600"}`}>
                {now.toLocaleDateString("sk-SK",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
              </span>
              <span className={`text-xs font-bold tabular-nums ${dark?"text-white":"text-slate-800"}`}>
                {now.toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"})}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {user&&(
              <div className={`flex items-center gap-1.5 sm:gap-2 mr-0.5 sm:mr-1 px-2 sm:px-3 py-1.5 rounded-xl ${dark?"bg-slate-700/50 border-slate-600":"bg-slate-50 border-slate-200"} border`}>
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {user.email[0].toUpperCase()}
                </div>
                <span className={`hidden md:block text-xs font-semibold truncate max-w-[140px] ${dark?"text-slate-300":"text-slate-600"}`}>{user.email}</span>
                <button onClick={handleLogout} title="Odhlásiť sa" className={`p-1.5 rounded-lg transition-all ${dark?"text-slate-400 hover:text-rose-400 hover:bg-slate-600":"text-slate-400 hover:text-rose-600 hover:bg-rose-50"}`}>
                  <LogOut size={14}/>
                </button>
              </div>
            )}
            <button onClick={()=>setDark(!dark)} className={`p-2 sm:p-2.5 rounded-xl border transition-all ${dark?"border-slate-600 text-yellow-400 hover:bg-slate-700":"border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {dark?<Sun size={16}/>:<Moon size={16}/>}
            </button>
            <button onClick={()=>setReportsOpen(true)} className={`p-2 sm:p-2.5 rounded-xl border transition-all ${dark?"border-slate-600 text-slate-300 hover:bg-slate-700":"border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <BarChart3 size={16}/>
            </button>
            <button onClick={exportComprehensivePDF} title="Stiahnuť kompletný PDF" className={`p-2 sm:p-2.5 rounded-xl border transition-all ${dark?"border-slate-600 text-emerald-400 hover:bg-slate-700":"border-emerald-200 text-emerald-600 hover:bg-emerald-50"}`}>
              <Download size={16}/>
            </button>
            <button onClick={()=>setSettingsOpen(true)} className={`p-2 sm:p-2.5 rounded-xl border transition-all ${dark?"border-slate-600 text-slate-300 hover:bg-slate-700":"border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              <Settings size={16}/>
            </button>
          </div>
        </div>
      </header>

      <main ref={dashboardRef} className="max-w-7xl mx-auto px-4 py-6 space-y-6 print-hidden">

        {/* ── SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {label:"Čisté imanie",value:metrics.nw,icon:<Target size={18}/>,iconCls:"bg-emerald-50 text-emerald-500",prev:metrics.lastVal,prevLabel:metrics.lastDate?`Od ${metrics.lastDate}`:null},
            {label:"Aktíva",value:metrics.assets,icon:<TrendingUp size={18}/>,iconCls:"bg-blue-50 text-blue-500"},
            {label:"Záväzky",value:metrics.liab+metrics.totalExp,icon:<CreditCard size={18}/>,iconCls:"bg-rose-50 text-rose-500",neg:true},
            {label:"Runway",value:null,displayValue:`${metrics.runway} mes.`,icon:<Clock size={18}/>,iconCls:"bg-amber-50 text-amber-500",sub:`pri ${fmt(settings.monthlyBurn)}/mes`},
          ].map((card,i)=>(
            <div key={i} className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-400":"text-slate-500"}`}>{card.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconCls}`}>
                  {card.icon}
                </div>
              </div>
              <div className={`text-lg sm:text-2xl font-extrabold ${dark?"text-white":"text-slate-800"} tabular-nums`}>
                {card.neg?"-":""}{card.displayValue||fmt(card.value)}
              </div>
              {card.sub&&<p className="text-[10px] text-slate-400 mt-1 font-medium">{card.sub}</p>}
              {card.prev!=null&&<div className="mt-2"><ChangeBadge current={card.value} previous={card.prev} label={card.prevLabel}/></div>}
            </div>
          ))}
        </div>

        {/* ── GOAL PROGRESS ── */}
        {settings.financialGoal>0&&(
          <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-emerald-500"/>
                <span className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Finančný cieľ</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">{goalProgress.toFixed(1)}%</span>
            </div>
            <div className={`h-3 rounded-full overflow-hidden ${dark?"bg-slate-700":"bg-slate-100"}`}>
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-1000" style={{width:`${goalProgress}%`}}/>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-medium">
              <span>{fmt(metrics.nw)}</span>
              <span>{fmt(settings.financialGoal)}</span>
            </div>
          </div>
        )}

        {/* ── CHARTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`lg:col-span-2 ${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Vývoj čistého imania</h3>
              <BarChart3 size={16} className="text-slate-400"/>
            </div>
            <AreaChart data={history} dark={dark} compareDate={compareDate} onCompare={setCompareDate}/>

            {/* ── Porovnávací panel ── */}
            {compareDate && (()=>{
              const cSnap = history.find(h=>h.date===compareDate);
              const lastSnap = history[history.length-1];
              if(!cSnap||!lastSnap) return null;
              const cDate = new Date(cSnap.date).toLocaleDateString("sk-SK",{day:"numeric",month:"short",year:"numeric"});
              const rows = [
                {l:"Čisté imanie",a:cSnap.value,b:lastSnap.value,c:"emerald"},
                {l:"Aktíva",a:cSnap.assets,b:lastSnap.assets||metrics.assets,c:"blue"},
                {l:"Záväzky",a:(cSnap.liab||0)+(cSnap.totalExp||0),b:(lastSnap.liab||0)+(lastSnap.totalExp||0)||metrics.liab+metrics.totalExp,c:"rose",neg:true},
                {l:"Likvidné",a:cSnap.liquid,b:lastSnap.liquid||metrics.liquid,c:"cyan"},
                {l:"Runway",a:cSnap.runway,b:lastSnap.runway||metrics.runway,c:"amber",suf:" mes.",raw:true},
              ];
              return (
                <div className={`mt-4 rounded-xl border p-4 ${dark?"bg-slate-700/40 border-slate-600":"bg-gradient-to-r from-purple-50/50 to-blue-50/50 border-purple-100"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight size={14} className="text-purple-500"/>
                      <span className={`text-xs font-bold ${dark?"text-white":"text-slate-700"}`}>Porovnanie: {cDate} → Dnes</span>
                    </div>
                    <button onClick={()=>setCompareDate(null)} className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${dark?"text-slate-400 hover:text-rose-400 hover:bg-slate-600":"text-slate-500 hover:text-rose-600 hover:bg-rose-50"}`}>
                      <X size={12}/>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {rows.map(r=>{
                      const diff = r.raw ? (Number(r.b)||0) - (Number(r.a)||0) : (r.b||0) - (r.a||0);
                      const displayDiff = r.neg ? -diff : diff;
                      const pos = displayDiff >= 0;
                      return (
                        <div key={r.l} className={`text-center rounded-lg p-2 ${dark?"bg-slate-800/60":"bg-white/80"}`}>
                          <p className={`text-[10px] uppercase tracking-wider font-semibold ${dark?"text-slate-500":"text-slate-400"}`}>{r.l}</p>
                          <div className={`flex items-center justify-center gap-1 mt-1`}>
                            <span className={`text-[10px] tabular-nums ${dark?"text-slate-400":"text-slate-500"}`}>{r.neg?"-":""}{r.raw?(Number(r.a)||0).toFixed(1)+(r.suf||""):fmt(r.a||0)}</span>
                            <ArrowUp size={8} className={`text-${r.c}-500 rotate-90`}/>
                            <span className={`text-xs font-bold tabular-nums text-${r.c}-${dark?"400":"600"}`}>{r.neg?"-":""}{r.raw?(Number(r.b)||0).toFixed(1)+(r.suf||""):fmt(r.b||0)}</span>
                          </div>
                          <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${pos?"text-emerald-500":"text-rose-500"}`}>
                            {pos?"+":""}{r.raw?displayDiff.toFixed(1)+(r.suf||""):fmt(displayDiff)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── História záznamov ── */}
            {history.length>0&&(
              <div className={`mt-6 pt-5 border-t ${dark?"border-slate-700":"border-slate-200"}`}>
                <button onClick={()=>{setHistoryOpen(!historyOpen);setHistoryDetail(null);}} className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors ${dark?"text-slate-300 hover:text-emerald-400":"text-slate-600 hover:text-emerald-600"}`}>
                  <ChevronRight size={14} className={`transition-transform ${historyOpen?"rotate-90":""}`}/>
                  <Clock size={14}/>
                  História záznamov
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dark?"bg-slate-700 text-slate-400":"bg-slate-100 text-slate-500"}`}>{history.length}</span>
                </button>
                {historyOpen&&(
                  <div className={`mt-3 rounded-xl border overflow-hidden ${dark?"border-slate-700":"border-slate-200"}`}>
                    <div className={`max-h-72 overflow-y-auto`}>
                      {[...history].reverse().map((snap,i,arr)=>{
                        const prev=i<arr.length-1?arr[i+1]:null;
                        const d=new Date(snap.date);
                        const dateStr=d.toLocaleDateString("sk-SK",{day:"numeric",month:"short",year:"numeric"});
                        const timeStr=d.toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"});
                        const diff=prev?(snap.value-prev.value):0;
                        const pct=prev&&prev.value?(diff/prev.value*100):0;
                        const dayNote=notes[snap.date.split("T")[0]];
                        const isOpen=historyDetail===snap.date;
                        return (
                          <div key={snap.date}>
                            <button
                              onClick={()=>setHistoryDetail(isOpen?null:snap.date)}
                              className={`w-full flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-colors ${dark?"hover:bg-slate-700/50 border-slate-700":"hover:bg-slate-50 border-slate-100"} ${i>0?"border-t":""}`}
                            >
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${snap.auto?"bg-blue-400":"bg-emerald-500"}`} title={snap.auto?"Auto-save":"Manuálny"}/>
                                <div>
                                  <span className={`text-xs font-bold ${dark?"text-slate-200":"text-slate-700"}`}>{dateStr}</span>
                                  <span className={`text-[10px] ml-1.5 ${dark?"text-slate-500":"text-slate-400"}`}>{timeStr}</span>
                                  {dayNote&&<span className="ml-1.5 text-[10px] text-amber-500" title="Obsahuje poznámku">&#9679;</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 sm:gap-3 ml-[18px] sm:ml-0 mt-0.5 sm:mt-0">
                                <span className={`text-xs font-extrabold tabular-nums ${dark?"text-white":"text-slate-800"}`}>{fmt(snap.value)}</span>
                                {prev&&(
                                  <span className={`text-[10px] font-bold tabular-nums ${diff>=0?"text-emerald-600":"text-rose-600"}`}>
                                    {diff>=0?"+":""}{fmt(diff)} ({pct>=0?"+":""}{pct.toFixed(1)}%)
                                  </span>
                                )}
                                <ChevronRight size={12} className={`transition-transform ${dark?"text-slate-500":"text-slate-400"} ${isOpen?"rotate-90":""}`}/>
                              </div>
                            </button>
                            {isOpen&&(
                              <div className={`px-4 pb-3 pt-2 ${dark?"bg-slate-700/30":"bg-slate-50/80"}`}>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
                                  {[
                                    {l:"Aktíva",v:snap.assets,c:"text-blue-600",pv:prev?.assets},
                                    {l:"Pasíva",v:snap.liab+snap.totalExp,c:"text-rose-600",neg:true,pv:prev?(prev.liab+prev.totalExp):undefined},
                                    {l:"Likvidné",v:snap.liquid,c:"text-cyan-600",pv:prev?.liquid},
                                    {l:"Runway",v:snap.runway,c:dark?"text-amber-400":"text-amber-600",suf:" mes.",raw:true},
                                  ].map(m=>(
                                    <div key={m.l} className="text-center">
                                      <p className={`text-[11px] uppercase tracking-wider font-semibold ${dark?"text-slate-500":"text-slate-400"}`}>{m.l}</p>
                                      <p className={`text-xs font-bold tabular-nums ${m.c}`}>
                                        {m.neg?"-":""}{m.raw?m.v+(m.suf||""):fmt(m.v)}
                                      </p>
                                      {m.pv!=null&&!m.raw&&(()=>{
                                        const d2=m.v-m.pv;
                                        if(d2===0) return null;
                                        return <p className={`text-[11px] tabular-nums ${(m.neg?-d2:d2)>=0?"text-emerald-500":"text-rose-500"}`}>{(m.neg?-d2:d2)>=0?"+":""}{fmt(m.neg?-d2:d2)}</p>;
                                      })()}
                                    </div>
                                  ))}
                                </div>
                                {dayNote&&(
                                  <div className={`mt-2 px-3 py-2 rounded-lg text-xs italic ${dark?"bg-slate-700 text-slate-300":"bg-white text-slate-600 border border-slate-200"}`}>
                                    <MessageSquare size={11} className="inline mr-1.5 text-amber-500 -mt-0.5"/>{dayNote}
                                  </div>
                                )}
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    onClick={(e)=>{e.stopPropagation();setCompareDate(compareDate===snap.date?null:snap.date);}}
                                    className={`flex items-center gap-1.5 text-[10px] font-semibold transition-colors px-2 py-1 rounded-lg ${compareDate===snap.date?"text-purple-600 bg-purple-50 hover:bg-purple-100":"text-purple-500 hover:text-purple-700 hover:bg-purple-50"}`}
                                  >
                                    <ArrowLeftRight size={12}/> {compareDate===snap.date?"Zrušiť porovnanie":"Porovnať"}
                                  </button>
                                  <button
                                    onClick={(e)=>{e.stopPropagation();if(!confirm(`Vymazať záznam z ${dateStr}?`))return;setHistory(prev=>prev.filter(h=>h.date!==snap.date));setHistoryDetail(null);show("Záznam vymazaný");}}
                                    className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500 hover:text-rose-700 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50"
                                  >
                                    <Trash2 size={12}/> Vymazať
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border p-5 shadow-sm flex flex-col items-center`}>
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Alokácia aktív</h3>
              <PieChart size={16} className="text-slate-400"/>
            </div>
            <Donut data={metrics.cd} total={metrics.assets} dark={dark}/>
            <div className="mt-4 w-full space-y-2">
              {metrics.cd.map((item,i)=>(
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor:item.color}}/>
                    <span className={`text-xs font-medium ${dark?"text-slate-300":"text-slate-600"}`}>{item.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${dark?"text-white":"text-slate-800"}`}>{fmt(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ACCOUNTS ── */}
        <div className={`rounded-2xl border overflow-hidden ${dark?"bg-slate-800/30 border-slate-700":"bg-slate-50/50 border-slate-200"} shadow-sm`}>
          {/* Aktíva master header */}
          <div className={`flex items-center justify-between px-5 py-4 ${dark?"bg-slate-800":"bg-white"} border-b ${dark?"border-slate-700":"border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-sm">
                <TrendingUp size={18} className="text-white"/>
              </div>
              <div>
                <h3 className={`text-base font-bold ${dark?"text-white":"text-slate-800"}`}>Aktíva</h3>
                <p className="text-[10px] text-slate-400 font-medium">{accounts.filter(a=>a.category!=="DEBT").length} účtov · {fmt(metrics.assets)}</p>
              </div>
            </div>
            <button onClick={()=>openAdd("ACCOUNT")} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all">
              <Plus size={14}/> Pridať účet
            </button>
          </div>

          {/* Kategórie vnútri */}
          <div className="p-3 space-y-3">
            {(()=>{const customCats=[...new Set(accounts.filter(a=>a.category!=="DEBT"&&!BUILTIN_CATS.includes(a.category)).map(a=>a.category))];return[...BUILTIN_CATS,...customCats];})().map(cat=>{
              const catAccs=accounts.filter(a=>a.category===cat);
              if(catAccs.length===0) return null;
              const catSum=catAccs.reduce((s,a)=>s+Number(a.balance),0);
              const catPct=metrics.assets>0?(catSum/metrics.assets*100).toFixed(1):"0.0";
              const cs=CAT_STYLE[cat]||{color:"#8b5cf6",bg:"bg-violet-50",border:"border-violet-200",text:"text-violet-700",badge:"bg-violet-100 text-violet-700",icon:"bg-violet-500"};
              return (
                <div key={cat} className={`rounded-xl border overflow-hidden ${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-200/60"}`}>
                  {/* Kategória header */}
                  <div className={`flex items-center justify-between px-4 py-2.5`} style={{borderLeft:`3px solid ${cs.color}`}}>
                    <div className="flex items-center gap-2.5">
                      <h4 className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-300":"text-slate-500"}`}>{CATEGORY_LABELS[cat]||cat}</h4>
                      <span className="text-[10px] text-slate-400">({catAccs.length})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-extrabold ${dark?"text-white":"text-slate-800"} tabular-nums`}>{fmt(catSum)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${cs.badge}`}>{catPct} %</span>
                    </div>
                  </div>
                  {/* Účty */}
                  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 pt-0 ${dark?"bg-slate-800":"bg-white"}`}>
                    {catAccs.map(acc=>(
                      <div
                        key={acc.id}
                        draggable
                        onDragStart={e=>handleDragStart(e,acc.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e=>handleDragOver(e,acc.id)}
                        onDrop={e=>handleDrop(e,acc.id)}
                        className={`${dark?"bg-slate-700/50 border-slate-600 hover:bg-slate-700":"bg-slate-50/80 border-slate-100 hover:border-slate-200 hover:bg-white"} rounded-xl border p-4 hover:shadow-md transition-all ${dragOverId===acc.id&&dragId!==acc.id?"ring-2 ring-emerald-500 ring-offset-2 scale-[1.02]":""}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="hidden sm:block cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors -ml-1 mr-0.5 self-center" title="Potiahnite pre zmenu poradia">
                              <GripVertical size={16}/>
                            </div>
                            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${accIconClasses(acc.type,acc.category)}`}>
                              <AccIcon type={acc.type} category={acc.category}/>
                            </div>
                            <div>
                              <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>{acc.name}</h4>
                              <p className="text-[10px] text-slate-400 font-medium">{TYPE_LABELS[acc.type]||acc.type}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={()=>openEdit("ACCOUNT",acc)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Edit size={14}/></button>
                            <button onClick={()=>deleteAccount(acc.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                          </div>
                        </div>
                        <div className={`text-xl font-extrabold mt-3 tabular-nums ${dark?"text-white":"text-slate-800"}`}>
                          {fmt(acc.balance)}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <button onClick={()=>setExpanded(expanded===acc.id?null:acc.id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-emerald-600 font-semibold transition-colors">
                            <ChevronRight size={12} className={`transition-transform ${expanded===acc.id?"rotate-90":""}`}/>
                            Transakcie
                          </button>
                          <button onClick={()=>setNoteExpanded(noteExpanded===acc.id?null:acc.id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-600 font-semibold transition-colors">
                            <MessageSquare size={12} className={noteExpanded===acc.id?"text-amber-500":""}/>
                            Poznámka{acc.note?" •":""}
                          </button>
                        </div>
                        {expanded===acc.id&&<Transactions accountId={acc.id} transactions={acc.transactions||[]} onAdd={addTransaction} onDelete={deleteTransaction} dark={dark}/>}
                        {noteExpanded===acc.id&&(
                          <div className={`mt-3 border-t pt-3 ${dark?"border-slate-700":"border-slate-100"}`}>
                            <textarea
                              value={acc.note||""}
                              onChange={e=>updateAccountNote(acc.id,e.target.value)}
                              placeholder="Pridať poznámku..."
                              rows={2}
                              className={`w-full px-3 py-2.5 text-xs rounded-lg border outline-none resize-none focus:ring-2 focus:ring-amber-500/50 ${dark?"bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400"}`}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── STOCK PORTFOLIO (togglable, collapsible) ── */}
        {settings.showStocks && (
        <>
        <div className="mt-2"/>
        <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-sm overflow-hidden`}>
          <button
            onClick={() => setStocksExpanded(!stocksExpanded)}
            className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${dark?"hover:bg-slate-700/50":"hover:bg-slate-50"}`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <BarChart3 size={20}/>
              </div>
              <div className="text-left">
                <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>Akciové portfólio</h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {stockPortfolio.length > 0 ? `${stockPortfolio.length} akcií · ${fmt(stockTotal)}` : "Pridajte akcie manuálne"}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${stocksExpanded ? "rotate-90" : ""}`}/>
          </button>

          {stocksExpanded && (
            <div className={`px-5 pb-5 border-t ${dark?"border-slate-700":"border-slate-100"}`}>
              {/* Add stock form */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 mb-3">
                <input placeholder="Názov (Apple)" value={stockForm.name} onChange={e=>setStockForm({...stockForm,name:e.target.value})}
                  className={`px-3 py-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${dark?"bg-slate-700 border-slate-600 text-white placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
                <input placeholder="Ticker (AAPL)" value={stockForm.ticker} onChange={e=>setStockForm({...stockForm,ticker:e.target.value})}
                  className={`px-3 py-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${dark?"bg-slate-700 border-slate-600 text-white placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
                <input type="number" placeholder="Počet ks" value={stockForm.shares} onChange={e=>setStockForm({...stockForm,shares:e.target.value})}
                  className={`px-3 py-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${dark?"bg-slate-700 border-slate-600 text-white placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
                <div className="flex gap-2">
                  <input type="number" placeholder="Cena/ks €" value={stockForm.price} onChange={e=>setStockForm({...stockForm,price:e.target.value})}
                    className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-indigo-500 ${dark?"bg-slate-700 border-slate-600 text-white placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
                  <button onClick={addStock} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2.5 rounded-xl text-xs font-semibold transition-all">
                    <Plus size={14}/>
                  </button>
                </div>
              </div>
              {stockPortfolio.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {stockPortfolio.map(st => (
                    <div key={st.id} className={`${dark?"bg-slate-700/50 border-slate-600":"bg-slate-50 border-slate-100"} rounded-xl border p-4 hover:shadow-md transition-all group`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-extrabold tracking-tight shadow-sm bg-indigo-100 text-indigo-700">
                            {st.ticker || st.name.slice(0,3).toUpperCase()}
                          </div>
                          <div>
                            <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>{st.name}</h4>
                            <p className="text-[10px] text-slate-400 font-medium">{st.shares} ks</p>
                          </div>
                        </div>
                        <button onClick={() => removeStock(st.id)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={13}/></button>
                      </div>
                      <div className={`text-lg font-extrabold tabular-nums ${dark?"text-white":"text-slate-800"}`}>{fmtFull(st.shares * st.price)}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-slate-400 tabular-nums">1 ks = </span>
                        <input type="number" value={st.price} onChange={e=>updateStockPrice(st.id, e.target.value)}
                          className={`w-20 text-right text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200 text-slate-700"}`}
                          title="Aktualizovať cenu za kus"/>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        </>
        )}

        {/* ── CRYPTO PORTFOLIO (togglable, collapsible) ── */}
        {settings.showCrypto && (
        <>
        <div className="mt-2"/>
        <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-sm overflow-hidden`}>
          {(() => {
            const btcPriceLocal = cryptoPrices["bitcoin"]?.eur || 0;
            const valueInBtc = btcPriceLocal > 0 ? portfolioTotal / btcPriceLocal : 0;
            const cryptoCB = Number(settings.cryptoCostBasis)||0;
            const avgBtcCost = valueInBtc > 0 && cryptoCB > 0 ? cryptoCB / valueInBtc : 0;
            return (
              <button
                onClick={() => setCryptoExpanded(!cryptoExpanded)}
                className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${dark?"hover:bg-slate-700/50":"hover:bg-slate-50"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <Coins size={20}/>
                  </div>
                  <div className="text-left">
                    <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>Krypto portfólio</h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {portfolio.length > 0 ? `${portfolio.length} coinov` : "Pridajte mince ručne alebo importujte CSV"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap justify-end">
                  {portfolio.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700">
                        <Coins size={12}/> {fmt(portfolioTotal)}
                      </div>
                      {valueInBtc > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-orange-50 text-orange-700" title="Hodnota portfólia v BTC">
                          {valueInBtc.toFixed(4)} BTC
                        </div>
                      )}
                      {avgBtcCost > 0 && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${avgBtcCost <= btcPriceLocal ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`} title={`Priemerná cena za 1 BTC pri nákupných nákladoch ${fmt(cryptoCB)}`}>
                          ø {fmt(avgBtcCost)}/BTC
                        </div>
                      )}
                    </>
                  )}
                  <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${cryptoExpanded ? "rotate-90" : ""}`}/>
                </div>
              </button>
            );
          })()}

          {cryptoExpanded && (
            <div className={`px-5 pb-5 border-t ${dark?"border-slate-700":"border-slate-100"}`}>
              {/* Manuálne pridanie */}
              <div className={`mt-4 p-4 rounded-xl ${dark?"bg-slate-700/50":"bg-slate-50"}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pridať coin</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input type="text" placeholder="Názov (napr. Bitcoin)" value={cryptoForm.name} onChange={e=>setCryptoForm({...cryptoForm,name:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-amber-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  <input type="number" placeholder="Množstvo (ks)" value={cryptoForm.amount} onChange={e=>setCryptoForm({...cryptoForm,amount:e.target.value})} step="any"
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-amber-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  <div className="flex gap-2">
                    <button onClick={addToPortfolioManual} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-xs font-semibold transition-all">
                      <Plus size={14} className="inline -mt-0.5 mr-1"/>Pridať
                    </button>
                    <button onClick={() => portfolioFileRef.current?.click()} className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all flex items-center gap-1 ${dark?"border-slate-600 text-slate-300 hover:bg-slate-600":"border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                      <Upload size={13}/> CSV
                    </button>
                  </div>
                </div>
              </div>
              {portfolio.length > 0 && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                {portfolio.map(coin => {
                  const price = cryptoPrices[coin.cgId]?.eur || 0;
                  const change24h = cryptoPrices[coin.cgId]?.eur_24h_change || 0;
                  const value = price * coin.amount;
                  const cs = getCoinStyle(coin.cgId, coin.name);
                  return (
                    <div key={coin.cgId} className={`${dark?"bg-slate-700/50 border-slate-600":"bg-slate-50 border-slate-100"} rounded-xl border p-4 hover:shadow-md transition-all group`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-extrabold tracking-tight shadow-sm" style={{backgroundColor: cs.bg, color: cs.text}}>
                            {cs.abbr}
                          </div>
                          <div>
                            <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>{coin.name}</h4>
                            <p className="text-[10px] text-slate-400 font-medium">{coin.amount.toLocaleString("sk-SK", {maximumFractionDigits: 4})} ks</p>
                          </div>
                        </div>
                        <button onClick={() => removeFromPortfolio(coin.cgId)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={13}/></button>
                      </div>
                      <div className={`text-lg font-extrabold tabular-nums ${dark?"text-white":"text-slate-800"}`}>{fmtFull(value)}</div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-slate-400 tabular-nums">1 ks = {fmtFull(price)}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${change24h >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                          {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}
        </div>
        <input type="file" ref={portfolioFileRef} accept=".csv" className="hidden" onChange={importPortfolioCsv}/>
        </>
        )}

        {/* ── PASÍVA — Dlhy + Plánované výdavky ── */}
        <div className={`rounded-2xl border overflow-hidden ${dark?"bg-slate-800/50 border-slate-700":"bg-white border-slate-200/80"} shadow-sm`}>
          {/* Pasíva master header */}
          <div className={`flex flex-wrap items-center justify-between gap-2 px-5 py-4 ${dark?"bg-slate-800":"bg-white"} border-b ${dark?"border-slate-700":"border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center shadow-sm">
                <CreditCard size={18} className="text-white"/>
              </div>
              <div>
                <h3 className={`text-base font-bold ${dark?"text-white":"text-slate-800"}`}>Pasíva</h3>
                <p className="text-[10px] text-slate-400 font-medium">-{fmt(metrics.liab+metrics.totalExp)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={()=>openAdd("DEBT")} className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-rose-500/20 transition-all">
                <Plus size={14}/> Pridať dlh
              </button>
              <button onClick={()=>openAdd("EXPENSE")} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-orange-500/20 transition-all">
                <Plus size={14}/> Pridať výdavok
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Sub-sekcia: Dlhy */}
            {accounts.filter(a=>a.category==="DEBT").length>0&&(
              <div className={`rounded-xl border overflow-hidden ${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-200/60"}`}>
                <div className="flex items-center justify-between px-4 py-2.5" style={{borderLeft:"3px solid #ef4444"}}>
                  <div className="flex items-center gap-2.5">
                    <h4 className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-300":"text-slate-500"}`}>Dlhy / Záväzky</h4>
                    <span className="text-[10px] text-slate-400">({accounts.filter(a=>a.category==="DEBT").length})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-extrabold text-rose-600 tabular-nums`}>-{fmt(metrics.liab)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">{(metrics.liab+metrics.totalExp)>0?(metrics.liab/(metrics.liab+metrics.totalExp)*100).toFixed(1):"0.0"} %</span>
                  </div>
                </div>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 pt-0 ${dark?"bg-slate-800":"bg-white"}`}>
                  {accounts.filter(a=>a.category==="DEBT").map(acc=>(
                    <div
                      key={acc.id}
                      draggable
                      onDragStart={e=>handleDragStart(e,acc.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e=>handleDragOver(e,acc.id)}
                      onDrop={e=>handleDrop(e,acc.id)}
                      className={`${dark?"bg-slate-700/50 border-slate-600 hover:bg-slate-700":"bg-white border-slate-100 hover:border-slate-200"} rounded-xl border p-4 hover:shadow-md transition-all ${dragOverId===acc.id?"ring-2 ring-rose-500 ring-offset-2 scale-[1.02]":""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="hidden sm:block cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors -ml-1 mr-0.5 self-center" title="Potiahnite pre zmenu poradia">
                            <GripVertical size={16}/>
                          </div>
                          <div className="w-10 h-10 rounded-xl border flex items-center justify-center bg-rose-50 text-rose-600 border-rose-100">
                            <CreditCard size={20}/>
                          </div>
                          <div>
                            <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>{acc.name}</h4>
                            <p className="text-[10px] text-slate-400 font-medium">{TYPE_LABELS[acc.type]||acc.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={()=>openEdit("DEBT",acc)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Edit size={14}/></button>
                          <button onClick={()=>deleteAccount(acc.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                        </div>
                      </div>
                      <div className="text-xl font-extrabold mt-3 text-rose-600 tabular-nums">-{fmt(acc.balance)}</div>
                      <button onClick={()=>setNoteExpanded(noteExpanded===acc.id?null:acc.id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-600 font-semibold mt-2 transition-colors">
                        <MessageSquare size={12} className={noteExpanded===acc.id?"text-amber-500":""}/>
                        Poznámka{acc.note?" •":""}
                      </button>
                      {noteExpanded===acc.id&&(
                        <div className={`mt-3 border-t pt-3 ${dark?"border-slate-700":"border-slate-100"}`}>
                          <textarea
                            value={acc.note||""}
                            onChange={e=>updateAccountNote(acc.id,e.target.value)}
                            placeholder="Pridať poznámku..."
                            rows={2}
                            className={`w-full px-3 py-2.5 text-xs rounded-lg border outline-none resize-none focus:ring-2 focus:ring-amber-500/50 ${dark?"bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400"}`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub-sekcia: Plánované výdavky */}
            <div className={`rounded-xl border overflow-hidden ${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-200/60"}`}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{borderLeft:"3px solid #f97316"}}>
                <div className="flex items-center gap-2.5">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-300":"text-slate-500"}`}>Plánované výdavky</h4>
                  <span className="text-[10px] text-slate-400">({expenses.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-extrabold text-orange-600 tabular-nums`}>-{fmt(metrics.totalExp)}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 text-orange-700">{(metrics.liab+metrics.totalExp)>0?(metrics.totalExp/(metrics.liab+metrics.totalExp)*100).toFixed(1):"0.0"} %</span>
                </div>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 pt-0 ${dark?"bg-slate-800":"bg-white"}`}>
                {expenses.map(exp=>(
                  <div
                    key={exp.id}
                    draggable
                    onDragStart={e=>handleExpDragStart(e,exp.id)}
                    onDragEnd={handleExpDragEnd}
                    onDragOver={e=>handleExpDragOver(e,exp.id)}
                    onDrop={e=>handleExpDrop(e,exp.id)}
                    className={`${dark?"bg-slate-700/50 border-slate-600 hover:bg-slate-700":"bg-white border-slate-100 hover:border-slate-200"} rounded-xl border p-4 hover:shadow-md transition-all ${expDragOverId===exp.id&&expDragId!==exp.id?"ring-2 ring-orange-500 ring-offset-2 scale-[1.02]":""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:block cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors -ml-1 mr-0.5 self-center" title="Potiahnite pre zmenu poradia">
                          <GripVertical size={16}/>
                        </div>
                        <div>
                          <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>{exp.name}</h4>
                          <p className="text-[10px] text-slate-400 font-medium">{EXP_CATEGORIES[exp.category]||exp.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>openEdit("EXPENSE",exp)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Edit size={14}/></button>
                        <button onClick={()=>deleteExpense(exp.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>
                    <div className="text-xl font-extrabold mt-3 text-orange-600 tabular-nums">-{fmt(exp.amount)}</div>
                    <button onClick={()=>setNoteExpanded(noteExpanded===exp.id?null:exp.id)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-600 font-semibold mt-2 transition-colors">
                      <MessageSquare size={12} className={noteExpanded===exp.id?"text-amber-500":""}/>
                      Poznámka{exp.note?" •":""}
                    </button>
                    {noteExpanded===exp.id&&(
                      <div className={`mt-3 border-t pt-3 ${dark?"border-slate-700":"border-slate-100"}`}>
                        <textarea
                          value={exp.note||""}
                          onChange={e=>updateExpenseNote(exp.id,e.target.value)}
                          placeholder="Pridať poznámku..."
                          rows={2}
                          className={`w-full px-3 py-2.5 text-xs rounded-lg border outline-none resize-none focus:ring-2 focus:ring-amber-500/50 ${dark?"bg-slate-700 border-slate-600 text-slate-200 placeholder-slate-500":"bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400"}`}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {expenses.length===0&&(
                  <div className={`col-span-full p-8 text-center text-slate-400`}>
                    <CreditCard size={24} className="mx-auto mb-2 opacity-50"/>
                    <p className="text-sm font-medium">Žiadne plánované výdavky</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── CASH-FLOW ── */}
        <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-sm overflow-hidden`}>
          <button onClick={()=>setCashflowOpen(!cashflowOpen)} className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${dark?"hover:bg-slate-700/50":"hover:bg-slate-50"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                <Repeat size={20}/>
              </div>
              <div className="text-left">
                <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>Mesačný cash-flow</h3>
                <p className="text-[10px] text-slate-400 font-medium">{cashflow.length > 0 ? `${cashflow.length} položiek` : "Pridajte príjmy a opakované výdavky"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {cashflow.length > 0 && (
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfMetrics.surplus >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                  {cfMetrics.surplus >= 0 ? "+" : ""}{fmt(cfMetrics.surplus)}/mes
                </span>
              )}
              <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${cashflowOpen ? "rotate-90" : ""}`}/>
            </div>
          </button>

          {cashflowOpen && (
            <div className={`px-5 pb-5 border-t ${dark?"border-slate-700":"border-slate-100"}`}>
              {/* Pridať / Editovať */}
              <div className={`mt-4 p-4 rounded-xl ${dark?"bg-slate-700/50":"bg-slate-50"}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{cfEditId ? "Upraviť položku" : "Pridať položku"}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  <input type="text" placeholder="Názov" value={cfForm.name} onChange={e=>setCfForm({...cfForm,name:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-violet-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  <input type="number" placeholder="Suma (€)" value={cfForm.amount} onChange={e=>setCfForm({...cfForm,amount:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-violet-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  <select value={cfForm.type} onChange={e=>setCfForm({...cfForm,type:e.target.value,category:e.target.value==="INCOME"?"SALARY":"RENT"})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-violet-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}>
                    <option value="INCOME">Príjem</option>
                    <option value="EXPENSE">Výdavok</option>
                  </select>
                  <SelectWithDelete dark={dark}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-violet-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}
                    value={cfForm.category}
                    onChange={v=>{setCfForm({...cfForm,category:v});if(v!=="__CUSTOM__")setCfCustomCat("");}}
                    options={[
                      ...(cfForm.type==="INCOME"?CF_INCOME_CATS:CF_EXPENSE_CATS).filter(k=>!(settings.hiddenCfCats||[]).includes(k)).map(k=>({value:k,label:CF_CATEGORIES[k]})),
                      ...(cfForm.type==="INCOME"?cfCustomIncomeCats:cfCustomExpenseCats).filter(k=>!(settings.hiddenCfCats||[]).includes(k)).map(k=>({value:k,label:k}))
                    ]}
                    onDelete={(v)=>{setSettings(s=>({...s,hiddenCfCats:[...(s.hiddenCfCats||[]),v]}));if(cfForm.category===v){const cats=cfForm.type==="INCOME"?CF_INCOME_CATS:CF_EXPENSE_CATS;setCfForm(f=>({...f,category:cats.find(k=>!(settings.hiddenCfCats||[]).includes(k)&&k!==v)||cats[0]}));}}}
                    addLabel="+ Vlastná kategória"
                  />
                  {cfForm.category==="__CUSTOM__"&&(
                    <input type="text" placeholder="Názov kategórie" value={cfCustomCat} onChange={e=>setCfCustomCat(e.target.value)}
                      className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-violet-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  )}
                  <div className="flex gap-2">
                    <button onClick={saveCf} className="flex-1 bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg text-xs font-semibold transition-all">
                      {cfEditId ? "Uložiť" : "Pridať"}
                    </button>
                    {cfEditId && <button onClick={()=>{setCfEditId(null);setCfForm({name:"",amount:"",type:"INCOME",category:"SALARY"});}} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-100 transition-all"><X size={14}/></button>}
                  </div>
                </div>
              </div>

              {/* Zoznam */}
              {cashflow.length > 0 && (
                <div className="mt-4 space-y-4">
                  {/* Zoradenie */}
                  <div className="flex items-center justify-end mb-1">
                    <button onClick={toggleCfSort} className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors ${cfSort?(dark?"bg-violet-900/50 text-violet-300":"bg-violet-50 text-violet-600"):(dark?"text-slate-500 hover:text-slate-300":"text-slate-400 hover:text-slate-600")}`}>
                      <ArrowUpDown size={12}/>
                      {cfSort==="desc"?"Zostupne":cfSort==="asc"?"Vzostupne":"Zoradiť"}
                    </button>
                  </div>

                  {/* Príjmy */}
                  {cashflow.filter(c=>c.type==="INCOME").length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-500 mb-2 flex items-center gap-1"><ArrowUp size={12}/> Príjmy</h4>
                      <div className="space-y-1.5">
                        {sortedCf("INCOME").map(c=>(
                          <div key={c.id} draggable onDragStart={e=>handleCfDragStart(e,c.id)} onDragEnd={handleCfDragEnd} onDragOver={e=>handleCfDragOver(e,c.id)} onDrop={e=>handleCfDrop(e,c.id)}
                            className={`flex items-center justify-between p-3 rounded-xl ${dark?"bg-slate-700/50":"bg-white"} group transition-all ${cfDragOverId===c.id&&cfDragId!==c.id?"ring-2 ring-violet-500 ring-offset-1 scale-[1.01]":""}`}>
                            <div className="flex items-center gap-2">
                              <div className="hidden sm:block cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors -ml-1">
                                <GripVertical size={14}/>
                              </div>
                              <div>
                                <span className={`text-sm font-semibold ${dark?"text-white":"text-slate-700"}`}>{c.name}</span>
                                <span className="text-[10px] text-slate-400 ml-2">{CF_CATEGORIES[c.category]||c.category}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-emerald-600">+{fmt(c.amount)}</span>
                              <button onClick={()=>editCf(c)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-violet-600 transition-all"><Edit size={13}/></button>
                              <button onClick={()=>deleteCf(c.id)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={13}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Výdavky */}
                  {cashflow.filter(c=>c.type==="EXPENSE").length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500 mb-2 flex items-center gap-1"><ArrowDown size={12}/> Výdavky</h4>
                      <div className="space-y-1.5">
                        {sortedCf("EXPENSE").map(c=>(
                          <div key={c.id} draggable onDragStart={e=>handleCfDragStart(e,c.id)} onDragEnd={handleCfDragEnd} onDragOver={e=>handleCfDragOver(e,c.id)} onDrop={e=>handleCfDrop(e,c.id)}
                            className={`flex items-center justify-between p-3 rounded-xl ${dark?"bg-slate-700/50":"bg-white"} group transition-all ${cfDragOverId===c.id&&cfDragId!==c.id?"ring-2 ring-violet-500 ring-offset-1 scale-[1.01]":""}`}>
                            <div className="flex items-center gap-2">
                              <div className="hidden sm:block cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors -ml-1">
                                <GripVertical size={14}/>
                              </div>
                              <div>
                                <span className={`text-sm font-semibold ${dark?"text-white":"text-slate-700"}`}>{c.name}</span>
                                <span className="text-[10px] text-slate-400 ml-2">{CF_CATEGORIES[c.category]||c.category}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-rose-600">-{fmt(c.amount)}</span>
                              <button onClick={()=>editCf(c)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-violet-600 transition-all"><Edit size={13}/></button>
                              <button onClick={()=>deleteCf(c.id)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={13}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Súhrn & projekcie */}
                  <div className={`p-4 rounded-xl ${dark?"bg-slate-700/30":"bg-gradient-to-r from-slate-50 to-violet-50"} border ${dark?"border-slate-600":"border-slate-100"}`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Mesačný súhrn</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">Príjmy</div>
                        <div className="text-sm font-bold text-emerald-600">{fmt(cfMetrics.monthlyIncome)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">Výdavky</div>
                        <div className="text-sm font-bold text-rose-600">{fmt(cfMetrics.monthlyExpense)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">{cfMetrics.surplus>=0?"Mesačný prebytok":"Mesačný úbytok"}</div>
                        <div className={`text-sm font-bold ${cfMetrics.surplus>=0?"text-emerald-600":"text-rose-600"}`}>{cfMetrics.surplus>=0?"+":""}{fmt(cfMetrics.surplus)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">Miera úspor</div>
                        <div className={`text-sm font-bold ${cfMetrics.savingsRate>=20?"text-emerald-600":cfMetrics.savingsRate>=10?"text-amber-600":"text-rose-600"}`}>{cfMetrics.savingsRate.toFixed(1)} %</div>
                      </div>
                    </div>

                    {/* Ročný prehľad */}
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Ročný prehľad</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">Ročné príjmy</div>
                        <div className="text-sm font-bold text-emerald-600">{fmt(cfMetrics.monthlyIncome * 12)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">Ročné výdavky</div>
                        <div className="text-sm font-bold text-rose-600">{fmt(cfMetrics.monthlyExpense * 12)}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-slate-400 font-medium">{cfMetrics.surplus>=0?"Ročný prebytok":"Ročný úbytok"}</div>
                        <div className={`text-sm font-bold ${cfMetrics.surplus>=0?"text-emerald-600":"text-rose-600"}`}>{cfMetrics.surplus>=0?"+":""}{fmt(cfMetrics.surplus * 12)}</div>
                      </div>
                    </div>

                    {/* Rozklad výdavkov */}
                    {cfMetrics.expBreakdown.length > 0 && (
                      <>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Rozklad výdavkov</h4>
                        <div className="space-y-2 mb-4">
                          {cfMetrics.expBreakdown.map(item=>(
                            <div key={item.cat}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`text-xs font-medium ${dark?"text-slate-300":"text-slate-600"}`}>{item.label}</span>
                                <span className={`text-xs font-bold tabular-nums ${dark?"text-white":"text-slate-700"}`}>{fmt(item.value)} <span className="text-[10px] text-slate-400 font-medium">({item.pct.toFixed(0)}%)</span></span>
                              </div>
                              <div className={`h-1.5 rounded-full overflow-hidden ${dark?"bg-slate-600":"bg-slate-200"}`}>
                                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-rose-500 transition-all" style={{width:`${item.pct}%`}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Projekcia likvidných aktív</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[{label:"3 mesiace",val:cfMetrics.proj3},{label:"6 mesiacov",val:cfMetrics.proj6},{label:"12 mesiacov",val:cfMetrics.proj12}].map((p,i)=>(
                        <div key={i} className="text-center">
                          <div className="text-[10px] text-slate-400 font-medium">{p.label}</div>
                          <div className={`text-sm font-bold ${p.val>=0?(dark?"text-white":"text-slate-700"):"text-rose-600"}`}>{fmt(p.val)}</div>
                        </div>
                      ))}
                    </div>

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Projekcia čistého imania</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-1">
                      {[{label:"3 mesiace",val:cfMetrics.nwProj3},{label:"6 mesiacov",val:cfMetrics.nwProj6},{label:"12 mesiacov",val:cfMetrics.nwProj12},{label:"12 mes. reálne",val:cfMetrics.nwProj12 - metrics.totalExp,note:true}].map((p,i)=>{
                        const diff = p.val - metrics.nw;
                        return (
                        <div key={i} className="text-center">
                          <div className="text-[10px] text-slate-400 font-medium">{p.label}</div>
                          <div className={`text-sm font-bold ${p.val>=0?(dark?"text-white":"text-slate-700"):"text-rose-600"}`}>{fmt(p.val)}</div>
                          <div className={`text-[10px] font-semibold tabular-nums ${diff>=0?"text-emerald-500":"text-rose-500"}`}>{diff>=0?"+":""}{fmt(diff)}</div>
                        </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-1 mt-1">
                      {cfMetrics.loanPayments > 0 && (
                        <p className={`text-[10px] ${dark?"text-slate-500":"text-slate-400"}`}>
                          Zohľadňuje splátky dlhov {fmt(cfMetrics.loanPayments)}/mes — znižujú pasíva, nie čisté imanie
                        </p>
                      )}
                      {metrics.totalExp > 0 && (
                        <p className={`text-[10px] ${dark?"text-slate-500":"text-slate-400"}`}>
                          12 mes. reálne: zohľadnené plánované výdavky {fmt(metrics.totalExp)} (Pasíva)
                        </p>
                      )}
                    </div>
                    {Number(metrics.runway) < 3 && (
                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                        <AlertTriangle size={14}/> Runway je menej ako 3 mesiace!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ALERTY A MÍĽNIKY ── */}
        <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-sm overflow-hidden`}>
          <button onClick={()=>setAlertsOpen(!alertsOpen)} className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${dark?"hover:bg-slate-700/50":"hover:bg-slate-50"}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Bell size={20}/>
              </div>
              <div className="text-left">
                <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-800"}`}>Alerty a míľniky</h3>
                <p className="text-[10px] text-slate-400 font-medium">{alerts.length > 0 ? `${alerts.length} alertov · ${alerts.filter(a=>a.triggered).length} aktívnych` : "Nastavte si vlastné upozornenia"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {alerts.filter(a=>a.triggered).length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                  {alerts.filter(a=>a.triggered).length} splnených
                </span>
              )}
              <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${alertsOpen ? "rotate-90" : ""}`}/>
            </div>
          </button>

          {alertsOpen && (
            <div className={`px-5 pb-5 border-t ${dark?"border-slate-700":"border-slate-100"}`}>
              {/* Formulár */}
              <div className={`mt-4 p-4 rounded-xl ${dark?"bg-slate-700/50":"bg-slate-50"}`}>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{alertEditId ? "Upraviť alert" : "Nový alert"}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
                  <input type="text" placeholder="Názov alertu" value={alertForm.name} onChange={e=>setAlertForm({...alertForm,name:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  <select value={alertForm.metric} onChange={e=>setAlertForm({...alertForm,metric:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}>
                    {Object.entries(ALERT_METRICS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                  <select value={alertForm.condition} onChange={e=>setAlertForm({...alertForm,condition:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}>
                    <option value="ABOVE">dosiahne alebo prekročí</option>
                    <option value="BELOW">klesne pod</option>
                  </select>
                  <input type="number" placeholder="Hodnota" value={alertForm.value} onChange={e=>setAlertForm({...alertForm,value:e.target.value})}
                    className={`px-3 py-2.5 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark?"bg-slate-600 border-slate-500 text-white":"bg-white border-slate-200"}`}/>
                  <div className="flex gap-2">
                    <button onClick={saveAlert} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-xs font-semibold transition-all">
                      {alertEditId ? "Uložiť" : "Pridať"}
                    </button>
                    {alertEditId && <button onClick={()=>{setAlertEditId(null);setAlertForm({name:"",metric:"NW",condition:"ABOVE",value:""});}} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-500 text-xs font-semibold hover:bg-slate-100 transition-all"><X size={14}/></button>}
                  </div>
                </div>
              </div>

              {/* Zoznam alertov */}
              {alerts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {alerts.map(a=>(
                    <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl ${a.triggered?(dark?"bg-emerald-900/30 border-emerald-700":"bg-emerald-50 border-emerald-100"):(dark?"bg-slate-700/50 border-slate-600":"bg-white border-slate-100")} border group`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${a.triggered?"bg-emerald-500 animate-pulse":"bg-slate-300"}`}/>
                        <div>
                          <span className={`text-sm font-semibold ${dark?"text-white":"text-slate-700"}`}>{a.name}</span>
                          <p className="text-[10px] text-slate-400">
                            {ALERT_METRICS[a.metric]} {a.condition==="ABOVE"?">=":"<="} {a.metric==="RUNWAY"?`${a.value} mes.`:fmt(a.value)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${a.triggered?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>
                          {a.triggered?"Splnené":"Čaká"}
                        </span>
                        <button onClick={()=>editAlert(a)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 transition-all"><Edit size={13}/></button>
                        <button onClick={()=>deleteAlert(a.id)} className="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-all"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DAILY NOTE + SNAPSHOT ── */}
        <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border p-5 shadow-sm`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-emerald-500"/>
              <h3 className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Denný záznam — {new Date().toLocaleDateString("sk-SK",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] px-2 py-1 rounded-lg ${dark?"bg-slate-700 text-slate-400":"bg-slate-100 text-slate-500"}`}>
                <Clock size={10} className="inline mr-1"/>Auto-save 22:00
              </span>
              <button onClick={saveDay} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all">
                <Save size={14}/> Uložiť teraz
              </button>
            </div>
          </div>

          {/* Dnešný snapshot prehľad */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-3 p-3 rounded-xl ${dark?"bg-slate-700/30":"bg-slate-50"}`}>
            {[
              {l:"Čisté imanie",v:metrics.nw,c:"emerald"},
              {l:"Aktíva",v:metrics.assets,c:"blue"},
              {l:"Pasíva",v:metrics.liab+metrics.totalExp,c:"rose",neg:true},
              {l:"Likvidné",v:metrics.liquid,c:"cyan"},
              {l:"Runway",v:metrics.runway+" mes.",c:"amber",raw:true},
              {l:"Záznamy",v:history.length+" dní",c:"violet",raw:true},
            ].map(i=>(
              <div key={i.l} className="text-center">
                <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">{i.l}</p>
                <p className={`text-xs font-extrabold tabular-nums ${dark?"text-white":"text-slate-800"}`}>{i.neg?"-":""}{i.raw?i.v:fmt(i.v)}</p>
              </div>
            ))}
          </div>

          <textarea
            value={todayNote}
            onChange={e=>setTodayNote(e.target.value)}
            placeholder="Poznámky k dnešnému dňu — čo sa zmenilo, aké rozhodnutia ste urobili..."
            className={`w-full h-24 px-4 py-3 rounded-xl border text-sm resize-none outline-none transition-all ${dark?"bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-emerald-500":"bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-emerald-500"} focus:ring-2`}
          />
        </div>
      </main>

      {/* ── ADD / EDIT MODAL ── */}
      {modal&&(()=>{
        const customAccCats=[...new Set(accounts.filter(a=>!BUILTIN_CATS.includes(a.category)&&a.category!=="DEBT").map(a=>a.category))];
        const customExpCats=[...new Set(expenses.filter(e=>!BUILTIN_EXP_CATS.includes(e.category)).map(e=>e.category))];
        const inp=`w-full mt-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${dark?"bg-slate-700 border-slate-600 text-white":"bg-slate-50 border-slate-200 text-slate-800"}`;
        const lbl=`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-400":"text-slate-500"}`;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}>
          <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-2xl w-full max-w-md mx-4 p-4 sm:p-6`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-bold ${dark?"text-white":"text-slate-800"}`}>
                {editId?"Upraviť":"Pridať"} {modalType==="DEBT"?"dlh":modalType==="ACCOUNT"?"účet":"výdavok"}
              </h3>
              <button onClick={()=>setModal(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors"><X size={18}/></button>
            </div>
            <div className="space-y-4">
              {/* 1. Názov */}
              <div>
                <label className={lbl}>Názov</label>
                <input type="text" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={modalType==="DEBT"?"Názov dlhu":modalType==="ACCOUNT"?"Názov účtu":"Názov výdavku"} className={inp}/>
              </div>
              {/* 2. Zostatok / Suma */}
              <div>
                <label className={lbl}>{modalType==="DEBT"?"Suma dlhu (€)":modalType==="ACCOUNT"?"Zostatok (€)":"Suma (€)"}</label>
                <input type="number" step={modalType==="ACCOUNT"?"100":"1"} value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="0" className={inp}/>
              </div>
              {/* 3. Kategória (ACCOUNT — bez DEBT, s vlastnými) */}
              {modalType==="ACCOUNT"&&(
                <div>
                  <label className={lbl}>Kategória</label>
                  <SelectWithDelete dark={dark} className={inp}
                    value={form.category}
                    onChange={v=>setForm({...form,category:v,customCat:v==="__CUSTOM__"?form.customCat:""})}
                    options={[
                      ...BUILTIN_CATS.filter(k=>!(settings.hiddenAccCats||[]).includes(k)).map(k=>({value:k,label:CATEGORY_LABELS[k]})),
                      ...customAccCats.filter(c=>!(settings.hiddenAccCats||[]).includes(c)).map(c=>({value:c,label:c}))
                    ]}
                    onDelete={(v)=>{setSettings(s=>({...s,hiddenAccCats:[...(s.hiddenAccCats||[]),v]}));if(form.category===v)setForm(f=>({...f,category:BUILTIN_CATS.find(k=>!(settings.hiddenAccCats||[]).includes(k)&&k!==v)||"LIQUID"}));}}
                    addLabel="+ Pridať vlastnú..."
                  />
                  {form.category==="__CUSTOM__"&&(
                    <input type="text" value={form.customCat} onChange={e=>setForm({...form,customCat:e.target.value})} placeholder="Názov vlastnej kategórie" className={`${inp} mt-2`}/>
                  )}
                </div>
              )}
              {/* 4. Typ (ACCOUNT — s vlastnými) */}
              {modalType==="ACCOUNT"&&(()=>{
                const customTypes=[...new Set(accounts.map(a=>a.type).filter(t=>!BUILTIN_TYPES.includes(t)))];
                return (
                <div>
                  <label className={lbl}>Typ</label>
                  <SelectWithDelete dark={dark} className={inp}
                    value={form.type}
                    onChange={v=>setForm({...form,type:v,customType:v==="__CUSTOM_TYPE__"?form.customType:""})}
                    options={[
                      ...Object.entries(TYPE_LABELS).filter(([k])=>!(settings.hiddenAccTypes||[]).includes(k)).map(([k,v])=>({value:k,label:v})),
                      ...customTypes.filter(t=>!(settings.hiddenAccTypes||[]).includes(t)).map(t=>({value:t,label:t}))
                    ]}
                    onDelete={(v)=>{setSettings(s=>({...s,hiddenAccTypes:[...(s.hiddenAccTypes||[]),v]}));if(form.type===v)setForm(f=>({...f,type:BUILTIN_TYPES.find(k=>!(settings.hiddenAccTypes||[]).includes(k)&&k!==v)||"CASH"}));}}
                    addLabel="+ Pridať vlastný..."
                    addValue="__CUSTOM_TYPE__"
                  />
                  {form.type==="__CUSTOM_TYPE__"&&(
                    <input type="text" value={form.customType} onChange={e=>setForm({...form,customType:e.target.value})} placeholder="Názov vlastného typu" className={`${inp} mt-2`}/>
                  )}
                </div>
                );
              })()}
              {/* Kategória (EXPENSE — s vlastnými) */}
              {modalType==="EXPENSE"&&(
                <div>
                  <label className={lbl}>Kategória</label>
                  <SelectWithDelete dark={dark} className={inp}
                    value={form.type}
                    onChange={v=>setForm({...form,type:v,customCat:v==="__CUSTOM__"?form.customCat:""})}
                    options={[
                      ...Object.entries(EXP_CATEGORIES).filter(([k])=>!(settings.hiddenExpCats||[]).includes(k)).map(([k,v])=>({value:k,label:v})),
                      ...customExpCats.filter(c=>!(settings.hiddenExpCats||[]).includes(c)).map(c=>({value:c,label:c}))
                    ]}
                    onDelete={(v)=>{setSettings(s=>({...s,hiddenExpCats:[...(s.hiddenExpCats||[]),v]}));if(form.type===v)setForm(f=>({...f,type:BUILTIN_EXP_CATS.find(k=>!(settings.hiddenExpCats||[]).includes(k)&&k!==v)||"OTHER"}));}}
                    addLabel="+ Pridať vlastnú..."
                  />
                  {form.type==="__CUSTOM__"&&(
                    <input type="text" value={form.customCat} onChange={e=>setForm({...form,customCat:e.target.value})} placeholder="Názov vlastnej kategórie" className={`${inp} mt-2`}/>
                  )}
                </div>
              )}
              <button onClick={saveModal} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">
                {editId?"Aktualizovať":"Pridať"}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── SETTINGS MODAL ── */}
      {settingsOpen&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)setSettingsOpen(false);}}>
          <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-2xl w-full max-w-md mx-4 p-4 sm:p-6`}>
            <div className="flex items-center justify-between mb-5">
              <h3 className={`text-lg font-bold ${dark?"text-white":"text-slate-800"}`}>Nastavenia</h3>
              <button onClick={()=>setSettingsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-400":"text-slate-500"}`}>Finančný cieľ (€)</label>
                <input type="number" value={settings.financialGoal} onChange={e=>setSettings({...settings,financialGoal:Number(e.target.value)})} className={`w-full mt-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${dark?"bg-slate-700 border-slate-600 text-white":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
              </div>
              <div>
                <label className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-400":"text-slate-500"}`}>Mesačné výdavky (€)</label>
                <input type="number" value={settings.monthlyBurn} onChange={e=>setSettings({...settings,monthlyBurn:Number(e.target.value)})} className={`w-full mt-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${dark?"bg-slate-700 border-slate-600 text-white":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
              </div>
              <hr className={`${dark?"border-slate-700":"border-slate-100"}`}/>
              <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Portfóliá</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <BarChart3 size={16} className="text-indigo-500"/>
                    <span className={`text-sm ${dark?"text-slate-200":"text-slate-700"}`}>Akciové portfólio</span>
                  </div>
                  <button onClick={()=>setSettings({...settings,showStocks:!settings.showStocks})} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${settings.showStocks?"bg-indigo-500":"bg-slate-300"}`}>
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform absolute top-0.5 ${settings.showStocks?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Coins size={16} className="text-amber-500"/>
                    <span className={`text-sm ${dark?"text-slate-200":"text-slate-700"}`}>Krypto portfólio</span>
                  </div>
                  <button onClick={()=>setSettings({...settings,showCrypto:!settings.showCrypto})} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${settings.showCrypto?"bg-amber-500":"bg-slate-300"}`}>
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform absolute top-0.5 ${settings.showCrypto?"left-[22px]":"left-0.5"}`}/>
                  </button>
                </div>
              </div>
              {settings.showCrypto&&(
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider ${dark?"text-slate-400":"text-slate-500"}`}>Nákupné náklady krypto portfólia (€)</label>
                  <input type="number" value={settings.cryptoCostBasis||""} onChange={e=>setSettings({...settings,cryptoCostBasis:Number(e.target.value)||0})} placeholder="0 = nezobrazovať" className={`w-full mt-1 px-4 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${dark?"bg-slate-700 border-slate-600 text-white":"bg-slate-50 border-slate-200 text-slate-800"}`}/>
                </div>
              )}
              {((settings.hiddenAccCats||[]).length+(settings.hiddenAccTypes||[]).length+(settings.hiddenExpCats||[]).length+(settings.hiddenCfCats||[]).length)>0&&(<>
                <hr className={`${dark?"border-slate-700":"border-slate-100"}`}/>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${dark?"text-slate-400":"text-slate-500"}`}>Skryté kategórie/typy: {(settings.hiddenAccCats||[]).length+(settings.hiddenAccTypes||[]).length+(settings.hiddenExpCats||[]).length+(settings.hiddenCfCats||[]).length}</span>
                  <button onClick={()=>setSettings(s=>({...s,hiddenAccCats:[],hiddenAccTypes:[],hiddenExpCats:[],hiddenCfCats:[]}))} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${dark?"text-violet-400 hover:bg-violet-500/10":"text-violet-600 hover:bg-violet-50"}`}>
                    <RotateCcw size={12} className="inline mr-1"/>Obnoviť všetky
                  </button>
                </div>
              </>)}
              <hr className={`${dark?"border-slate-700":"border-slate-100"}`}/>
              <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Účet</h4>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm ${dark?"text-slate-300":"text-slate-600"}`}>{user?.email}</p>
                  <p className={`text-xs ${dark?"text-slate-500":"text-slate-400"} mt-0.5`}>Prihlásený účet</p>
                </div>
                {pwResetSent
                  ?<span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500"><Check size={14}/>Email odoslaný</span>
                  :<button onClick={async()=>{try{await sendPasswordResetEmail(auth,user.email);setPwResetSent(true);setTimeout(()=>setPwResetSent(false),5000);}catch{show("Nepodarilo sa odoslať email","error");}}} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dark?"text-slate-300 hover:bg-slate-700":"text-slate-600 hover:bg-slate-100"}`}>
                    <Lock size={13}/>Zmeniť heslo
                  </button>}
              </div>
              <hr className={`${dark?"border-slate-700":"border-slate-100"}`}/>
              <h4 className={`text-sm font-bold ${dark?"text-white":"text-slate-700"}`}>Dáta</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={exportJSON} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark?"border-slate-600 text-slate-300 hover:bg-slate-700":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <Download size={14}/> Export JSON
                </button>
                <button onClick={exportCSV} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark?"border-slate-600 text-slate-300 hover:bg-slate-700":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <Download size={14}/> Export CSV
                </button>
                <button onClick={()=>fileInputRef.current?.click()} className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark?"border-slate-600 text-slate-300 hover:bg-slate-700":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  <Upload size={14}/> Import JSON
                </button>
                <button onClick={resetData} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 text-xs font-semibold hover:bg-rose-50 transition-all">
                  <RotateCcw size={14}/> Reset dát
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORTS MODAL ── */}
      {reportsOpen&&(()=>{
        const now = new Date();
        const dateStr = now.toLocaleDateString("sk-SK",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
        const timeStr = now.toLocaleTimeString("sk-SK",{hour:"2-digit",minute:"2-digit"});
        /* Kategórie pre stacked bar (vrátane vlastných) */
        const allCats = [...new Set([...BUILTIN_CATS, ...accounts.filter(a=>a.category!=="DEBT"&&!BUILTIN_CATS.includes(a.category)).map(a=>a.category)])];
        const catData = allCats.map(cat => {
          const sum = accounts.filter(a=>a.category===cat).reduce((s,a)=>s+Number(a.balance),0);
          const cs = CAT_STYLE[cat]||{color:"#8b5cf6"};
          return {cat, label: CATEGORY_LABELS[cat]||cat, value: sum, color: cs.color, pct: metrics.assets>0?(sum/metrics.assets*100):0};
        }).filter(c=>c.value>0);
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)setReportsOpen(false);}}>
          <div className={`${dark?"bg-slate-800 border-slate-700":"bg-white border-slate-100"} rounded-2xl border shadow-2xl w-full max-w-2xl mx-4 p-4 sm:p-6 flex flex-col`} style={{maxHeight:"85vh"}}>
            {/* Header s dátumom a časom */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-bold ${dark?"text-white":"text-slate-800"}`}>Prehľad a reporty</h3>
                <p className={`text-xs ${dark?"text-slate-400":"text-slate-500"} mt-0.5`}>
                  <Calendar size={11} className="inline mr-1 -mt-0.5"/>{dateStr} · <Clock size={11} className="inline mr-1 -mt-0.5"/>{timeStr}
                </p>
              </div>
              <button onClick={()=>setReportsOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={18}/></button>
            </div>

            {/* Scrollovateľný obsah */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              {/* Kľúčové metriky */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {l:"Čisté imanie",v:metrics.nw,c:"text-emerald-600"},
                  {l:"Aktíva",v:metrics.assets,c:dark?"text-white":"text-slate-800"},
                  {l:"Záväzky",v:metrics.liab+metrics.totalExp,c:"text-rose-600",neg:true},
                  {l:"Likvidné",v:metrics.liquid,c:dark?"text-white":"text-slate-800"},
                ].map((m,i)=>(
                  <div key={i} className={`${dark?"bg-slate-700/60":"bg-slate-50"} rounded-xl p-3 text-center`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{m.l}</span>
                    <p className={`text-base font-extrabold mt-0.5 tabular-nums ${m.c}`}>{m.neg?"-":""}{fmt(m.v)}</p>
                  </div>
                ))}
              </div>

              {/* Runway + Cieľ riadok */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`${dark?"bg-slate-700/60":"bg-slate-50"} rounded-xl p-3 flex items-center justify-between`}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Runway</span>
                  <span className={`text-sm font-extrabold ${dark?"text-amber-400":"text-amber-600"}`}>{metrics.runway} mesiacov</span>
                </div>
                {settings.financialGoal>0&&(
                  <div className={`${dark?"bg-slate-700/60":"bg-slate-50"} rounded-xl p-3 flex items-center justify-between`}>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cieľ</span>
                    <span className={`text-sm font-extrabold ${dark?"text-emerald-400":"text-emerald-600"}`}>{(metrics.nw/settings.financialGoal*100).toFixed(1)}%</span>
                  </div>
                )}
              </div>

              {/* Alokácia aktív — stacked bar */}
              <div>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark?"text-slate-400":"text-slate-500"}`}>Alokácia aktív</h4>
                {/* Farebný bar */}
                <div className="h-5 rounded-full overflow-hidden flex" style={{backgroundColor: dark?"#334155":"#e2e8f0"}}>
                  {catData.map((c,i)=>(
                    <div key={i} className="h-full transition-all duration-500 relative group" style={{width:`${c.pct}%`,backgroundColor:c.color}} title={`${c.label}: ${fmt(c.value)} (${c.pct.toFixed(1)}%)`}>
                      {c.pct > 8 && <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white drop-shadow-sm">{c.pct.toFixed(0)}%</span>}
                    </div>
                  ))}
                </div>
                {/* Legenda */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {catData.map((c,i)=>(
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:c.color}}/>
                      <span className={`text-[10px] font-medium ${dark?"text-slate-300":"text-slate-600"}`}>{c.label}</span>
                      <span className={`text-[10px] font-bold ${dark?"text-white":"text-slate-800"} tabular-nums`}>{fmt(c.value)}</span>
                      <span className="text-[10px] font-bold text-slate-400">{c.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── AKTÍVA — položky s % a stacked bar ── */}
              {(()=>{
                const items = accounts.filter(a=>a.category!=="DEBT").sort((a,b)=>b.balance-a.balance);
                const total = metrics.assets;
                if(items.length===0) return null;
                return (
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark?"text-slate-400":"text-slate-500"}`}>
                      <TrendingUp size={11} className="inline mr-1 -mt-0.5 text-emerald-500"/>Aktíva · {fmt(total)}
                    </h4>
                    {/* Stacked bar — všetky položky spolu = 100% */}
                    <div className="h-4 rounded-full overflow-hidden flex" style={{backgroundColor:dark?"#334155":"#e2e8f0"}}>
                      {items.map((a,i)=>{
                        const pct = total>0?(a.balance/total*100):0;
                        const c = CAT_STYLE[a.category]?.color||"#10b981";
                        return <div key={a.id} className="h-full" style={{width:`${pct}%`,backgroundColor:c,opacity:1-i*0.08}} title={`${a.name}: ${fmt(a.balance)} (${pct.toFixed(1)}%)`}/>;
                      })}
                    </div>
                    {/* Položky */}
                    <div className="mt-2 space-y-1.5">
                      {items.map(a=>{
                        const pct = total>0?(a.balance/total*100):0;
                        const c = CAT_STYLE[a.category]?.color||"#10b981";
                        return (
                          <div key={a.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:c}}/>
                            <span className={`text-[11px] font-medium flex-1 truncate ${dark?"text-slate-300":"text-slate-600"}`}>{a.name}</span>
                            <span className={`text-[11px] font-bold tabular-nums ${dark?"text-white":"text-slate-800"}`}>{fmt(a.balance)}</span>
                            <span className="text-[10px] font-bold text-slate-400 w-12 text-right tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* ── PASÍVA — dlhy + výdavky s % a stacked bar ── */}
              {(()=>{
                const debts = accounts.filter(a=>a.category==="DEBT").sort((a,b)=>b.balance-a.balance);
                const exps = [...expenses].sort((a,b)=>b.amount-a.amount);
                const totalP = metrics.liab + metrics.totalExp;
                if(debts.length===0 && exps.length===0) return null;
                const allItems = [
                  ...debts.map(a=>({id:a.id,name:a.name,value:Number(a.balance),color:"#ef4444",type:"debt"})),
                  ...exps.map(e=>({id:e.id,name:e.name,value:Number(e.amount),color:"#f97316",type:"exp"})),
                ];
                return (
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${dark?"text-slate-400":"text-slate-500"}`}>
                      <CreditCard size={11} className="inline mr-1 -mt-0.5 text-rose-500"/>Pasíva · -{fmt(totalP)}
                    </h4>
                    {/* Stacked bar */}
                    <div className="h-4 rounded-full overflow-hidden flex" style={{backgroundColor:dark?"#334155":"#e2e8f0"}}>
                      {allItems.map((it,i)=>{
                        const pct = totalP>0?(it.value/totalP*100):0;
                        return <div key={it.id} className="h-full" style={{width:`${pct}%`,backgroundColor:it.color,opacity:1-i*0.06}} title={`${it.name}: ${fmt(it.value)} (${pct.toFixed(1)}%)`}/>;
                      })}
                    </div>
                    {/* Položky */}
                    <div className="mt-2 space-y-1.5">
                      {allItems.map(it=>{
                        const pct = totalP>0?(it.value/totalP*100):0;
                        return (
                          <div key={it.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor:it.color}}/>
                            <span className={`text-[11px] font-medium flex-1 truncate ${dark?"text-slate-300":"text-slate-600"}`}>{it.name}</span>
                            <span className={`text-[11px] font-bold tabular-nums ${it.type==="debt"?"text-rose-600":"text-orange-600"}`}>-{fmt(it.value)}</span>
                            <span className="text-[10px] font-bold text-slate-400 w-12 text-right tabular-nums">{pct.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Tlačidlá — vždy viditeľné, nepotrebný scroll */}
            <div className={`flex flex-wrap gap-2 pt-4 mt-3 border-t ${dark?"border-slate-700":"border-slate-200"}`}>
              <button onClick={()=>{window.print();}} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark?"border-slate-600 text-slate-300 hover:bg-slate-700":"border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                <Printer size={14}/> Tlačiť
              </button>
              <button onClick={()=>{setReportsOpen(false);setTimeout(exportPNG,600);}} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark?"border-emerald-700 text-emerald-300 hover:bg-emerald-900/30":"border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>
                <Camera size={14}/> PNG
              </button>
              <button onClick={()=>{setReportsOpen(false);setTimeout(exportPDF,600);}} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${dark?"border-blue-700 text-blue-300 hover:bg-blue-900/30":"border-blue-200 text-blue-700 hover:bg-blue-50"}`}>
                <Image size={14}/> PDF
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* ── PRINT REPORT (hidden on screen, shown on print) ── */}
      <div className="print-report hidden" style={{padding:"0 10mm"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"2px solid #10b981",paddingBottom:"8px",marginBottom:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <div style={{width:"28px",height:"28px",background:"linear-gradient(135deg,#10b981,#047857)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"12px",fontWeight:"800"}}>F</div>
            <div>
              <div style={{fontSize:"16px",fontWeight:"800",color:"#1e293b"}}>FIDU</div>
              <div style={{fontSize:"8px",color:"#94a3b8",fontWeight:"600",letterSpacing:"0.1em"}}>FINANČNÝ REPORT</div>
            </div>
          </div>
          <div style={{textAlign:"right",fontSize:"10px",color:"#64748b"}}>
            <div style={{fontWeight:"700"}}>{new Date().toLocaleDateString("sk-SK",{day:"numeric",month:"long",year:"numeric"})}</div>
          </div>
        </div>

        {/* Metriky */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"8px",marginBottom:"14px"}}>
          {[
            {label:"Čisté imanie",value:fmt(metrics.nw),color:"#10b981"},
            {label:"Celkové aktíva",value:fmt(metrics.assets),color:"#3b82f6"},
            {label:"Záväzky",value:"-"+fmt(metrics.liab+metrics.totalExp),color:"#ef4444"},
            {label:"Runway",value:`${metrics.runway} mes.`,color:"#f59e0b"},
          ].map((m,i)=>(
            <div key={i} style={{border:"1px solid #e2e8f0",borderRadius:"8px",padding:"8px",textAlign:"center"}}>
              <div style={{fontSize:"8px",fontWeight:"700",color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.05em"}}>{m.label}</div>
              <div style={{fontSize:"16px",fontWeight:"800",color:m.color,marginTop:"2px"}}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* Cieľ */}
        {settings.financialGoal>0&&(
          <div style={{marginBottom:"14px",padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:"8px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"9px",fontWeight:"700",color:"#64748b",marginBottom:"4px"}}>
              <span>Finančný cieľ</span>
              <span style={{color:"#10b981"}}>{goalProgress.toFixed(1)}%</span>
            </div>
            <div style={{height:"6px",background:"#f1f5f9",borderRadius:"3px",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${goalProgress}%`,background:"linear-gradient(90deg,#10b981,#059669)",borderRadius:"3px"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"8px",color:"#94a3b8",marginTop:"2px"}}>
              <span>{fmt(metrics.nw)}</span>
              <span>{fmt(settings.financialGoal)}</span>
            </div>
          </div>
        )}

        {/* Aktíva podľa kategórií */}
        <div style={{marginBottom:"14px"}}>
          <div style={{fontSize:"11px",fontWeight:"800",color:"#1e293b",marginBottom:"6px",borderBottom:"1px solid #e2e8f0",paddingBottom:"4px"}}>Aktíva</div>
          {[...new Set(["LIQUID","INVESTMENT","RECEIVABLE","ILLIQUID",...accounts.filter(a=>a.category!=="DEBT"&&!["LIQUID","INVESTMENT","RECEIVABLE","ILLIQUID"].includes(a.category)).map(a=>a.category)])].map(cat=>{
            const catAccs=accounts.filter(a=>a.category===cat);
            if(catAccs.length===0) return null;
            const catSum=catAccs.reduce((s,a)=>s+Number(a.balance),0);
            const catPct=metrics.assets>0?(catSum/metrics.assets*100).toFixed(1):"0.0";
            return (
              <div key={cat} style={{marginBottom:"8px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"9px",fontWeight:"700",color:"#64748b",marginBottom:"3px",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                  <span>{CATEGORY_LABELS[cat]||cat}</span>
                  <span>{fmt(catSum)} ({catPct} %)</span>
                </div>
                {catAccs.map(acc=>(
                  <div key={acc.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 8px",fontSize:"10px",borderLeft:"2px solid #e2e8f0",marginLeft:"4px"}}>
                    <span style={{color:"#475569"}}>{acc.name} <span style={{color:"#94a3b8",fontSize:"8px"}}>({TYPE_LABELS[acc.type]||acc.type})</span></span>
                    <span style={{fontWeight:"700",color:"#1e293b"}}>{fmt(acc.balance)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Pasíva */}
        <div style={{marginBottom:"14px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"11px",fontWeight:"800",color:"#1e293b",marginBottom:"6px",borderBottom:"1px solid #e2e8f0",paddingBottom:"4px"}}>
            <span>Pasíva</span>
            <span style={{fontSize:"10px",color:"#ef4444"}}>-{fmt(metrics.liab+metrics.totalExp)}</span>
          </div>
          {accounts.filter(a=>a.category==="DEBT").length>0&&(
            <div style={{marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"9px",fontWeight:"700",color:"#64748b",marginBottom:"3px",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                <span>Dlhy / Záväzky</span>
                <span>-{fmt(metrics.liab)}</span>
              </div>
              {accounts.filter(a=>a.category==="DEBT").map(acc=>(
                <div key={acc.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 8px",fontSize:"10px",borderLeft:"2px solid #fecaca",marginLeft:"4px"}}>
                  <span style={{color:"#475569"}}>{acc.name}</span>
                  <span style={{fontWeight:"700",color:"#ef4444"}}>-{fmt(acc.balance)}</span>
                </div>
              ))}
            </div>
          )}
          {expenses.length>0&&(
            <div style={{marginBottom:"8px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:"9px",fontWeight:"700",color:"#64748b",marginBottom:"3px",textTransform:"uppercase",letterSpacing:"0.05em"}}>
                <span>Plánované výdavky</span>
                <span>-{fmt(metrics.totalExp)}</span>
              </div>
              {expenses.map(exp=>(
                <div key={exp.id} style={{display:"flex",justifyContent:"space-between",padding:"3px 8px",fontSize:"10px",borderLeft:"2px solid #fecaca",marginLeft:"4px"}}>
                  <span style={{color:"#475569"}}>{exp.name} <span style={{color:"#94a3b8",fontSize:"8px"}}>({EXP_CATEGORIES[exp.category]||exp.category})</span></span>
                  <span style={{fontWeight:"700",color:"#ef4444"}}>-{fmt(exp.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cash-flow */}
        {cashflow.length>0&&(
          <div style={{marginBottom:"14px"}}>
            <div style={{fontSize:"11px",fontWeight:"800",color:"#1e293b",marginBottom:"6px",borderBottom:"1px solid #e2e8f0",paddingBottom:"4px"}}>Mesačný cash-flow</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px",marginBottom:"6px"}}>
              <div style={{textAlign:"center",fontSize:"10px"}}><span style={{color:"#94a3b8",fontSize:"8px",display:"block"}}>Príjmy</span><span style={{fontWeight:"700",color:"#10b981"}}>{fmt(cfMetrics.monthlyIncome)}</span></div>
              <div style={{textAlign:"center",fontSize:"10px"}}><span style={{color:"#94a3b8",fontSize:"8px",display:"block"}}>Výdavky</span><span style={{fontWeight:"700",color:"#ef4444"}}>{fmt(cfMetrics.monthlyExpense)}</span></div>
              <div style={{textAlign:"center",fontSize:"10px"}}><span style={{color:"#94a3b8",fontSize:"8px",display:"block"}}>Prebytok</span><span style={{fontWeight:"700",color:cfMetrics.surplus>=0?"#10b981":"#ef4444"}}>{cfMetrics.surplus>=0?"+":""}{fmt(cfMetrics.surplus)}</span></div>
            </div>
          </div>
        )}

        {/* Pätička */}
        <div style={{borderTop:"1px solid #e2e8f0",paddingTop:"6px",display:"flex",justifyContent:"space-between",fontSize:"8px",color:"#94a3b8"}}>
          <span>Vygenerované: {new Date().toLocaleString("sk-SK")}</span>
          <span>FIDU Financial Dashboard</span>
        </div>
      </div>

      {/* ── MARKET TICKER ── */}
      <MarketTicker dark={dark}/>
    </div>
  );
}
