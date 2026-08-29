/**
 * ProductGrid
 *
 * Renders the top-10 recommended products returned from the backend.
 *
 * Props:
 *   products  array of product objects
 */

/** Format price as currency string */
function formatPrice(price) {
  if (price == null) return null
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)
}

/** Single product card */
function ProductCard({ product, rank }) {
  const price = formatPrice(product.price)

  return (
    <div className="product-card fade-in-up group">
      {/* Rank badge + ASIN */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            rank === 1 ? 'bg-amber-500 text-amber-950'
            : rank === 2 ? 'bg-gray-400 text-gray-950'
            : rank === 3 ? 'bg-amber-700 text-amber-100'
            : 'bg-gray-700 text-gray-300'
          }`}>
            {rank}
          </span>
          <span className="text-xs font-mono text-gray-500 truncate">{product.asin}</span>
        </div>
        {price && (
          <span className="text-sm font-bold text-emerald-400 flex-shrink-0">{price}</span>
        )}
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-gray-100 line-clamp-2 group-hover:text-white transition-colors">
        {product.title}
      </p>

      {/* Category */}
      <span className="self-start text-xs px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400 border border-gray-700">
        {product.category}
      </span>

      {/* Description snippet */}
      {product.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
      )}

      {/* Features snippet */}
      {product.features && !product.description && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
          {product.features}
        </p>
      )}
    </div>
  )
}

export default function ProductGrid({ products }) {
  const hasProducts = products && products.length > 0

  return (
    <>
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🛍️</span>
          <span className="panel-title">Recommendations</span>
        </div>
        {hasProducts && (
          <span className="text-xs text-gray-500 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">
            Top {products.length}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0">
        {!hasProducts ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-3xl opacity-40">
              📦
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium">No recommendations yet</p>
              <p className="text-gray-700 text-xs mt-1 max-w-[200px]">
                Start a conversation to get product recommendations.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {products.map((product, i) => (
              <ProductCard key={product.asin} product={product} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
