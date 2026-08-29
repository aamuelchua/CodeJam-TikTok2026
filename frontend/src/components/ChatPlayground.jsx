import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import {
  Bot,
  User,
  Sparkles,
  Send,
  RefreshCw,
  AlertCircle,
  ShoppingBag,
  Check,
  Star,
  Sliders,
  HelpCircle,
  Store,
} from 'lucide-react'

const API = '/api'

/** Typing indicator shown while waiting for agent response */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5 fade-in-up">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm">
        <Bot className="w-4 h-4" />
      </div>
      <div className="bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700/80 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400 block" />
      </div>
    </div>
  )
}

/** Recommended Product Card inside Chat Bubble */
function RecommendedChatCard({ product, onAddToCart, isInCart }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3.5 flex flex-col gap-2 shadow-sm hover:border-brand-500/50 transition-all">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2 py-0.5 rounded-md border border-brand-200/40 dark:border-brand-800/40 truncate">
          {product.store || 'Catalog'}
        </span>
        <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
          <Star className="w-3 h-3 fill-current" />
          <span>{product.average_rating || 4.5}</span>
        </div>
      </div>

      <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
        {product.title}
      </h4>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
          ${product.price ? product.price.toFixed(2) : '19.99'}
        </span>

        <button
          onClick={() => onAddToCart(product)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
            isInCart
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'bg-brand-600 text-white hover:bg-brand-500'
          }`}
        >
          {isInCart ? (
            <>
              <Check className="w-3 h-3 stroke-[3]" /> Added
            </>
          ) : (
            <>
              <ShoppingBag className="w-3 h-3" /> Add
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/** Single chat bubble */
function MessageBubble({ message, onAddToCart, cartItems }) {
  const isUser = message.sender === 'USER'
  const isSystem = message.sender === 'SYSTEM'

  if (isSystem) {
    return (
      <div className="flex justify-center fade-in-up my-1">
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-slate-800/60 border border-slate-300/50 dark:border-slate-700/50 px-3 py-1 rounded-full flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-brand-500" />
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-2.5 fade-in-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
            : 'bg-gradient-to-br from-brand-500 to-indigo-600'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Content Body */}
      <div className={`max-w-[85%] flex flex-col gap-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-brand-600 text-white rounded-tr-sm shadow-md'
              : 'bg-slate-200/90 dark:bg-slate-800/90 border border-slate-300/80 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-tl-sm shadow-sm'
          }`}
        >
          {message.content}

          {/* Clarification prompt banner */}
          {message.shouldClarify && (
            <div className="mt-2.5 pt-2 border-t border-amber-500/30 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-xl">
              <HelpCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>Entropy Clarification: Please help narrow down your request to refine recommendations.</span>
            </div>
          )}

          {/* Metadata chips */}
          {message.meta && (
            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              {message.meta.candidateCount !== undefined && (
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sliders className="w-3 h-3" />
                  {message.meta.candidateCount} vector candidates
                </span>
              )}
              {message.meta.entropyScore !== undefined && message.meta.entropyScore !== null && (
                <span className="badge badge-entropy text-[10px]">
                  H = {message.meta.entropyScore.toFixed(3)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Inline Recommended Product Cards */}
        {message.products && message.products.length > 0 && (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
            {message.products.slice(0, 4).map((p) => {
              const isInCart = cartItems.some((i) => i.asin === p.asin)
              return (
                <RecommendedChatCard
                  key={p.asin}
                  product={p}
                  onAddToCart={onAddToCart}
                  isInCart={isInCart}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPlayground({
  sessionId,
  onSessionCreated,
  onTurnResult,
  userProfile,
  onAddToCart,
  cartItems,
}) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), ...msg }])
  }, [])

  /** Start session */
  const startSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.post(`${API}/sessions`)
      onSessionCreated(data.sessionId)
      setMessages([])
      appendMessage({
        sender: 'SYSTEM',
        content: `Copilot Session initialized · ID: ${data.sessionId.slice(0, 8)}…`,
      })

      const greeting = userProfile?.interests?.length
        ? `Hi ${userProfile.name || 'there'}! I noticed your interests include ${userProfile.interests.slice(0, 3).join(', ')}. What are you looking for today?`
        : "Hi! I'm your AI Shopping Copilot. Tell me what you're looking for and I'll find personalized product recommendations for you!"

      appendMessage({
        sender: 'AGENT',
        content: greeting,
      })
    } catch (err) {
      setError('Failed to initialize session. Make sure backend is running.')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [onSessionCreated, appendMessage, userProfile])

  /** Send user message turn */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionId || loading) return
    const userText = input.trim()
    setInput('')
    setError(null)

    appendMessage({ sender: 'USER', content: userText })
    setLoading(true)

    try {
      const payload = {
        message: userText,
        user_profile: userProfile || {},
      }

      const { data } = await axios.post(`${API}/sessions/${sessionId}/turn`, payload)

      appendMessage({
        sender: 'AGENT',
        content: data.agentMessage,
        shouldClarify: data.shouldClarify,
        products: data.products || [],
        meta: {
          candidateCount: data.candidateCount,
          entropyScore: data.entropyScore,
        },
      })

      onTurnResult(data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setError(msg)
      appendMessage({ sender: 'AGENT', content: `Error: ${msg}` })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, sessionId, loading, appendMessage, onTurnResult, userProfile])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800">
      
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="panel-title">AI Conversational Search Copilot</span>
        </div>

        {sessionId && (
          <button
            onClick={startSession}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors px-2.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> New Session
          </button>
        )}
      </div>

      {/* Messages list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <Bot className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Start an AI Shopping Session</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                Our RAG copilot searches the product vector index while taking your profile interest tags into account.
              </p>
            </div>
            <button onClick={startSession} disabled={loading} className="btn-primary mt-2">
              {loading ? 'Starting…' : 'Start Copilot Chat'}
            </button>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onAddToCart={onAddToCart}
              cartItems={cartItems}
            />
          ))
        )}

        {loading && messages.length > 0 && <TypingIndicator />}
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="mx-4 mb-2 px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Input bar */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 flex gap-2 bg-slate-50/50 dark:bg-slate-950/30">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionId ? "Ask for recommendations (e.g. 'comfortable slippers under $30')…" : "Start a session first"}
          disabled={!sessionId || loading}
          className="input-field flex-1"
        />
        <button
          onClick={sendMessage}
          disabled={!sessionId || loading || !input.trim()}
          className="btn-primary px-4 flex-shrink-0"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  )
}
