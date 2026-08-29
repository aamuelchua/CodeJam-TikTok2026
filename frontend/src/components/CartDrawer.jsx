import { useState } from 'react'
import {
  ShoppingBag,
  X,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}) {
  const [isCheckingOut, setIsCheckingOut] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  if (!isOpen) return null

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0)
  const shipping = subtotal > 50 || subtotal === 0 ? 0 : 4.99
  const tax = subtotal * 0.08
  const grandTotal = subtotal + shipping + tax

  const handleSimulatePayment = () => {
    setIsCheckingOut(true)
    setTimeout(() => {
      setIsCheckingOut(false)
      setPaymentSuccess(true)
      setTimeout(() => {
        setPaymentSuccess(false)
        onClearCart()
        onClose()
      }, 2000)
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm fade-in-up">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Shopping Cart</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {cartItems.reduce((a, b) => a + b.quantity, 0)} items selected
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Success View */}
        {paymentSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4 fade-in-up">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Successful!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Your order has been placed successfully. Simulation complete!
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                    <ShoppingBag className="w-8 h-8 opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your cart is empty</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                      Browse shop items or ask our Copilot for recommendations.
                    </p>
                  </div>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item.asin}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex gap-3 items-center"
                  >
                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-brand-600 dark:text-brand-400 uppercase font-semibold">
                        {item.store || 'Item'}
                      </p>
                      <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate mt-0.5">
                        {item.title}
                      </h4>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                        ${((item.price || 0) * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.asin, item.quantity - 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-slate-800 dark:text-slate-200">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.asin, item.quantity + 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => onRemoveItem(item.asin)}
                      className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer Summary & Payment Button */}
            {cartItems.length > 0 && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col gap-3">
                <div className="flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Shipping</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Tax (8%)</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">${tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span>Grand Total</span>
                    <span className="text-emerald-600 dark:text-emerald-400">${grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleSimulatePayment}
                  disabled={isCheckingOut}
                  className="btn-primary w-full py-3 text-sm mt-1 shadow-lg"
                >
                  {isCheckingOut ? (
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 animate-spin" /> Processing Payment…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Pay ${grandTotal.toFixed(2)} Now <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  Simulated 256-bit Secure SSL Checkout
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
