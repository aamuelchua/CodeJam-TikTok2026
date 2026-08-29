import { useState } from 'react'
import {
  User,
  Mail,
  Tag,
  Sparkles,
  Sliders,
  Save,
  CheckCircle2,
  Trash2,
  Cpu,
} from 'lucide-react'

const ALL_TAGS = [
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

export default function ProfileTab({ userProfile, onUpdateProfile, onResetProfile }) {
  const [name, setName] = useState(userProfile?.name || 'Shopper')
  const [email, setEmail] = useState(userProfile?.email || 'shopper@example.com')
  const [selectedTags, setSelectedTags] = useState(userProfile?.interests || ["Women's Shoes", "House Slippers", "Electronics"])
  const [savedSuccess, setSavedSuccess] = useState(false)

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSave = (e) => {
    e.preventDefault()
    const updated = {
      ...userProfile,
      name: name.trim() || 'Shopper',
      email: email.trim() || 'shopper@example.com',
      interests: selectedTags,
      updatedAt: new Date().toISOString(),
    }
    onUpdateProfile(updated)
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 2500)
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 fade-in-up flex flex-col items-center">
      <div className="w-full max-w-2xl flex flex-col gap-6">
        
        {/* Profile Card Header */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-600 to-indigo-700 text-white shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner flex-shrink-0">
              <User className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold">{userProfile?.name || 'Shopper'}</h2>
              <p className="text-xs text-white/80 mt-0.5">{userProfile?.email || 'shopper@example.com'}</p>
              <div className="inline-flex items-center gap-1 text-[11px] bg-white/10 px-2.5 py-0.5 rounded-full mt-2 text-white/90 border border-white/20 font-mono">
                <Cpu className="w-3 h-3 text-emerald-300" />
                Dense Vector Embedding Synchronized
              </div>
            </div>
          </div>

          <button
            onClick={onResetProfile}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20 transition-all flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset Onboarding
          </button>
        </div>

        {/* Profile Settings Form */}
        <form onSubmit={handleSave} className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-brand-500" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Account Details</h3>
            </div>

            {savedSuccess && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          {/* Name & Email inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-500" />
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Interest Tags */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-brand-500" />
                Personalized Interest Vector Tags
              </span>
              <span className="text-xs text-slate-500">{selectedTags.length} active</span>
            </label>

            <div className="flex flex-wrap gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto">
              {ALL_TAGS.map((tag) => {
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
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          {/* RAG Vector Embedding Explanation */}
          <div className="p-4 rounded-2xl bg-brand-50/60 dark:bg-brand-950/40 border border-brand-200/60 dark:border-brand-800/40 text-xs text-brand-900 dark:text-brand-300 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-bold">Dynamic RAG Embedding System:</strong> These interest tags are encoded into dense vectors (`all-MiniLM-L6-v2`) and combined with real-time user query vectors in the Copilot search backend to produce personalized product recommendations.
            </div>
          </div>

          <button type="submit" className="btn-primary py-3 text-sm font-bold shadow-md">
            <Save className="w-4 h-4" /> Save Profile Preferences
          </button>
        </form>
      </div>
    </div>
  )
}
