import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../hooks/useAuth'
import { db } from '../lib/firebase'
import {
  collection, query, where, orderBy, getDocs
} from 'firebase/firestore'
import { Avatar, Badge } from '../components/shared/index'
import toast from 'react-hot-toast'

/* ── CSV Export ─────────────────────────────────────────────── */
const CSV_COLS = [
  { key:'name',              label:'Name'              },
  { key:'class',             label:'Class'             },
  { key:'section',           label:'Section'           },
  { key:'year',              label:'Year'              },
  { key:'roll_number',       label:'Roll Number'       },
  { key:'admission_number',  label:'Admission No'      },
  { key:'student_id',        label:'Student ID'        },
  { key:'fathers_name',      label:"Father's Name"     },
  { key:'date_of_birth',     label:'Date of Birth'     },
  { key:'blood_group',       label:'Blood Group'       },
  { key:'contact_number',    label:'Contact Number'    },
  { key:'emergency_contact', label:'Emergency Contact' },
  { key:'email_id',          label:'Email'             },
  { key:'employee_id',       label:'Employee ID'       },
  { key:'designation',       label:'Designation'       },
  { key:'department',        label:'Department'        },
  { key:'aadhar_card',       label:'Aadhaar Number'    },
  { key:'valid_from',        label:'Valid From'        },
  { key:'valid_till',        label:'Valid Till'        },
  { key:'batch_timing',      label:'Batch / Timing'    },
  { key:'address',           label:'Address'           },
  { key:'mode_of_transport', label:'Mode of Transport' },
  { key:'status',            label:'Status'            },
]

