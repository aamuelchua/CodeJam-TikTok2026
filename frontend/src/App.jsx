import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx'
import BottomNav from './components/BottomNav.jsx'
import ShopTab from './components/ShopTab.jsx'
import ChatPlayground from './components/ChatPlayground.jsx'
import ProfileTab from './components/ProfileTab.jsx'
import StateInspector from './components/StateInspector.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import OnboardingModal from './components/OnboardingModal.jsx'
import FloatingCopilotWidget from './components/FloatingCopilotWidget.jsx'
import PinnedCopilotSidebar from './components/PinnedCopilotSidebar.jsx'
import {
  ShoppingBag,
  Sun,
  Moon,
  User,
  Sparkles,
  Pin,
  PinOff,
} from 'lucide-react'

const API = '/api'

const DESKTOP_CATEGORIES = [
  'All',
  'Women',
  'Men',
  'Shoes',
  'Jewelry',
  'Luggage & Travel',
  'Sportswear',
]

function MainContent() {
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState('shop')
  const [selectedCategory, setSelectedCategory] = useState('All')

  // Floating Chatbot Open/Close state
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  // Pinned Companion State (Side-by-Side Flex Layout)
  const [isCopilotPinned, setIsCopilotPinned] = useState(() => {
    return localStorage.getItem('shopping_copilot_pinned') === 'true'
  })

  // Cart State with LocalStorage Caching
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('shopping_copilot_cart')
      return saved ? JSON.parse(saved) : []
    } catch (e) {
      return []
    }
  })

  // User Profile State with LocalStorage Caching
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem('shopping_copilot_profile')
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  // Onboarding Modal Visibility
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(!userProfile?.onboarded)

  // Cart Drawer Visibility
  const [isCartOpen, setIsCartOpen] = useState(false)

  // Product Catalog State with Caching
  const [products, setProducts] = useState([])

  // Session & Copilot Chat State
  const [sessionId, setSessionId] = useState(null)
  const [sessionState, setSessionState] = useState(null)

  // Persist pinned state
  useEffect(() => {
    localStorage.setItem('shopping_copilot_pinned', String(isCopilotPinned))
  }, [isCopilotPinned])

  // Persist cart to LocalStorage
  useEffect(() => {
    localStorage.setItem('shopping_copilot_cart', JSON.stringify(cartItems))
  }, [cartItems])

  // Fetch product catalog on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data } = await axios.get(`${API}/products`)
        if (data.products && data.products.length > 0) {
          setProducts(data.products)
          localStorage.setItem('shopping_copilot_products', JSON.stringify(data.products))
        }
      } catch (err) {
        const cached = localStorage.getItem('shopping_copilot_products')
        if (cached) {
          try { setProducts(JSON.parse(cached)) } catch (e) {}
        }
      }
    }
    fetchCatalog()
  }, [])

  // Cart Operations
  const handleAddToCart = useCallback((product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.asin === product.asin)
      if (existing) {
        return prev.map((item) =>
          item.asin === product.asin ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }, [])

  const handleUpdateQuantity = useCallback((asin, newQuantity) => {
    if (newQuantity <= 0) {
      setCartItems((prev) => prev.filter((item) => item.asin !== asin))
    } else {
      setCartItems((prev) =>
        prev.map((item) => (item.asin === asin ? { ...item, quantity: newQuantity } : item))
      )
    }
  }, [])

  const handleRemoveItem = useCallback((asin) => {
    setCartItems((prev) => prev.filter((item) => item.asin !== asin))
  }, [])

  const handleClearCart = useCallback(() => {
    setCartItems([])
  }, [])

  // Profile Operations
  const handleCompleteOnboarding = useCallback((profile) => {
    setUserProfile(profile)
    setIsOnboardingOpen(false)
  }, [])

  const handleUpdateProfile = useCallback((profile) => {
    setUserProfile(profile)
    localStorage.setItem('shopping_copilot_profile', JSON.stringify(profile))
  }, [])

  const handleResetProfile = useCallback(() => {
    localStorage.removeItem('shopping_copilot_profile')
    setUserProfile(null)
    setIsOnboardingOpen(true)
  }, [])

  // Desktop Header Category Click
  const handleDesktopCategoryClick = (category) => {
    setSelectedCategory(category)
    setActiveTab('shop')
  }

  // Pin / Unpin handlers
  const handlePinCopilot = () => {
    setIsCopilotPinned(true)
    setIsCopilotOpen(false)
  }

  const handleUnpinCopilot = () => {
    setIsCopilotPinned(false)
    setIsCopilotOpen(true)
  }

  // Turn Results from Copilot Chat
  const handleSessionCreated = useCallback((id) => {
    setSessionId(id)
    setSessionState(null)
  }, [])

  const handleTurnResult = useCallback((result) => {
    if (result.state) setSessionState(result.state)
    if (result.products && result.products.length > 0) {
      setProducts((prev) => {
        const existingAsins = new Set(prev.map((p) => p.asin))
        const newProducts = result.products.filter((p) => !existingAsins.has(p.asin))
        return [...newProducts, ...prev]
      })
    }
  }, [])

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden font-sans">
      
      {/* ── Top Header ── */}
      <header className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between z-30">
        
        {/* Brand Logo & Desktop Category Segment Pages */}
        <div className="flex items-center gap-6">
          <div
            className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
            onClick={() => {
              setActiveTab('shop')
              setSelectedCategory('All')
            }}
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold gradient-text leading-none tracking-tight">
                Shopping Copilot
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Vector RAG Catalog
              </p>
            </div>
          </div>

          {/* Desktop Category Segment Navigation */}
          <nav className="hidden lg:flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-6">
            {DESKTOP_CATEGORIES.map((cat) => {
              const isActive = activeTab === 'shop' && selectedCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => handleDesktopCategoryClick(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Pin Companion Toggle Shortcut */}
          <button
            onClick={() => (isCopilotPinned ? handleUnpinCopilot() : handlePinCopilot())}
            className={`p-2.5 rounded-2xl border transition-colors hidden md:flex items-center gap-1.5 text-xs font-bold ${
              isCopilotPinned
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={isCopilotPinned ? "Unpin Companion Sidebar" : "Pin Chatbot as Companion Sidebar"}
          >
            {isCopilotPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4 text-amber-500" />}
            <span>{isCopilotPinned ? 'Unpin AI' : 'Pin AI'}</span>
          </button>

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Cart Button with Count Badge */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative p-2.5 rounded-2xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/60 transition-colors flex items-center gap-1.5"
            title="Shopping Cart"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">Cart</span>
            {totalCartCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow-sm">
                {totalCartCount}
              </span>
            )}
          </button>

          {/* Profile Shortcut Button */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`p-2.5 rounded-2xl border transition-colors flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title="User Profile"
          >
            <User className="w-4 h-4" />
            <span className="text-xs font-bold hidden sm:inline">
              {userProfile?.name ? userProfile.name.split(' ')[0] : 'Profile'}
            </span>
          </button>
        </div>
      </header>

      {/* ── Main View Content (Flex-row layout when companion is pinned) ── */}
      <main className="flex-1 flex flex-row overflow-hidden p-3 sm:p-4 gap-4 min-h-0 bg-slate-100/50 dark:bg-slate-950/50">
        
        {/* Left Pane: Main View Content */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Tab 1: Shop Showcase */}
          {activeTab === 'shop' && (
            <ShopTab
              products={products}
              onAddToCart={handleAddToCart}
              cartItems={cartItems}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          )}

          {/* Tab 2: Full Copilot Chat View */}
          {activeTab === 'copilot' && (
            <div className="flex-1 flex gap-4 h-full min-w-0">
              <div className="flex-1 min-w-0">
                <ChatPlayground
                  sessionId={sessionId}
                  onSessionCreated={handleSessionCreated}
                  onTurnResult={handleTurnResult}
                  userProfile={userProfile}
                  onAddToCart={handleAddToCart}
                  cartItems={cartItems}
                />
              </div>
              
              <div className="hidden lg:flex w-80 min-w-[300px]">
                <StateInspector sessionId={sessionId} sessionState={sessionState} />
              </div>
            </div>
          )}

          {/* Tab 3: User Profile */}
          {activeTab === 'profile' && (
            <ProfileTab
              userProfile={userProfile}
              onUpdateProfile={handleUpdateProfile}
              onResetProfile={handleResetProfile}
            />
          )}
        </div>

        {/* Right Pane: Pinned Companion AI Chatbot Sidebar */}
        {isCopilotPinned && (
          <div className="hidden md:flex flex-shrink-0 h-full">
            <PinnedCopilotSidebar
              sessionId={sessionId}
              onSessionCreated={handleSessionCreated}
              onTurnResult={handleTurnResult}
              userProfile={userProfile}
              onAddToCart={handleAddToCart}
              cartItems={cartItems}
              onUnpin={handleUnpinCopilot}
              onClose={() => setIsCopilotPinned(false)}
            />
          </div>
        )}
      </main>

      {/* ── Desktop Bottom-Right Floating AI Copilot Widget (when NOT pinned) ── */}
      {!isCopilotPinned && (
        <FloatingCopilotWidget
          sessionId={sessionId}
          onSessionCreated={handleSessionCreated}
          onTurnResult={handleTurnResult}
          userProfile={userProfile}
          onAddToCart={handleAddToCart}
          cartItems={cartItems}
          isOpen={isCopilotOpen}
          onToggleOpen={() => setIsCopilotOpen((prev) => !prev)}
          onPin={handlePinCopilot}
        />
      )}

      {/* ── Mobile Bottom Navigation Bar (Hidden on Desktop md:) ── */}
      <div className="block md:hidden">
        <BottomNav activeTab={activeTab} onChangeTab={setActiveTab} />
      </div>

      {/* ── Modals & Drawers ── */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onComplete={handleCompleteOnboarding}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
      />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <MainContent />
    </ThemeProvider>
  )
}
