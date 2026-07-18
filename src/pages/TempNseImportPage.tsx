/**
 * TEMPORARY PAGE — NSE Category Import
 *
 * Purpose: One-shot import of the full NSE equity universe from Zerodha into
 *          Firestore, with primary and secondary sector category tags.
 *
 * What this page does NOT do:
 *  - No live quote fetch
 *  - No historical data fetch
 *  - No price storage of any kind
 *
 * Remove this page once a permanent scheduled ingestion pipeline is in place.
 */

import { useState, useCallback } from 'react';
import KiteConnectAPI from '../services/kiteConnectAPI';
import { bulkAddStockMetadataOnly, deleteStocksByTag, type BulkImportEntry, type BulkImportResult } from '../services/stockService';
import type { NseEquity } from '../types/Stock';

// ─────────────────────────────────────────────────────────────────────────────
// Category taxonomy
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryRule {
  primary: string;
  secondary: string;
  keywords: string[];  // matched against instrument name (case-insensitive substring)
}

// Order matters — first matching rule wins.
// SECTION A: Named large-cap company rules (highest priority)
// SECTION B: Generic industry keyword rules (fallback for mid/small-caps)
const CATEGORY_RULES: CategoryRule[] = [

  // ── A1. Banking ─────────────────────────────────────────────────────────
  { primary: 'Financial Services', secondary: 'Private Banks',
    keywords: ['hdfc bank','icici bank','axis bank','kotak mahindra bank','indusind bank','yes bank','rbl bank','federal bank','city union bank','karnataka bank','south indian bank','dcb bank','bandhan bank','idfc first bank','nainital bank','lakshmi vilas bank','dhanlaxmi bank','jammu & kashmir bank'] },
  { primary: 'Financial Services', secondary: 'PSU Banks',
    keywords: ['state bank of india','bank of baroda','bank of india','canara bank','punjab national bank','union bank','central bank','indian bank','uco bank','bank of maharashtra','punjab & sind bank','indian overseas bank','maharashtra bank'] },
  { primary: 'Financial Services', secondary: 'NBFCs',
    keywords: ['bajaj finance','bajaj finserv','muthoot finance','manappuram','shriram finance','shriram transport','cholamandalam','mahindra finance','l&t finance','aditya birla capital','piramal','iifl finance','mfs','creditaccess','five-star','arman financial','aptus value','home first','india shelter','aavas financiers','repco home','can fin homes'] },
  { primary: 'Financial Services', secondary: 'Insurance',
    keywords: ['life insurance','lic housing','sbi life','hdfc life','icici prudential','bajaj allianz','new india assurance','general insurance','star health','care health','niva bupa','go digit','max life','kotak life','tata aia','united india'] },
  { primary: 'Financial Services', secondary: 'Capital Markets',
    keywords: ['cdsl','nsdl','angel one','5paisa','geojit','motilal oswal','iifl securities','edelweiss','icici securities','360 one','central depository','bombay stock'] },

  // ── A2. IT / Technology ─────────────────────────────────────────────────
  { primary: 'Information Technology', secondary: 'IT Services',
    keywords: ['tata consultancy','infosys','wipro','hcl technologies','tech mahindra','ltimindtree','mphasis','persistent systems','coforge','hexaware','zensar','niit technologies','mastek','firstsource','sonata software','kpit technologies','intellect design','birlasoft','kellton','happiest minds','tanla platforms','rategain','latent view'] },
  { primary: 'Information Technology', secondary: 'IT Products',
    keywords: ['oracle financial','tata elxsi','cyient','l&t technology','sasken'] },
  { primary: 'Information Technology', secondary: 'Telecom',
    keywords: ['bharti airtel','vodafone idea','reliance jio','mtnl','tata communications','sterlite technologies','gtl infrastructure','indus towers','bharti hexacom'] },

  // ── A3. Pharma & Healthcare ─────────────────────────────────────────────
  { primary: 'Healthcare', secondary: 'Pharma',
    keywords: ['sun pharmaceutical','cipla','dr. reddy','divi','lupin','aurobindo pharma','zydus','glenmark','torrent pharma','ipca','alembic','natco','ajanta pharma','granules','suven','syngene','jubilant pharma','laurus labs','strides pharma','solara','sequent','shilpa medicare','aarti pharma','neuland laboratories','caplin point'] },
  { primary: 'Healthcare', secondary: 'Hospitals',
    keywords: ['apollo hospitals','fortis','narayana hrudayalaya','max healthcare','aster dm','shalby','rainbow children','care hospitals','global health'] },

  // ── A4. Energy ──────────────────────────────────────────────────────────
  { primary: 'Energy', secondary: 'Oil & Gas',
    keywords: ['reliance industries','ongc','ioc','bpcl','hpcl','oil india','petronet','gail','gujarat gas','indraprastha gas','mahanagar gas','castrol','gulf oil','tide water'] },
  { primary: 'Energy', secondary: 'Power Generation',
    keywords: ['ntpc','power grid','tata power','adani power','cesc','jsw energy','torrent power','nhpc','sjvn'] },
  { primary: 'Energy', secondary: 'Renewables',
    keywords: ['adani green','azure power','borosil renewables','waaree','vikram solar','sterling wilson','insolation energy'] },

  // ── A5. Automobile ──────────────────────────────────────────────────────
  { primary: 'Automobile', secondary: 'OEMs',
    keywords: ['maruti suzuki','tata motors','mahindra & mahindra','hyundai motor','bajaj auto','hero motocorp','tvs motor','eicher motors','force motors','ashok leyland','sml isuzu','escorts kubota'] },
  { primary: 'Automobile', secondary: 'Auto Ancillaries',
    keywords: ['bosch','motherson sumi','fag bearings','schaeffler','bharat forge','apollo tyres','mrf','ceat','balkrishna','exide','amara raja','sundaram fasteners','gabriel','rane','suprajit engineering','ramkrishna forgings','shriram pistons','endurance technologies','sona blw'] },

  // ── A6. FMCG & Consumer ─────────────────────────────────────────────────
  { primary: 'FMCG', secondary: 'Consumer Staples',
    keywords: ['hindustan unilever','itc','nestle','dabur','marico','godrej consumer','emami','colgate palmolive','p&g hygiene','jyothy labs'] },
  { primary: 'FMCG', secondary: 'Consumer Discretionary',
    keywords: ['asian paints','berger paints','kansai nerolac','titan company','kalyan jewellers','tribhovandas','senco','vaibhav global'] },

  // ── A7. Metals & Mining ─────────────────────────────────────────────────
  { primary: 'Metals & Mining', secondary: 'Steel',
    keywords: ['tata steel','jsw steel','sail','jindal steel','steel authority','shyam metalics','rashtriya ispat','bhushan','uttam galva','jindal stainless','sunflag iron','usha martin'] },
  { primary: 'Metals & Mining', secondary: 'Aluminium & Copper',
    keywords: ['hindalco','vedanta','nalco','hindustan copper','sterlite industries'] },
  { primary: 'Metals & Mining', secondary: 'Mining',
    keywords: ['coal india','nmdc','hindustan zinc','moil','gmr metals'] },

  // ── A8. Infrastructure & Construction ───────────────────────────────────
  { primary: 'Infrastructure', secondary: 'Construction',
    keywords: ["larsen & toubro",'ncc ltd','knr constructions','pnc infratech','dilip buildcon','j kumar','irb infrastructure','sadbhav','hg infra','kalpataru','ashoka buildcon','gawar construction','afcons','rites','rail vikas','ircon','nbcc'] },
  { primary: 'Infrastructure', secondary: 'Cement',
    keywords: ['ultratech cement','shree cement','acc ltd','ambuja','jk cement','ramco cement','dalmia bharat','heidelberg','orient cement','nuvoco'] },
  { primary: 'Infrastructure', secondary: 'Real Estate',
    keywords: ['dlf','godrej properties','brigade enterprises','prestige estates','oberoi realty','phoenix mills','macrotech','sobha','arvind smartspaces','kolte-patil','mahindra lifespace','sunteck realty','puravankara'] },

  // ── A9. Chemicals ────────────────────────────────────────────────────────
  { primary: 'Chemicals', secondary: 'Specialty Chemicals',
    keywords: ['pidilite','aarti industries','navin fluorine','fine organics','galaxy surfactants','clean science','balaji amines','nocil','vinati organics','deepak nitrite','anupam rasayan','laxmi organic','rossari biotech'] },
  { primary: 'Chemicals', secondary: 'Fertilisers & Agro',
    keywords: ['coromandel','chambal fertilisers','gujarat narmada','deepak fertilisers','gsfc','national fertilisers'] },

  // ── A10. Capital Goods ──────────────────────────────────────────────────
  { primary: 'Capital Goods', secondary: 'Industrials',
    keywords: ['bhel','siemens india','abb india','honeywell automation','thermax','cummins india','voltas','blue star','elgi equipments','greaves cotton','ingersoll-rand'] },
  { primary: 'Capital Goods', secondary: 'Defence & Aerospace',
    keywords: ['hal','bharat electronics','bharat dynamics','garden reach','mazagon dock','cochin shipyard','paras defence','data patterns','astra microwave','zen technologies'] },

  // ── A11. Media, Retail, Logistics ───────────────────────────────────────
  { primary: 'Media & Entertainment', secondary: 'Broadcasting',
    keywords: ['zee entertainment','sun tv','ndtv','tv18','network18','den networks','hathway','tips industries'] },
  { primary: 'Media & Entertainment', secondary: 'OTT & Digital',
    keywords: ['nazara technologies','nykaa','info edge','indiamart','matrimony','policybazaar','cartrade','justdial'] },
  { primary: 'Consumer Services', secondary: 'Retail',
    keywords: ['avenue supermarts','trent','shoppers stop','v-mart','metro brands','bata india','liberty shoes','campus activewear','go fashion'] },
  { primary: 'Consumer Services', secondary: 'Quick Service',
    keywords: ['westlife foodworld','devyani international','jubilant foodworks','restaurant brands','sapphire foods','barbeque-nation'] },
  { primary: 'Logistics', secondary: 'Aviation',
    keywords: ['interglobe aviation','spicejet','blue dart aviation','indigo'] },
  { primary: 'Logistics', secondary: 'Freight & Shipping',
    keywords: ['container corporation','concor','gateway distriparks','allcargo','gati-kintetsu','transport corporation'] },

  // ── A12. Agriculture ────────────────────────────────────────────────────
  { primary: 'Agriculture', secondary: 'Agri Processing',
    keywords: ['kaveri seed','rallis india','pi industries','bayer cropscience','syngenta','triveni engineering','balrampur chini','dhampur sugar','ugar sugar','shree renuka','dharani sugars'] },

  // ═══════════════════════════════════════════════════════════════════════
  // SECTION B — Generic industry keyword fallbacks
  // These are broad patterns that catch mid/small-cap companies not listed above.
  // Less-specific rules are placed LATER so specific rules take priority.
  // ═══════════════════════════════════════════════════════════════════════

  // B1. Textiles (many variations: spinning, weaving, mills, yarn, fabric…)
  { primary: 'Textiles', secondary: 'Textile Manufacturing',
    keywords: ['spinning mill','spinning mills','spinning & weaving','weaving mills','composite mills','cotton mills','textile mill','yarn','fabrics','garments','apparels','hosiery','knitting','silk mills','rayon','polyester fibre'] },
  { primary: 'Textiles', secondary: 'Textile Manufacturing',
    keywords: ['textiles','textile'] },

  // B2. Paper & Packaging
  { primary: 'Chemicals', secondary: 'Paper & Packaging',
    keywords: ['pulp & paper','pulp and paper','paper mills','paper products','paper board','packaging','cartons','laminates','polypacks'] },

  // B3. Metals (generic)
  { primary: 'Metals & Mining', secondary: 'Steel',
    keywords: ['steels','steel pipe','steel tube','steel wire','iron & steel','iron and steel','alloys','metallurg','forging','castings','rolling mills','sponge iron','pig iron'] },
  { primary: 'Metals & Mining', secondary: 'Mining',
    keywords: ['mining','minerals','quarry','granite','marble','stone'] },
  { primary: 'Metals & Mining', secondary: 'Aluminium & Copper',
    keywords: ['aluminium','aluminum','copper','zinc products','lead products'] },

  // B4. Pharma (generic)
  { primary: 'Healthcare', secondary: 'Pharma',
    keywords: ['pharma','pharmaceutical','pharmaceuticals','drug','drugs','medicine','medicines','biotech','biopharma','laboratory','laboratories','biologics','diagnostics ltd'] },
  { primary: 'Healthcare', secondary: 'Hospitals',
    keywords: ['hospital','hospitals','healthcare','medical centre','clinic','surgical','health care'] },

  // B5. IT (generic — careful: "systems" alone is too broad)
  { primary: 'Information Technology', secondary: 'IT Services',
    keywords: ['software','infotech','informatics','it solutions','it services','computer','cybersecurity','fintech','edtech','healthtech','cloud','saas','data analytics','artificial intelligence','machine learning'] },
  { primary: 'Information Technology', secondary: 'IT Services',
    keywords: ['technologies ltd','technologies limited','tech ltd','tech limited'] },

  // B6. Financial Services (generic — use precise substrings to avoid false matches)
  { primary: 'Financial Services', secondary: 'NBFCs',
    keywords: ['housing finance','home finance','microfinance','micro finance','vehicle finance','equipment finance','consumer finance'] },
  { primary: 'Financial Services', secondary: 'Capital Markets',
    keywords: ['securities ltd','securities limited','stock broking','broking','brokerage','wealth management','asset management','investment management','portfolio management'] },
  { primary: 'Financial Services', secondary: 'NBFCs',
    keywords: [' finance ltd',' finance limited',' finserv',' leasing',' lending','credit corp','capital ventures'] },

  // B7. Energy (generic)
  { primary: 'Energy', secondary: 'Oil & Gas',
    keywords: ['petroleum','petrochem','refinery','refineries','lubricant','lubricants','natural gas','lng','lpg','crude'] },
  { primary: 'Energy', secondary: 'Power Generation',
    keywords: ['power generation','electric power','thermal power','hydropower','hydro power','electricity generation','power transmission'] },
  { primary: 'Energy', secondary: 'Renewables',
    keywords: ['solar energy','solar power','wind energy','wind power','renewable energy','green energy','clean energy','biomass energy'] },

  // B8. Infrastructure (generic)
  { primary: 'Infrastructure', secondary: 'Construction',
    keywords: ['constructions','construction ltd','builders','developer','devcon','developments','townships','realty ltd','realty limited'] },
  { primary: 'Infrastructure', secondary: 'Real Estate',
    keywords: ['properties','real estate','housing project','residential project'] },
  { primary: 'Infrastructure', secondary: 'Cement',
    keywords: ['cement','cements','concrete','ready mix','rmc'] },

  // B9. Chemicals (generic)
  { primary: 'Chemicals', secondary: 'Specialty Chemicals',
    keywords: ['chemicals','chemical','chem','polymers','plastics','resins','coatings','pigments','dyes','adhesives','solvents','intermediates','petrochemical'] },

  // B10. Agri / Sugar / Plantation
  { primary: 'Agriculture', secondary: 'Agri Processing',
    keywords: ['agro','seeds','fertiliser','fertilizers','fertilizer','pesticide','pesticides','insecticide','sugar mills','sugar ltd','sugar limited','plantation','plantations','tea estate','coffee','rubber','cotton','jute','tobacco'] },

  // B11. Automobile (generic)
  { primary: 'Automobile', secondary: 'Auto Ancillaries',
    keywords: ['auto components','auto parts','automotive','automobile ltd','tyres','tires','brakes','axle','auto ancillary','gear','transmission','clutch','suspension','radiator'] },

  // B12. FMCG (generic)
  { primary: 'FMCG', secondary: 'Consumer Staples',
    keywords: ['foods','food products','beverages','dairy','bakery','biscuits','snacks','confectionery','edible oil','spices','vanaspati','aerated water'] },

  // B13. Consumer Services
  { primary: 'Consumer Services', secondary: 'Education',
    keywords: ['education','educational','school','institute','institutes','learning','training','academy','university','college','coaching','educat'] },
  { primary: 'Consumer Services', secondary: 'Hospitality',
    keywords: ['hotel','hotels','hospitality','resort','resorts','tourism','leisure','restaurants','restaurant'] },

  // B14. Media & Entertainment (generic)
  { primary: 'Media & Entertainment', secondary: 'Broadcasting',
    keywords: ['media','entertainment','films','film','movies','studios','television','broadcast','publishing','publications'] },

  // B15. Logistics (generic)
  { primary: 'Logistics', secondary: 'Freight & Shipping',
    keywords: ['logistics','transport','transportation','shipping','cargo','freight','courier','warehousing','supply chain','cold chain'] },

  // B16. Capital Goods / Engineering (generic — placed last; "engineering" is broad)
  { primary: 'Capital Goods', secondary: 'Industrials',
    keywords: ['engineering','equipments','equipment','machinery','machines','industrial','fabrication','pumps','valves','compressors','boilers','generators','electric motors','transformers','switchgear','cables','wires'] },
];

