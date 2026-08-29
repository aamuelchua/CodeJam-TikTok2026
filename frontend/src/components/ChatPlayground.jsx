import { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'

const API = '/api'

/** Typing indicator shown while waiting for agent response */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 fade-in-up">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-violet-600 flex items-center justify-center text-sm flex-shrink-0">
        🤖
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 block" />
      </div>
    </div>
  )
}

/** Single chat bubble */
function MessageBubble({ message }) {
  const isUser = message.sender === 'USER'
  const isSystem = message.sender === 'SYSTEM'

  if (isSystem) {
    return (
      <div className="flex justify-center fade-in-up">
        <span className="text-xs text-gray-500 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    )
  }

  return (
    <div className={`flex items-end gap-2 fade-in-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
        isUser
          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
          : 'bg-gradient-to-br from-sky-500 to-violet-600'
      }`}>
        {isUser ? '👤' : '🤖'}
      </div>

      {/* Bubble */}
      <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
        isUser
          ? 'bg-brand-600 text-white rounded-br-sm'
          : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-bl-sm'
      }`}>
        {message.content}

        {/* Entropy notice */}
        {message.shouldClarify && (
          <div className="mt-2 pt-2 border-t border-amber-700/30 flex items-center gap-1.5 text-xs text-amber-300">
            <span className="entropy-pulse w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Entropy trigger — narrowing results
          </div>
        )}

        {/* Turn metadata */}
        {message.meta && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {message.meta.candidateCount !== undefined && (
              <span className="text-xs text-gray-500">
                📦 {message.meta.candidateCount} candidates
              </span>
            )}
            {message.meta.entropyScore !== undefined && message.meta.entropyScore !== null && (
              <span className="badge badge-entropy">
                H={message.meta.entropyScore.toFixed(3)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * ChatPlayground
 *
 * Props:
 *   sessionId        string | null
 *   onSessionCreated (id: string) => void
 *   onTurnResult     (result: object) => void
 */
export default function ChatPlayground({ sessionId, onSessionCreated, onTurnResult }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const appendMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: Date.now() + Math.random(), ...msg }])
  }, [])

  /** Create a new session */
  const startSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.post(`${API}/sessions`)
      onSessionCreated(data.sessionId)
      setMessages([])
      appendMessage({
        sender: 'SYSTEM',
        content: `Session started · ID: ${data.sessionId.slice(0, 8)}…`,
      })
      appendMessage({
        sender: 'AGENT',
        content: "Hi! I'm your Shopping Copilot 🛒 Tell me what you're looking for and I'll find the best products for you.",
      })
    } catch (err) {
      setError('Failed to create session. Is the backend running?')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [onSessionCreated, appendMessage])

  /** Send a user turn */
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !sessionId || loading) return
    const userText = input.trim()
    setInput('')
    setError(null)

    appendMessage({ sender: 'USER', content: userText })
    setLoading(true)

    try {
      const { data } = await axios.post(`${API}/sessions/${sessionId}/turn`, {
        message: userText,
      })

      appendMessage({
        sender: 'AGENT',
        content: data.agentMessage,
        shouldClarify: data.shouldClarify,
        meta: {
          candidateCount: data.candidateCount,
          entropyScore: data.entropyScore,
        },
      })

      onTurnResult(data)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Something went wrong. Please try again.'
      setError(msg)
      appendMessage({ sender: 'AGENT', content: `⚠️ Error: ${msg}` })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [input, sessionId, loading, appendMessage, onTurnResult])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <>
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="panel-title">Chat Playground</span>
        </div>
        {sessionId && (
          <button
            onClick={startSession}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800"
          >
            + New Session
          </button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-600/20 border border-sky-500/20 flex items-center justify-center text-3xl">
              🛍️
            </div>
            <div>
              <p className="text-gray-300 font-semibold">Start a shopping session</p>
              <p className="text-gray-600 text-sm mt-1 max-w-[220px]">
                Click "New Session" to begin a conversation with your AI shopping assistant.
              </p>
            </div>
            <button
              onClick={startSession}
              disabled={loading}
              className="btn-primary mt-2"
              id="start-session-btn"
            >
              {loading ? 'Starting…' : 'New Session'}
            </button>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}

        {loading && messages.length > 0 && <TypingIndicator />}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-rose-950/60 border border-rose-700/40 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Input bar */}
      <div className="p-3 border-t border-gray-800 flex gap-2">
        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sessionId ? "Describe what you're looking for…" : "Start a session first"}
          disabled={!sessionId || loading}
          className="input-field flex-1"
        />
        <button
          id="send-btn"
          onClick={sendMessage}
          disabled={!sessionId || loading || !input.trim()}
          className="btn-primary px-4 flex-shrink-0"
        >
          {loading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </>
  )
}
