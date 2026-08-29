import { ShoppingBag, Sparkles, User } from 'lucide-react'

export default function BottomNav({ activeTab, onChangeTab }) {
  const tabs = [
    { id: 'shop', label: 'Shop Products', icon: ShoppingBag },
    { id: 'copilot', label: 'AI Copilot Search', icon: Sparkles },
    { id: 'profile', label: 'User Profile', icon: User },
  ]

  return (
    <nav className="flex-shrink-0 bg-white/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 backdrop-blur-md px-4 py-2 flex justify-around items-center z-40 shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onChangeTab(tab.id)}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-2xl transition-all ${
              isActive
                ? 'text-brand-600 dark:text-brand-400 font-bold bg-brand-50/80 dark:bg-brand-950/60 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] font-semibold">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
