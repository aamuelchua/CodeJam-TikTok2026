import { useState, useCallback } from 'react'
import ChatPlayground from './components/ChatPlayground.jsx'
import StateInspector from './components/StateInspector.jsx'
import ProductGrid from './components/ProductGrid.jsx'

/**
 * App — 3-panel layout
 * ┌──────────────────────────────────────────────────────┐
 * │  Header                                              │
 * ├──────────────────┬────────────────┬──────────────────┤
 * │  Chat (40%)      │  State (25%)   │  Products (35%)  │
 * └──────────────────┴────────────────┴──────────────────┘
 */
export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [sessionState, setSessionState] = useState(null)   // latest slot snapshot
  const [products, setProducts] = useState([])

  const handleSessionCreated = useCallback((id) => {
    setSessionId(id)
    setSessionState(null)
    setProducts([])
  }, [])

  const handleTurnResult = useCallback((result) => {
    if (result.state) setSessionState(result.state)
    if (result.products) setProducts(result.products)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* ─── Header ─── */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-lg">
            🛒
          </div>
          <div>
            <h1 className="text-base font-bold gradient-text leading-none">Shopping Copilot</h1>
            <p className="text-xs text-gray-500 mt-0.5">Entropy-Driven Conversational Commerce</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {sessionId && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-mono bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="truncate max-w-[180px]">Session: {sessionId}</span>
            </div>
          )}
          <div className="text-xs text-gray-600 font-mono hidden sm:block">
            BM25 · Dense · RRF · Cross-Encoder
          </div>
        </div>
      </header>

      {/* ─── 3-Panel Body ─── */}
      <main className="flex-1 flex gap-3 p-3 overflow-hidden min-h-0">
        {/* Panel 1: Chat */}
        <div className="panel flex-[4] min-w-0">
          <ChatPlayground
            sessionId={sessionId}
            onSessionCreated={handleSessionCreated}
            onTurnResult={handleTurnResult}
          />
        </div>

        {/* Panel 2: State Inspector */}
        <div className="panel flex-[25] min-w-0" style={{ flex: '0 0 280px' }}>
          <StateInspector sessionId={sessionId} sessionState={sessionState} />
        </div>

        {/* Panel 3: Product Grid */}
        <div className="panel flex-[35] min-w-0">
          <ProductGrid products={products} />
        </div>
      </main>
    </div>
  )
}
