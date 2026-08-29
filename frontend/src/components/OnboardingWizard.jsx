import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Sparkles,
  Check,
  Tag,
  User,
  Mail,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sliders,
  LogIn,
  UserPlus,
  Layers,
  Cpu,
} from 'lucide-react'

const API = '/api'

const PRIMARY_CATEGORIES = [
  { id: "Women's Fashion", label: "Women's Fashion", icon: "👗", desc: "Shoes, Slippers, Jewelry, Totes" },
  { id: "Men's Apparel & Shoes", label: "Men's Apparel & Shoes", icon: "👟", desc: "Athletic Sneakers, Boots, Accessories" },
  { id: "Electronics & Audio", label: "Electronics & Audio", icon: "🎧", desc: "True Wireless Earbuds, Smartwatches" },
  { id: "Home & Furniture", label: "Home & Furniture", icon: "🛋️", desc: "Ergonomic Chairs, Espresso Machines" },
  { id: "Sports & Outdoor", label: "Sports & Outdoor", icon: "🧘", desc: "Yoga Mats, Fitness Gear, Luggage" },
]

const DEFAULT_SUB_CHIPS = {
  "Women's Fashion": [
    "Women's Shoes", "House Slippers", "Fuzzy Slippers", "Memory Foam Insoles",
    "Statement Earrings", "Handbags & Totes", "Dresses & Outerwear", "Sneakers"
  ],
  "Men's Apparel & Shoes": [
    "Athletic Running Shoes", "Cushioned EVA Midsole", "Non-Slip Sneakers",
    "Work Boots", "Watches & Accessories", "Casual Wear"
  ],
  "Electronics & Audio": [
    "True Wireless Earbuds", "Active Noise Cancellation", "Bluetooth 5.3",
    "Fitness Smartwatches", "Heart Rate Monitors", "Touchscreen HD"
  ],
  "Home & Furniture": [
    "Ergonomic Mesh Chairs", "Desk Chairs", "Adjustable Lumbar Support",
    "Thermal Espresso Machines", "Coffee Makers", "Home Barista Station"
  ],
  "Sports & Outdoor": [
    "Thick Yoga Mats", "Non-Slip TPE Foam", "Alignment Lines",
    "Fitness & Pilates Gear", "Travel Backpacks", "Travel Accessories"
  ]
}