const UNCLASSIFIED = { primary: 'Unclassified', secondary: 'Unclassified' };

const classifyStock = (name: string): { primary: string; secondary: string } => {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return { primary: rule.primary, secondary: rule.secondary };
    }
  }
  return UNCLASSIFIED;
};

const buildTags = (primary: string, secondary: string): string[] => {
  const tags: string[] = ['nse-import'];
  tags.push(`sector:${primary}`);
  tags.push(`industry:${secondary}`);
  if (primary === 'Unclassified') tags.push('unclassified');
  return tags;
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'fetching' | 'preview' | 'importing' | 'done' | 'error';
type CleanupPhase = 'idle' | 'counting' | 'confirming' | 'deleting' | 'done';

interface CategoryStat {
  primary: string;
  secondary: string;
  count: number;
}

const TempNseImportPage = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [equities, setEquities] = useState<NseEquity[]>([]);
  const [categorized, setCategorized] = useState<BulkImportEntry[]>([]);
  const [stats, setStats] = useState<CategoryStat[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);

  // Cleanup state
  const [cleanupPhase, setCleanupPhase] = useState<CleanupPhase>('idle');
  const [cleanupTag, setCleanupTag] = useState<'unclassified' | 'nse-import'>('unclassified');
  const [cleanupCount, setCleanupCount] = useState(0);
  const [cleanupProgress, setCleanupProgress] = useState({ done: 0, total: 0 });
  const [cleanupError, setCleanupError] = useState('');

  const kiteAPI = KiteConnectAPI.getInstance();

  const handleCleanupCount = useCallback(async () => {
    setCleanupPhase('counting');
    setCleanupError('');
    try {
      // getDocs with where to count — reuse deleteStocksByTag's query logic
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const snap = await getDocs(query(collection(db, 'stocks'), where('tags', 'array-contains', cleanupTag)));
      setCleanupCount(snap.size);
      setCleanupPhase('confirming');
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : 'Count failed');
      setCleanupPhase('idle');
    }
  }, [cleanupTag]);

  const handleCleanupDelete = useCallback(async () => {
    setCleanupPhase('deleting');
    setCleanupProgress({ done: 0, total: cleanupCount });
    try {
      const deleted = await deleteStocksByTag(cleanupTag, (done, total) => {
        setCleanupProgress({ done, total });
      });
      setCleanupCount(0);
      setCleanupProgress({ done: deleted, total: deleted });
      setCleanupPhase('done');
    } catch (err) {
      setCleanupError(err instanceof Error ? err.message : 'Delete failed');
      setCleanupPhase('idle');
    }
  }, [cleanupTag, cleanupCount]);

  const resetCleanup = () => {
    setCleanupPhase('idle');
    setCleanupCount(0);
    setCleanupProgress({ done: 0, total: 0 });
    setCleanupError('');
  };

  const handleFetch = useCallback(async () => {
    if (!kiteAPI.isReady()) {
      setErrorMsg('You must be logged in to Zerodha before running the import.');
      setPhase('error');
      return;
    }
    setPhase('fetching');
    setErrorMsg('');
    try {
      const list = await kiteAPI.getNseEquities(forceRefresh);
      setEquities(list);

      // Classify
      const entries: BulkImportEntry[] = list.map(eq => {
        const { primary, secondary } = classifyStock(eq.name);
        return {
          symbol: eq.symbol,
          name: eq.name,
          exchange: 'NSE',
          tags: buildTags(primary, secondary),
          instrument_token: eq.instrument_token,
          isin: eq.isin
        };
      });
      setCategorized(entries);

      // Build stats
      const map = new Map<string, number>();
      for (const e of entries) {
        const primary = e.tags.find(t => t.startsWith('sector:'))?.replace('sector:', '') ?? 'Unclassified';
        const secondary = e.tags.find(t => t.startsWith('industry:'))?.replace('industry:', '') ?? 'Unclassified';
        const key = `${primary}||${secondary}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const statsArr: CategoryStat[] = Array.from(map.entries())
        .map(([k, count]) => {
          const [primary, secondary] = k.split('||');
          return { primary, secondary, count };
        })
        .sort((a, b) => b.count - a.count);
      setStats(statsArr);

      setPhase('preview');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error fetching instruments');
      setPhase('error');
    }
  }, [kiteAPI, forceRefresh]);

  const handleImport = useCallback(async () => {
    setPhase('importing');
    setProgress({ done: 0, total: categorized.length });
    try {
      const result = await bulkAddStockMetadataOnly(categorized, (done, total) => {
        setProgress({ done, total });
      });
      setImportResult(result);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Import failed');
      setPhase('error');
    }
  }, [categorized]);

  const handleRetryFailed = useCallback(async () => {
    if (!importResult || importResult.failedEntries.length === 0) return;
    const failedSymbols = new Set(importResult.failedEntries.map(f => f.symbol));
    const retryEntries = categorized.filter(e => failedSymbols.has(e.symbol));

    setPhase('importing');
    setProgress({ done: 0, total: retryEntries.length });
    try {
      const result = await bulkAddStockMetadataOnly(retryEntries, (done, total) => {
        setProgress({ done, total });
      });
      setImportResult(prev => prev ? {
        imported: prev.imported + result.imported,
        skipped: prev.skipped + result.skipped,
        failed: result.failed,
        failedEntries: result.failedEntries
      } : result);
      setPhase('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Retry failed');
      setPhase('error');
    }
  }, [categorized, importResult]);

  const reset = () => {
    setPhase('idle');
    setEquities([]);
    setCategorized([]);
    setStats([]);
    setProgress({ done: 0, total: 0 });
    setImportResult(null);
    setErrorMsg('');
  };

  const classified = stats.filter(s => s.primary !== 'Unclassified').reduce((a, s) => a + s.count, 0);
  const unclassified = stats.find(s => s.primary === 'Unclassified')?.count ?? 0;

  return (
    <div className="container py-4">
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-1">
        <h4 className="mb-0">🗂️ NSE Equity Import</h4>
        <span className="badge bg-warning text-dark">TEMP</span>
      </div>
      <p className="text-muted small mb-4">
        Fetches the full NSE equity universe from Zerodha and saves metadata-only entries
        (symbol, name, exchange, sector/industry tags) to Firestore.
        <strong> No price data or historical data is fetched.</strong>
      </p>

      {/* ── Cleanup section ────────────────────────────────────────────────── */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderLeft: '4px solid #dc3545' }}>
        <div className="card-header bg-danger bg-opacity-10">
          <h6 className="mb-0 text-danger">🗑️ Cleanup — Delete Existing Imported Stocks</h6>
        </div>
        <div className="card-body">
          {cleanupError && (
            <div className="alert alert-danger py-2 small mb-3">{cleanupError}</div>
          )}

          {cleanupPhase === 'idle' && (
            <>
              <p className="text-muted small mb-3">
                Use this to remove previously imported stocks before re-running with improved classification.
              </p>
              <div className="d-flex gap-3 align-items-end flex-wrap">
                <div>
                  <label className="form-label small fw-semibold mb-1">What to delete</label>
                  <select
                    className="form-select form-select-sm"
                    value={cleanupTag}
                    onChange={e => setCleanupTag(e.target.value as 'unclassified' | 'nse-import')}
                    style={{ width: 260 }}
                  >
                    <option value="unclassified">Only unclassified (tag: unclassified)</option>
                    <option value="nse-import">All NSE import stocks (tag: nse-import)</option>
                  </select>
                </div>
                <button className="btn btn-outline-danger btn-sm" onClick={handleCleanupCount}>
                  Count matching stocks…
                </button>
              </div>
            </>
          )}

          {cleanupPhase === 'counting' && (
            <div className="d-flex align-items-center gap-2 text-muted small">
              <span className="spinner-border spinner-border-sm" />
              Counting stocks tagged <code>{cleanupTag}</code>…
            </div>
          )}

          {cleanupPhase === 'confirming' && (
            <div>
              <div className="alert alert-warning py-2 mb-3 small">
                <strong>{cleanupCount.toLocaleString()} stocks</strong> tagged <code>{cleanupTag}</code> will be permanently deleted.
                This cannot be undone.
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-danger btn-sm" onClick={handleCleanupDelete}>
                  🗑️ Delete {cleanupCount.toLocaleString()} stocks
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={resetCleanup}>Cancel</button>
              </div>
            </div>
          )}

          {cleanupPhase === 'deleting' && (
            <div>
              <p className="small text-muted mb-1">
                Deleting… {cleanupProgress.done.toLocaleString()} / {cleanupProgress.total.toLocaleString()}
              </p>
              <div className="progress" style={{ height: 16 }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated bg-danger"
                  style={{ width: `${cleanupProgress.total ? Math.round((cleanupProgress.done / cleanupProgress.total) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {cleanupPhase === 'done' && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-success fw-semibold">
                ✅ Deleted {cleanupProgress.done.toLocaleString()} stocks successfully.
              </span>
              <button className="btn btn-outline-secondary btn-sm" onClick={resetCleanup}>Reset</button>
            </div>
          )}
        </div>
      </div>

      {/* Auth warning */}
      {!kiteAPI.isReady() && (
        <div className="alert alert-warning d-flex align-items-center gap-2">
          <span>⚠️</span>
          <span>You are not logged in to Zerodha. Please log in from the Dashboard before running the import.</span>
        </div>
      )}

      {/* Error */}
      {phase === 'error' && (
        <div className="alert alert-danger d-flex justify-content-between align-items-start">
          <div>
            <strong>Error:</strong> {errorMsg}
          </div>
          <button className="btn btn-sm btn-outline-danger" onClick={reset}>Reset</button>
        </div>
      )}

      {/* ── Step 1: Fetch ──────────────────────────────────────────────────── */}
      {(phase === 'idle' || phase === 'fetching') && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="card-title">Step 1 — Fetch NSE Equity List</h6>
            <p className="text-muted small">
              Calls <code>GET /api/instruments/nse/equity</code> (requires valid Zerodha session).
              Results are cached server-side for 24 hours.
            </p>
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="forceRefresh"
                checked={forceRefresh}
                onChange={e => setForceRefresh(e.target.checked)}
                disabled={phase === 'fetching'}
              />
              <label className="form-check-label small" htmlFor="forceRefresh">
                Force server-side cache refresh (re-fetch from Zerodha)
              </label>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleFetch}
              disabled={phase === 'fetching' || !kiteAPI.isReady()}
            >
              {phase === 'fetching' ? (
                <><span className="spinner-border spinner-border-sm me-2" />Fetching…</>
              ) : (
                '📥 Fetch NSE Equity List'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview & classify ─────────────────────────────────────── */}
      {(phase === 'preview' || phase === 'importing' || phase === 'done') && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="card-title mb-0">Step 2 — Category Preview</h6>
              <span className="badge bg-secondary">{equities.length.toLocaleString()} equities fetched</span>
            </div>

            {/* Summary badges */}
            <div className="d-flex gap-3 flex-wrap mb-3">
              <span className="badge bg-success fs-6">{classified.toLocaleString()} classified</span>
              <span className={`badge fs-6 ${unclassified > 0 ? 'bg-warning text-dark' : 'bg-success'}`}>
                {unclassified.toLocaleString()} unclassified
              </span>
            </div>

            {/* Category table */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light sticky-top">
                  <tr>
                    <th>Primary Sector</th>
                    <th>Industry</th>
                    <th className="text-end">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map(s => (
                    <tr key={`${s.primary}||${s.secondary}`}>
                      <td>
                        <span className={`badge me-1 ${s.primary === 'Unclassified' ? 'bg-warning text-dark' : 'bg-primary'}`}>
                          {s.primary}
                        </span>
                      </td>
                      <td className="text-muted small">{s.secondary}</td>
                      <td className="text-end fw-semibold">{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Import ─────────────────────────────────────────────────── */}
      {phase === 'preview' && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="card-title">Step 3 — Import to Firestore</h6>
            <p className="text-muted small mb-3">
              Writes <strong>metadata only</strong> (symbol, name, exchange, tags) in batches of 20.
              Existing stocks will have tags merged — no duplicates will be created.
              <strong> No quotes and no historical data will be fetched.</strong>
            </p>
            <button className="btn btn-success" onClick={handleImport}>
              🚀 Start Import ({categorized.length.toLocaleString()} stocks)
            </button>
          </div>
        </div>
      )}

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {phase === 'importing' && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="card-title">Importing…</h6>
            <div className="progress mb-2" style={{ height: 20 }}>
              <div
                className="progress-bar progress-bar-striped progress-bar-animated"
                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
              >
                {progress.done}/{progress.total}
              </div>
            </div>
            <p className="text-muted small mb-0">
              {progress.done.toLocaleString()} / {progress.total.toLocaleString()} processed
            </p>
          </div>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────────────────────── */}
      {phase === 'done' && importResult && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <h6 className="card-title text-success">✅ Import Complete</h6>
            <div className="row g-3 mb-3">
              <div className="col-auto">
                <div className="border rounded p-3 text-center" style={{ minWidth: 100 }}>
                  <div className="fs-4 fw-bold text-success">{importResult.imported.toLocaleString()}</div>
                  <div className="small text-muted">Imported</div>
                </div>
              </div>
              <div className="col-auto">
                <div className="border rounded p-3 text-center" style={{ minWidth: 100 }}>
                  <div className="fs-4 fw-bold text-secondary">{importResult.skipped.toLocaleString()}</div>
                  <div className="small text-muted">Skipped (tags merged)</div>
                </div>
              </div>
              <div className="col-auto">
                <div className={`border rounded p-3 text-center ${importResult.failed > 0 ? 'border-danger' : ''}`} style={{ minWidth: 100 }}>
                  <div className={`fs-4 fw-bold ${importResult.failed > 0 ? 'text-danger' : 'text-success'}`}>{importResult.failed}</div>
                  <div className="small text-muted">Failed</div>
                </div>
              </div>
            </div>

            {importResult.failedEntries.length > 0 && (
              <div className="mb-3">
                <p className="small text-danger mb-1">Failed entries:</p>
                <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                  <table className="table table-sm table-danger mb-0">
                    <thead><tr><th>Symbol</th><th>Reason</th></tr></thead>
                    <tbody>
                      {importResult.failedEntries.map(f => (
                        <tr key={f.symbol}>
                          <td><code>{f.symbol}</code></td>
                          <td className="small">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="btn btn-sm btn-outline-danger mt-2" onClick={handleRetryFailed}>
                  🔁 Retry Failed ({importResult.failedEntries.length})
                </button>
              </div>
            )}

            <button className="btn btn-outline-secondary btn-sm" onClick={reset}>
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TempNseImportPage;
