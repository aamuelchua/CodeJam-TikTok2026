import { useState } from 'react'
import { Sparkles, Check, Tag, User, Mail, ArrowRight } from 'lucide-react'

const INTEREST_TAGS = [
  "Women's Shoes",
  "House Slippers",
  "Athletic Shoes",
  "True Wireless Earbuds",
  "Noise Cancellation",
  "Ergonomic Furniture",
  "Coffee & Espresso",
  "Fitness Smartwatches",
  "Leather Handbags",
  "Yoga & Pilates",
  "Electronics",
  "Home & Living",
  "Fashion & Accessories",
  "Wellness & Outdoor",
]

export default function OnboardingModal({ isOpen, onComplete }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedTags, setSelectedTags] = useState(["Women's Shoes", "House Slippers", "Electronics"])

  if (!isOpen) return null

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const profile = {
      name: name.trim() || 'Shopper',
      email: email.trim() || 'shopper@example.com',
      interests: selectedTags,
      onboarded: true,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('shopping_copilot_profile', JSON.stringify(profile))
    onComplete(profile)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm fade-in-up">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md flex-shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Welcome to Shopping Copilot</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize your AI recommendation feed (Reddit-style onboarding)
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* User Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-500" />
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Johnson"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-brand-500" />
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@example.com"
                className="input-field"
              />
            </div>
          </div>

          {/* Interest Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-500" />
                Select Your Interests & Shopping Tags
              </span>
              <span className="text-[11px] font-normal text-slate-500">
                {selectedTags.length} selected
              </span>
            </label>

            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
              {INTEREST_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-500/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={selectedTags.length === 0}
            className="btn-primary w-full py-3 text-base mt-2 shadow-lg"
          >
            Start Shopping Experience
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  )
}
