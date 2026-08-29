import { useState } from 'react'
import ChatPlayground from './ChatPlayground.jsx'
import { Sparkles, X, Minus, MessageSquare, ChevronDown, Pin } from 'lucide-react'

export default function FloatingCopilotWidget({
  sessionId,
  onSessionCreated,
  onTurnResult,
  userProfile,
  onAddToCart,
  cartItems,
  isOpen,
  onToggleOpen,
  onPin,
}) {
  return (
    <>
      {/* Floating Widget Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[620px] max-h-[calc(100vh-7rem)] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden fade-in-up transition-all">
          
          {/* Custom Header Bar with Pin button */}
          <div className="px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-700 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-sm">
                <Sparkles className="w-4.5 h-4.5 animate-pulse text-amber-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-tight">Shopping Copilot AI</h3>
                <p className="text-[10px] text-white/80 font-medium">Vector RAG Conversational Search</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onPin}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 transition-colors flex items-center gap-1 text-xs"
                title="Pin Chatbot beside the Web App (Side-by-Side Companion)"
              >
                <Pin className="w-4 h-4 text-amber-300" />
              </button>

              <button
                onClick={onToggleOpen}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
                title="Minimize Chatbot"
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                onClick={onToggleOpen}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/90 transition-colors"
                title="Close Chatbot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Embedded Chat Playground */}
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
      )}

      {/* Bottom-Right Floating Toggle Button */}
      <button
        onClick={onToggleOpen}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-xl hover:shadow-brand-500/25 hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
        title="Open AI Shopping Copilot"
      >
        <div className="relative flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          {sessionId && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-indigo-600" />
          )}
        </div>

        <span className="text-xs font-bold tracking-tight hidden sm:inline">
          {isOpen ? 'Minimize Copilot' : 'AI Copilot Assistant'}
        </span>

        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-white/80" />
        ) : (
          <MessageSquare className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
        )}
      </button>
    </>
  )
}