function exportCSV(rows, filename) {
  const escape = v => {
    if (v == null) return ''
    let s = typeof v === 'object' && v.toDate ? v.toDate().toLocaleDateString('en-IN') : String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) s = `"${s.replace(/"/g,'""')}"`
    return s
  }
  const activeCols = CSV_COLS.filter(c => rows.some(r => r[c.key]))
  const header = activeCols.map(c => c.label).join(',')
  const body   = rows.map(r => activeCols.map(c => escape(r[c.key])).join(',')).join('\n')
  const blob   = new Blob([`${header}\n${body}`], { type:'text/csv;charset=utf-8;' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

/* ── Theme ──────────────────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('org-theme') === 'dark' } catch { return false }
  })
  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.style.setProperty('--bg',       '#0f1117')
      root.style.setProperty('--bg2',      '#161b27')
      root.style.setProperty('--bg3',      '#1e2535')
      root.style.setProperty('--border',   '#2a3347')
      root.style.setProperty('--ink',      '#f1f5f9')
      root.style.setProperty('--ink2',     '#94a3b8')
      root.style.setProperty('--ink3',     '#64748b')
      root.style.setProperty('--accent',   '#3b6bff')
      root.style.setProperty('--accent-s', 'rgba(59,107,255,0.12)')
    } else {
      root.style.setProperty('--bg',       '#f8f9fc')
      root.style.setProperty('--bg2',      '#ffffff')
      root.style.setProperty('--bg3',      '#f1f4f9')
      root.style.setProperty('--border',   '#e2e8f0')
      root.style.setProperty('--ink',      '#0f172a')
      root.style.setProperty('--ink2',     '#475569')
      root.style.setProperty('--ink3',     '#94a3b8')
      root.style.setProperty('--accent',   '#2352ff')
      root.style.setProperty('--accent-s', 'rgba(35,82,255,0.08)')
    }
    try { localStorage.setItem('org-theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])
  return [dark, () => setDark(d => !d)]
}

const fmtDate = d => {
  if (!d) return '—'
  const date = d?.toDate ? d.toDate() : new Date(d)
  return isNaN(date) ? '—' : date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

/* ── Spinner ─────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 0', gap:16 }}>
      <div style={{ width:32, height:32, border:'2.5px solid var(--border)', borderTopColor:'var(--accent)', borderRadius:'50%', animation:'org-spin .7s linear infinite' }}/>
      <span style={{ fontSize:13, color:'var(--ink3)', letterSpacing:.3 }}>Loading records...</span>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function OrgDashboard() {
  const { orgUser, signOut } = useAuth()
  const [dark, toggleTheme]  = useTheme()

  const [submissions,      setSubmissions]      = useState([])
  const [orgClassesConfig, setOrgClassesConfig] = useState([])
  const [loading,          setLoading]          = useState(true)
  const [viewSub,          setViewSub]          = useState(null)

  const [search,      setSearch]      = useState('')
  const [filterClass, setFilterClass] = useState('All')
  const [filterSec,   setFilterSec]   = useState('All')
  const [filterStat,  setFilterStat]  = useState('All')

  useEffect(() => {
    if (!orgUser?.orgName) return
    setLoading(true)

    const fetchOrg = async () => {
      try {
        const orgSnap = await getDocs(
          query(collection(db, 'organizations'), where('name', '==', orgUser.orgName))
        )
        if (!orgSnap.empty) {
          const orgData = orgSnap.docs[0].data()
          if (orgData.classes_config?.length > 0) setOrgClassesConfig(orgData.classes_config)
        }
      } catch (err) { console.warn('Org fetch failed:', err.message) }
    }

    const fetchSubs = async () => {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('school_name', '==', orgUser.orgName),
          orderBy('submitted_at', 'desc')
        )
        const snap = await getDocs(q)
        setSubmissions(snap.docs.map(d => ({ id:d.id, ...d.data() })))
      } catch (err) { console.error(err); toast.error('Failed to load records') }
      finally { setLoading(false) }
    }

    fetchOrg()
    fetchSubs()
  }, [orgUser?.orgName])

  const handleClassChange = useCallback(val => {
    setFilterClass(val); setFilterSec('All')
  }, [])

  const classes = useMemo(() => {
    if (orgClassesConfig.length > 0) return ['All', ...orgClassesConfig.map(c => c.name)]
    return ['All', ...[...new Set(submissions.map(s => s['class']).filter(Boolean))].sort()]
  }, [orgClassesConfig, submissions])

  const sections = useMemo(() => {
    if (orgClassesConfig.length > 0 && filterClass !== 'All') {
      const cls = orgClassesConfig.find(c => c.name === filterClass)
      return ['All', ...(cls?.sections || [])]
    }
    const base = submissions.filter(s => filterClass === 'All' || s['class'] === filterClass)
    return ['All', ...[...new Set(base.map(s => s.section).filter(Boolean))].sort()]
  }, [orgClassesConfig, submissions, filterClass])

  const filtered = useMemo(() => {
    let rows = submissions
    if (filterClass !== 'All') rows = rows.filter(s => s['class'] === filterClass)
    if (filterSec   !== 'All') rows = rows.filter(s => s.section  === filterSec)
    if (filterStat  !== 'All') rows = rows.filter(s => s.status   === filterStat)
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(s =>
        (s.name           || '').toLowerCase().includes(q) ||
        (s.contact_number || '').includes(q)
      )
    }
    return rows
  }, [submissions, filterClass, filterSec, filterStat, search])

  const visibleCols = useMemo(() => {
    const candidates = [
      { key:'name',           label:'Student Name'  },
      { key:'class',          label:'Class'         },
      { key:'section',        label:'Section'       },
      { key:'year',           label:'Year'          },
      { key:'roll_number',    label:'Roll No.'      },
      { key:'student_id',     label:'Student ID'    },
      { key:'contact_number', label:'Contact'       },
      { key:'blood_group',    label:'Blood Group'   },
      { key:'designation',    label:'Designation'   },
      { key:'department',     label:'Department'    },
      { key:'status',         label:'Status'        },
    ]
    return candidates.filter(c => submissions.some(s => s[c.key]))
  }, [submissions])

  const handleExport = () => {
    if (!filtered.length) { toast.error('No records to export'); return }
    const parts = [orgUser.orgName.replace(/\s+/g,'_')]
    if (filterClass !== 'All') parts.push(filterClass)
    if (filterSec   !== 'All') parts.push(filterSec)
    if (filterStat  !== 'All') parts.push(filterStat)
    parts.push(new Date().toISOString().slice(0,10))
    exportCSV(filtered, `${parts.join('_')}.csv`)
    toast.success(`${filtered.length} records exported`)
  }

  const clearFilters = () => {
    setSearch(''); setFilterClass('All'); setFilterSec('All'); setFilterStat('All')
  }

  const hasFilters = search || filterClass !== 'All' || filterSec !== 'All' || filterStat !== 'All'
  const total    = submissions.length
  const approved = submissions.filter(s => s.status === 'approved').length
  const pending  = submissions.filter(s => s.status === 'pending').length
  const rejected = submissions.filter(s => s.status === 'rejected').length

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:"'Inter', 'Segoe UI', system-ui, sans-serif", transition:'background .2s, color .2s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes org-spin { to { transform: rotate(360deg) } }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .org-topbar {
          position: sticky; top: 0; z-index: 200;
          background: var(--bg2);
          border-bottom: 1px solid var(--border);
          height: 60px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px;
        }

        .org-body { max-width: 1280px; margin: 0 auto; padding: 32px 32px 64px; }

        .org-page-header {
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-bottom: 28px; padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }

        .org-stats-row {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 16px;
          margin-bottom: 28px;
        }

        .org-stat-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 20px 22px;
          transition: border-color .15s;
        }
        .org-stat-card:hover { border-color: var(--accent); }

        .org-stat-num {
          font-size: 32px; font-weight: 700;
          letter-spacing: -1px;
          line-height: 1;
          margin-bottom: 6px;
        }

        .org-stat-label {
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: .8px;
          color: var(--ink3);
        }

        .org-stat-bar {
          height: 3px; border-radius: 2px;
          margin-top: 14px;
          background: var(--bg3);
          overflow: hidden;
        }

        .org-table-card {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
        }

        .org-toolbar {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg2);
          display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
        }

        .org-search {
          flex: 1; min-width: 220px;
          display: flex; align-items: center; gap: 8px;
          background: var(--bg3);
          border: 1px solid var(--border);
          border-radius: 7px;
          padding: 0 14px;
          height: 38px;
          transition: border-color .15s, box-shadow .15s;
        }
        .org-search:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-s);
        }
        .org-search input {
          background: transparent; border: none; outline: none;
          font-size: 13px; color: var(--ink); width: 100%;
          font-family: inherit;
        }
        .org-search input::placeholder { color: var(--ink3); }

        .org-select {
          height: 38px; padding: 0 12px;
          border-radius: 7px;
          border: 1px solid var(--border);
          background: var(--bg3);
          color: var(--ink);
          font-size: 13px; font-family: inherit;
          outline: none; cursor: pointer;
          transition: border-color .15s;
        }
        .org-select:focus { border-color: var(--accent); }
        .org-select:disabled { opacity: .45; cursor: not-allowed; }

        .org-btn {
          height: 38px; padding: 0 16px;
          border-radius: 7px; border: none;
          font-size: 13px; font-weight: 600;
          font-family: inherit; cursor: pointer;
          transition: all .15s;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .org-btn-primary {
          background: var(--accent); color: #fff;
        }
        .org-btn-primary:hover { filter: brightness(1.1); }

        .org-btn-ghost {
          background: var(--bg3);
          border: 1px solid var(--border);
          color: var(--ink2);
        }
        .org-btn-ghost:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-s); }

        .org-btn-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--ink2);
        }
        .org-btn-outline:hover { border-color: var(--ink2); color: var(--ink); }

        .org-chips {
          display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
          padding: 10px 20px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }

        .org-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
          background: var(--accent-s); color: var(--accent);
          cursor: pointer; transition: opacity .15s;
        }
        .org-chip:hover { opacity: .7; }

        .org-table { width: 100%; border-collapse: collapse; min-width: 500px; }

        .org-th {
          padding: 11px 16px;
          text-align: left;
          font-size: 11px; font-weight: 600;
          color: var(--ink3);
          text-transform: uppercase; letter-spacing: .7px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
          white-space: nowrap;
        }

        .org-td {
          padding: 13px 16px;
          font-size: 13px;
          color: var(--ink2);
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }

        .org-tr { transition: background .1s; cursor: pointer; }
        .org-tr:hover td { background: var(--bg3); }
        .org-tr:last-child td { border-bottom: none; }

        .org-status-dot {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 600;
        }

        .org-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; padding: 72px 24px; gap: 10px;
          text-align: center;
        }

        .org-footer {
          padding: 12px 20px;
          border-top: 1px solid var(--border);
          background: var(--bg);
          display: flex; justify-content: space-between; align-items: center;
          font-size: 12px; color: var(--ink3);
        }

        .org-modal-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,.5);
          backdrop-filter: blur(6px);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }

        .org-modal {
          background: var(--bg2);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 28px;
          width: 100%; max-width: 520px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 24px 80px rgba(0,0,0,.25);
        }

        .org-field-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
        }

        .org-field-item {
          background: var(--bg3);
          border-radius: 8px;
          padding: 10px 12px;
        }

        .org-field-key {
          font-size: 10px; font-weight: 600;
          color: var(--ink3);
          text-transform: uppercase; letter-spacing: .6px;
          margin-bottom: 3px;
        }

        .org-field-val {
          font-size: 13px; font-weight: 500;
          color: var(--ink);
          word-break: break-word;
        }

        .org-theme-btn {
          width: 34px; height: 34px;
          border-radius: 7px;
          border: 1px solid var(--border);
          background: var(--bg3);
          color: var(--ink2);
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px;
          transition: all .15s;
        }
        .org-theme-btn:hover { border-color: var(--accent); color: var(--accent); }

        .org-divider { height: 1px; background: var(--border); margin: 16px 0; }

        @media (max-width: 900px) {
          .org-stats-row { grid-template-columns: repeat(2,1fr) !important; }
          .org-body { padding: 20px !important; }
          .org-topbar { padding: 0 20px !important; }
          .org-page-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
        @media (max-width: 600px) {
          .org-stats-row { grid-template-columns: repeat(2,1fr) !important; gap:10px !important; }
          .org-body { padding: 14px !important; }
          .org-toolbar { flex-direction: column !important; }
          .org-search { min-width: 100% !important; }
          .org-field-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Top Bar ── */}
      <header className="org-topbar">
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {orgUser?.logoUrl ? (
            <img src={orgUser.logoUrl}
              style={{ width:34, height:34, borderRadius:7, objectFit:'cover', border:'1px solid var(--border)' }}
              alt="logo"/>
          ) : (
            <div style={{ width:34, height:34, borderRadius:7, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff', letterSpacing:-.3 }}>
              {(orgUser?.orgName||'').slice(0,2).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'var(--ink)', letterSpacing:-.2 }}>{orgUser?.orgName || 'Organization'}</div>
            <div style={{ fontSize:11, color:'var(--ink3)', letterSpacing:.2 }}>Student Records Portal</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="org-theme-btn" onClick={toggleTheme} title={dark ? 'Switch to light' : 'Switch to dark'}>
            {dark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>
          <button className="org-btn org-btn-outline" onClick={signOut} style={{ height:34, fontSize:12 }}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="org-body">

        {/* ── Page Header ── */}
        <div className="org-page-header">
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.8, marginBottom:6 }}>
              {new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </div>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--ink)', letterSpacing:-.4 }}>Student Records</h1>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="org-btn org-btn-primary" onClick={handleExport}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="org-stats-row">
          {[
            { label:'Total Records', val:total,    color:'var(--accent)', pct: 100 },
            { label:'Approved',      val:approved, color:'#10b981',       pct: total ? Math.round(approved/total*100) : 0 },
            { label:'Pending',       val:pending,  color:'#f59e0b',       pct: total ? Math.round(pending/total*100)  : 0 },
            { label:'Rejected',      val:rejected, color:'#ef4444',       pct: total ? Math.round(rejected/total*100) : 0 },
          ].map(s => (
            <div key={s.label} className="org-stat-card">
              <div className="org-stat-num" style={{ color: s.color }}>{s.val}</div>
              <div className="org-stat-label">{s.label}</div>
              <div className="org-stat-bar">
                <div style={{ width:`${s.pct}%`, height:'100%', background:s.color, borderRadius:2, transition:'width .6s ease' }}/>
              </div>
            </div>
          ))}
        </div>

        {/* ── Table Card ── */}
        <div className="org-table-card">

          {/* Toolbar */}
          <div className="org-toolbar">
            <div className="org-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or phone number"
              />
              {search && (
                <button onClick={() => setSearch('')}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink3)', fontSize:14, lineHeight:1, padding:0, flexShrink:0 }}>
                  ×
                </button>
              )}
            </div>

            <select className="org-select" value={filterClass} onChange={e => handleClassChange(e.target.value)}>
              {classes.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Classes' : c}</option>
              ))}
            </select>

            <select className="org-select" value={filterSec}
              onChange={e => setFilterSec(e.target.value)}
              disabled={filterClass === 'All'}>
              {sections.map(s => (
                <option key={s} value={s}>{s === 'All' ? 'All Sections' : s}</option>
              ))}
            </select>

            <select className="org-select" value={filterStat} onChange={e => setFilterStat(e.target.value)}>
              <option value="All">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>

            {hasFilters && (
              <button className="org-btn org-btn-ghost" onClick={clearFilters} style={{ height:38, fontSize:12 }}>
                Clear filters
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {hasFilters && (
            <div className="org-chips">
              <span style={{ fontSize:11, color:'var(--ink3)', fontWeight:600, marginRight:2 }}>Active:</span>
              {filterClass !== 'All' && <span className="org-chip" onClick={() => handleClassChange('All')}>{filterClass} ×</span>}
              {filterSec   !== 'All' && <span className="org-chip" onClick={() => setFilterSec('All')}>{filterSec} ×</span>}
              {filterStat  !== 'All' && <span className="org-chip" onClick={() => setFilterStat('All')}>{filterStat} ×</span>}
              {search      &&           <span className="org-chip" onClick={() => setSearch('')}>"{search}" ×</span>}
              <span style={{ marginLeft:'auto', fontSize:11, color:'var(--ink3)' }}>
                {filtered.length} of {total} records
              </span>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <div className="org-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--ink3)" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <div style={{ fontSize:15, fontWeight:600, color:'var(--ink)' }}>No records found</div>
              <div style={{ fontSize:13, color:'var(--ink3)' }}>
                {hasFilters ? 'Try adjusting your filters or search query.' : 'No student submissions yet for this organization.'}
              </div>
              {hasFilters && (
                <button className="org-btn org-btn-ghost" onClick={clearFilters} style={{ marginTop:8 }}>
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table className="org-table">
                <thead>
                  <tr>
                    <th className="org-th" style={{ width:40 }}>#</th>
                    <th className="org-th" style={{ width:48 }}></th>
                    {visibleCols.map(c => (
                      <th key={c.key} className="org-th">{c.label}</th>
                    ))}
                    <th className="org-th" style={{ width:80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr key={s.id} className="org-tr" onClick={() => setViewSub(s)}>
                      <td className="org-td" style={{ color:'var(--ink3)', fontSize:12, fontVariantNumeric:'tabular-nums' }}>{idx + 1}</td>
                      <td className="org-td">
                        <Avatar name={s.name || ''} size={30} src={s.photo_url}
                          style={{ borderRadius:6 }}/>
                      </td>
                      {visibleCols.map(c => (
                        <td key={c.key} className="org-td">
                          {c.key === 'status' ? (
                            <span className="org-status-dot">
                              <span style={{ width:6, height:6, borderRadius:'50%', flexShrink:0, background: s.status==='approved'?'#10b981':s.status==='pending'?'#f59e0b':'#ef4444', display:'inline-block' }}/>
                              <span style={{ color: s.status==='approved'?'#10b981':s.status==='pending'?'#f59e0b':'#ef4444', textTransform:'capitalize' }}>{s.status}</span>
                            </span>
                          ) : (
                            <span style={{ color: c.key === 'name' ? 'var(--ink)' : 'var(--ink2)', fontWeight: c.key === 'name' ? 600 : 400 }}>
                              {s[c.key] || '—'}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="org-td">
                        <button
                          onClick={e => { e.stopPropagation(); setViewSub(s) }}
                          className="org-btn org-btn-ghost"
                          style={{ height:30, padding:'0 12px', fontSize:12 }}>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="org-footer">
              <span>Showing {filtered.length} of {total} records</span>
              <span>{orgUser?.orgName}</span>
            </div>
          )}
        </div>
      </main>

      {/* ── Detail Modal ── */}
      {viewSub && (
        <div className="org-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setViewSub(null) }}>
          <div className="org-modal">

            {/* Modal header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:17, fontWeight:700, color:'var(--ink)', letterSpacing:-.3 }}>Student Record</h2>
              <button onClick={() => setViewSub(null)}
                style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, color:'var(--ink3)' }}>
                ×
              </button>
            </div>

            {/* Student identity block */}
            <div style={{ display:'flex', gap:16, alignItems:'flex-start', padding:16, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, marginBottom:20 }}>
              {viewSub.photo_url
                ? <img src={viewSub.photo_url} style={{ width:64, height:80, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)', flexShrink:0 }} alt=""/>
                : <Avatar name={viewSub.name||''} size={64} style={{ borderRadius:8, flexShrink:0 }}/>
              }
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:17, fontWeight:700, color:'var(--ink)', letterSpacing:-.2, marginBottom:4 }}>{viewSub.name || '—'}</div>
                <div style={{ fontSize:12, color:'var(--ink3)', marginBottom:10 }}>{orgUser?.orgName}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {viewSub.role && (
                    <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4, background:'var(--accent-s)', color:'var(--accent)', textTransform:'uppercase', letterSpacing:.5 }}>
                      {viewSub.role}
                    </span>
                  )}
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:4, textTransform:'uppercase', letterSpacing:.5,
                    background: viewSub.status==='approved'?'rgba(16,185,129,.1)':viewSub.status==='pending'?'rgba(245,158,11,.1)':'rgba(239,68,68,.1)',
                    color: viewSub.status==='approved'?'#10b981':viewSub.status==='pending'?'#f59e0b':'#ef4444'
                  }}>
                    {viewSub.status}
                  </span>
                </div>
              </div>
            </div>

            {/* All fields */}
            <div style={{ fontSize:11, fontWeight:600, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.7, marginBottom:10 }}>Details</div>
            <div className="org-field-grid">
              {CSV_COLS.filter(c => viewSub[c.key]).map(c => (
                <div key={c.key} className="org-field-item">
                  <div className="org-field-key">{c.label}</div>
                  <div className="org-field-val">{viewSub[c.key]}</div>
                </div>
              ))}
            </div>

            {/* Signature */}
            {viewSub.principal_signature && (
              <>
                <div className="org-divider"/>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--ink3)', textTransform:'uppercase', letterSpacing:.7, marginBottom:10 }}>Principal Signature</div>
                <img src={viewSub.principal_signature} alt="signature"
                  style={{ height:56, maxWidth:'100%', objectFit:'contain', background:'#fff', padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)' }}/>
              </>
            )}

            <div className="org-divider"/>
            <div style={{ fontSize:11, color:'var(--ink3)', marginBottom:16 }}>
              Submitted: {fmtDate(viewSub.submitted_at)}
            </div>

            <button className="org-btn org-btn-ghost" onClick={() => setViewSub(null)}
              style={{ width:'100%', height:38, justifyContent:'center' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
