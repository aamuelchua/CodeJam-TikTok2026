import ChatPlayground from './ChatPlayground.jsx'
import { Sparkles, PinOff, X } from 'lucide-react'

export default function PinnedCopilotSidebar({
  sessionId,
  onSessionCreated,
  onTurnResult,
  userProfile,
  onAddToCart,
  cartItems,
  onUnpin,
  onClose,
}) {
  return (
    <div className="w-[360px] lg:w-[420px] h-full flex flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl flex-shrink-0 fade-in-up transition-all">
      
      {/* Header Bar */}
      <div className="px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-700 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-sm">
            <Sparkles className="w-4.5 h-4.5 animate-pulse text-amber-300" />
          </div>
          <div>
            <h3 className="text-xs font-bold tracking-tight flex items-center gap-1.5">
              AI Copilot Companion
              <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-md font-mono text-white/90">
                Pinned
              </span>
            </h3>
            <p className="text-[10px] text-white/80 font-medium">Side-by-Side RAG Search</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onUnpin}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
            title="Unpin Chatbot (Move back to Floating Corner Widget)"
          >
            <PinOff className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
            title="Close Companion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chat Component */}
      <div className="flex-1 min-h-0 flex flex-col bg-transparent">
        <ChatPlayground
          sessionId={sessionId}
          onSessionCreated={onSessionCreated}
          onTurnResult={onTurnResult}
          userProfile={userProfile}
          onAddToCart={onAddToCart}
          cartItems={cartItems}
        />
      </div>
    </div>
  )
}
