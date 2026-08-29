import { useState, useMemo } from 'react'
import {
  Search,
  Star,
  ShoppingBag,
  Check,
  Info,
  SlidersHorizontal,
  X,
  Sparkles,
  Store,
  Tag,
} from 'lucide-react'

export default function ShopTab({
  products,
  onAddToCart,
  cartItems,
  selectedCategory: externalCategory,
  onSelectCategory,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [internalCategory, setInternalCategory] = useState('All')
  const [sortBy, setSortBy] = useState('default')
  const [activeProduct, setActiveProduct] = useState(null)

  const selectedCategory = externalCategory !== undefined ? externalCategory : internalCategory
  const handleCategoryChange = (cat) => {
    if (onSelectCategory) {
      onSelectCategory(cat)
    } else {
      setInternalCategory(cat)
    }
  }

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set(['All'])
    products.forEach((p) => {
      if (p.category) {
        // Handle string or list
        if (Array.isArray(p.category)) {
          p.category.forEach((c) => set.add(c))
        } else {
          set.add(p.category.split('>')[0].trim())
        }
      }
    })
    return Array.from(set)
  }, [products])

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        const matchesCategory =
          selectedCategory === 'All' ||
          (Array.isArray(p.category)
            ? p.category.includes(selectedCategory)
            : p.category.toLowerCase().includes(selectedCategory.toLowerCase()))

        const q = searchQuery.toLowerCase().trim()
        const matchesQuery =
          !q ||
          p.title.toLowerCase().includes(q) ||
          (p.store && p.store.toLowerCase().includes(q)) ||
          (p.features && JSON.stringify(p.features).toLowerCase().includes(q))

        return matchesCategory && matchesQuery
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return (a.price || 0) - (b.price || 0)
        if (sortBy === 'price-desc') return (b.price || 0) - (a.price || 0)
        if (sortBy === 'rating') return (b.average_rating || 0) - (a.average_rating || 0)
        return 0
      })
  }, [products, searchQuery, selectedCategory, sortBy])

  // Check if item is already in cart
  const getItemQuantity = (asin) => {
    const item = cartItems.find((i) => i.asin === asin)
    return item ? item.quantity : 0
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden fade-in-up">
      {/* Search & Filter Topbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">

        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search catalog products, stores, or features…"
            className="input-field pl-10 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-500/20"
          >
            <option value="default">Sort by: Default</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>
      </div>

      {/* Categories Horizontal Scrollbar */}
      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/30 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === cat
              ? 'bg-brand-600 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {filteredProducts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 py-16">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 opacity-40" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800 dark:text-slate-200">No products found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Try searching for another keyword or change your category filter.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {filteredProducts.map((product) => {
              const qtyInCart = getItemQuantity(product.asin)

              return (
                <div key={product.asin} className="product-card justify-between">
                  <div>
                    {/* Store & Rating */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/60 px-2.5 py-0.5 rounded-lg border border-brand-200/50 dark:border-brand-800/40">
                        <Store className="w-3 h-3" />
                        {product.store || 'Catalog Store'}
                      </span>

                      <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{product.average_rating || 4.5}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({product.rating_number || 120})
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                      {product.title}
                    </h3>

                    {/* Features bullet preview */}
                    {product.features && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-2 leading-relaxed">
                        {Array.isArray(product.features) ? product.features[0] : product.features}
                      </p>
                    )}
                  </div>

                  {/* Price & Action Buttons */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-2">
                    <div>
                      <span className="text-xs text-slate-400 block font-mono text-[10px]">Price</span>
                      <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                        ${product.price ? parseFloat(product?.price || 0)?.toFixed(2) : '19.99'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveProduct(product)}
                        className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="View Details"
                      >
                        <Info className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onAddToCart(product)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${qtyInCart > 0
                          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                          : 'bg-brand-600 text-white hover:bg-brand-500'
                          }`}
                      >
                        {qtyInCart > 0 ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            In Cart ({qtyInCart})
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Add to Cart
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {activeProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm fade-in-up">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-4">

            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">
                  {activeProduct.store || 'Store'} · ASIN: {activeProduct.asin}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {activeProduct.title}
                </h2>
              </div>
              <button
                onClick={() => setActiveProduct(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rating & Price */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1.5 text-amber-500 font-bold text-sm">
                <Star className="w-4 h-4 fill-current" />
                <span>{activeProduct.average_rating || 4.5}</span>
                <span className="text-xs text-slate-500 font-normal">
                  ({activeProduct.rating_number || 120} reviews)
                </span>
              </div>
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                ${activeProduct.price ? activeProduct.price.toFixed(2) : '19.99'}
              </span>
            </div>

            {/* Features */}
            {activeProduct.features && (
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" /> Key Product Features
                </h4>
                <ul className="text-xs text-slate-700 dark:text-slate-300 flex flex-col gap-1.5 list-disc pl-4 max-h-40 overflow-y-auto">
                  {Array.isArray(activeProduct.features) ? (
                    activeProduct.features.map((feat, i) => <li key={i}>{feat}</li>)
                  ) : (
                    <li>{activeProduct.features}</li>
                  )}
                </ul>
              </div>
            )}

            {/* Action */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setActiveProduct(null)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  onAddToCart(activeProduct)
                  setActiveProduct(null)
                }}
                className="btn-primary text-xs"
              >
                <ShoppingBag className="w-4 h-4" /> Add to Shopping Cart
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
