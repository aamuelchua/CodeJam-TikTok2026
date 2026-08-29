import { Activity, Target, Lock, Slash, Sparkles, Code } from 'lucide-react'

/**
 * StateInspector
 * Real-time debug panel showing the current conversation slots,
 * intent track, entropy score, and filter chips.
 */
export default function StateInspector({ sessionId, sessionState }) {
  const hasState = Boolean(sessionState)

  const intent = sessionState?.intentTrack ?? 'BROWSING'
  const hardFilters = sessionState?.hardFilters ?? {}
  const negativeFilters = sessionState?.negativeFilters ?? []
  const softPreferences = sessionState?.softPreferences ?? []

  const hardEntries = Object.entries(hardFilters).filter(([, v]) => v !== null && v !== undefined)

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-500" />
          <span className="panel-title">State Machine Inspector</span>
        </div>
        {hasState && (
          <span className={`badge ${intent === 'BUYING' ? 'badge-buying' : 'badge-browsing'}`}>
            {intent}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0">
        {!sessionId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <Activity className="w-8 h-8 text-slate-400 opacity-40" />
            <p className="text-slate-500 text-xs">State slots will appear here once a session starts.</p>
          </div>
        ) : !hasState ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <Activity className="w-8 h-8 text-slate-400 opacity-40" />
            <p className="text-slate-500 text-xs">Waiting for first turn…</p>
          </div>
        ) : (
          <>
            {/* Intent Track */}
            <Section icon={Target} title="Intent Track">
              <span className={`badge text-xs ${intent === 'BUYING' ? 'badge-buying' : 'badge-browsing'}`}>
                {intent === 'BUYING' ? 'Buying Mode' : 'Browsing Mode'}
              </span>
            </Section>

            {/* Hard Filters */}
            <Section icon={Lock} title="Hard Filters" empty={hardEntries.length === 0} emptyMsg="No hard filters active">
              <div className="flex flex-wrap gap-1.5">
                {hardEntries.map(([key, val]) => (
                  <span key={key} className="chip chip-hard">
                    <span>#{key}:</span>
                    <span>{String(val)}</span>
                  </span>
                ))}
              </div>
            </Section>

            {/* Negative Filters */}
            <Section icon={Slash} title="Negative Filters" empty={negativeFilters.length === 0} emptyMsg="None excluded">
              <div className="flex flex-wrap gap-1.5">
                {negativeFilters.map((f, i) => (
                  <span key={i} className="chip chip-neg">
                    <span>✕</span>
                    <span>{f}</span>
                  </span>
                ))}
              </div>
            </Section>

            {/* Soft Preferences */}
            <Section icon={Sparkles} title="Soft Preferences" empty={softPreferences.length === 0} emptyMsg="No preferences yet">
              <div className="flex flex-wrap gap-1.5">
                {softPreferences.map((p, i) => (
                  <span key={i} className="chip chip-soft">
                    {p}
                  </span>
                ))}
              </div>
            </Section>

            {/* Raw JSON */}
            <Section icon={Code} title="Raw State JSON">
              <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-950 rounded-xl p-3 overflow-x-auto leading-relaxed border border-slate-200 dark:border-slate-800">
                {JSON.stringify(sessionState, null, 2)}
              </pre>
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, children, empty = false, emptyMsg = 'Empty' }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-brand-500" />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</span>
      </div>
      {empty ? (
        <p className="text-xs text-slate-400 italic pl-1">{emptyMsg}</p>
      ) : (
        children
      )}
    </div>
  )
}