export default function OnboardingWizard({ isOpen, onComplete }) {
  const [step, setStep] = useState(1)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [selectedPrimary, setSelectedPrimary] = useState(["Women's Fashion", "Electronics & Audio"])
  const [selectedSubChips, setSelectedSubChips] = useState(["Women's Shoes", "House Slippers", "True Wireless Earbuds"])
  const [chipCategories, setChipCategories] = useState(DEFAULT_SUB_CHIPS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch dynamic interest chips from backend
  useEffect(() => {
    const fetchChips = async () => {
      try {
        const { data } = await axios.get(`${API}/interest-chips`)
        if (data.categories) {
          setChipCategories((prev) => ({ ...prev, ...data.categories }))
        }
      } catch (e) {}
    }
    fetchChips()
  }, [])

  if (!isOpen) return null

  // Passwordless Email Authentication handler
  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    try {
      const { data } = await axios.post(`${API}/users/auth`, {
        email: email.trim(),
        name: isLoginMode ? null : name.trim(),
        selected_interests: selectedSubChips,
      })

      // If existing user logging in, complete immediately
      if (isLoginMode && data.selectedInterests) {
        localStorage.setItem('shopping_copilot_profile', JSON.stringify({
          ...data,
          interests: data.selectedInterests,
          onboarded: true,
        }))
        onComplete({ ...data, interests: data.selectedInterests })
        return
      }

      // If new account or registering, proceed to step 2
      setStep(2)
    } catch (err) {
      setError('Authentication failed. Please check your email.')
    } finally {
      setLoading(false)
    }
  }

  const togglePrimary = (catId) => {
    setSelectedPrimary((prev) => {
      const next = prev.includes(catId) ? prev.filter((c) => c !== catId) : [...prev, catId]
      return next
    })
  }

  const toggleSubChip = (chip) => {
    setSelectedSubChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    )
  }

  // Get available sub-chips based on selected primary categories
  const availableSubChips = selectedPrimary.flatMap((cat) => chipCategories[cat] || [])

  const handleFinalSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data } = await axios.post(`${API}/users/auth`, {
        email: email.trim(),
        name: name.trim() || 'Shopper',
        selected_interests: selectedSubChips,
      })

      const profile = {
        ...data,
        interests: selectedSubChips,
        onboarded: true,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem('shopping_copilot_profile', JSON.stringify(profile))
      onComplete(profile)
    } catch (err) {
      setError('Failed to save profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md fade-in-up">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col gap-6">
        
        {/* Header Progress Bar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Shopping Copilot Onboarding
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Step {step} of 4 · {step === 1 ? 'Authentication' : step === 2 ? 'Categories' : step === 3 ? 'Sub-Interest Chips' : 'Confirmation'}
                </p>
              </div>
            </div>

            {step > 1 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          {/* Stepper Indicator */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* ── STEP 1: Passwordless Email Login / Register ── */}
        {step === 1 && (
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-5 fade-in-up">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setIsLoginMode(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  isLoginMode
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LogIn className="w-4 h-4" /> Sign In to Existing Account
              </button>
              <button
                type="button"
                onClick={() => setIsLoginMode(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  !isLoginMode
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-4 h-4" /> Create New Account
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-brand-500" />
                Email Address (No password required)
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

            {!isLoginMode && (
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
                  placeholder="Alex Johnson"
                  className="input-field"
                />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary py-3 text-sm font-bold shadow-md mt-2">
              {loading ? 'Authenticating…' : isLoginMode ? 'Sign In Now' : 'Continue to Interest Selection'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* ── STEP 2: Primary Categories Selection ── */}
        {step === 2 && (
          <div className="flex flex-col gap-4 fade-in-up">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Choose Primary Product Categories</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select main departments you are interested in exploring.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
              {PRIMARY_CATEGORIES.map((cat) => {
                const isSelected = selectedPrimary.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => togglePrimary(cat.id)}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'bg-brand-50 dark:bg-brand-950/60 border-brand-500 ring-2 ring-brand-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{cat.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-brand-600 dark:text-brand-400 stroke-[3]" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">{cat.desc}</p>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setStep(3)}
              disabled={selectedPrimary.length === 0}
              className="btn-primary py-3 text-sm font-bold shadow-md mt-2"
            >
              Next: Generate Related Chips ({selectedPrimary.length} selected)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 3: Dynamic Sub-Interest Chips Selection ── */}
        {step === 3 && (
          <div className="flex flex-col gap-4 fade-in-up">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Dynamic Sub-Interest Chips</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                As you select choices, related sub-chips are dynamically generated from catalog data.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto">
              {availableSubChips.map((chip) => {
                const isSelected = selectedSubChips.includes(chip)
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => toggleSubChip(chip)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-500/30'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    {chip}
                  </button>
                )
              })}
            </div>

            <button onClick={() => setStep(4)} className="btn-primary py-3 text-sm font-bold shadow-md mt-2">
              Next: Review Profile Summary ({selectedSubChips.length} chips)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── STEP 4: Review & Confirm Profile ── */}
        {step === 4 && (
          <div className="flex flex-col gap-4 fade-in-up">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Confirm Your Shopping Profile</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Your interest vector embeddings are ready to personalize RAG recommendations.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-bold text-slate-900 dark:text-white">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Name:</span>
                <span className="font-bold text-slate-900 dark:text-white">{name || 'Shopper'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Interest Chips:</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">{selectedSubChips.length} active</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-xs text-brand-900 dark:text-brand-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>SentenceTransformer embeddings (`all-MiniLM-L6-v2`) initialized for RAG search.</span>
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={loading}
              className="btn-primary py-3 text-sm font-bold shadow-md mt-2"
            >
              {loading ? 'Completing Setup…' : 'Enter Shopping Platform'}
              <Check className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
