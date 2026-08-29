/**
 * StateInspector
 *
 * Real-time debug panel showing the current conversation slots,
 * intent track, entropy score, and filter chips.
 *
 * Props:
 *   sessionId    string | null
 *   sessionState object | null  — latest state from turn response
 */
export default function StateInspector({ sessionId, sessionState }) {
  const hasState = Boolean(sessionState)

  const intent = sessionState?.intentTrack ?? 'BROWSING'
  const hardFilters = sessionState?.hardFilters ?? {}
  const negativeFilters = sessionState?.negativeFilters ?? []
  const softPreferences = sessionState?.softPreferences ?? []

  const hardEntries = Object.entries(hardFilters).filter(([, v]) => v !== null && v !== undefined)

  return (
    <>
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔬</span>
          <span className="panel-title">State Inspector</span>
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
            <span className="text-3xl opacity-30">🔬</span>
            <p className="text-gray-600 text-xs">State will appear here once a session starts.</p>
          </div>
        ) : !hasState ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
            <span className="text-3xl opacity-30">💤</span>
            <p className="text-gray-600 text-xs">Waiting for first turn…</p>
          </div>
        ) : (
          <>
            {/* Intent Track */}
            <Section icon="🎯" title="Intent Track">
              <span className={`badge text-sm ${intent === 'BUYING' ? 'badge-buying' : 'badge-browsing'}`}>
                {intent === 'BUYING' ? '🛒 Buying' : '👀 Browsing'}
              </span>
            </Section>

            {/* Hard Filters */}
            <Section icon="🔒" title="Hard Filters" empty={hardEntries.length === 0} emptyMsg="No hard filters yet">
              <div className="flex flex-wrap gap-1.5">
                {hardEntries.map(([key, val]) => (
                  <span key={key} className="chip chip-hard">
                    <span className="text-sky-500">#{key}</span>
                    <span className="text-sky-200">{String(val)}</span>
                  </span>
                ))}
              </div>
            </Section>

            {/* Negative Filters */}
            <Section icon="🚫" title="Negative Filters" empty={negativeFilters.length === 0} emptyMsg="None excluded">
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
            <Section icon="✨" title="Soft Preferences" empty={softPreferences.length === 0} emptyMsg="No preferences yet">
              <div className="flex flex-wrap gap-1.5">
                {softPreferences.map((p, i) => (
                  <span key={i} className="chip chip-soft">
                    {p}
                  </span>
                ))}
              </div>
            </Section>

            {/* Raw JSON */}
            <Section icon="📋" title="Raw Slots">
              <pre className="text-xs font-mono text-gray-400 bg-gray-950 rounded-lg p-3 overflow-x-auto leading-relaxed border border-gray-800">
                {JSON.stringify(sessionState, null, 2)}
              </pre>
            </Section>
          </>
        )}
      </div>
    </>
  )
}

/** Small collapsible section within the inspector */
function Section({ icon, title, children, empty = false, emptyMsg = 'Empty' }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
      </div>
      {empty ? (
        <p className="text-xs text-gray-600 italic pl-1">{emptyMsg}</p>
      ) : (
        children
      )}
    </div>
  )
}
