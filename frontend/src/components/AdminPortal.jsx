import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  Users,
  ShieldCheck,
  Search,
  Trash2,
  Edit3,
  Plus,
  X,
  Tag,
  ShoppingBag,
  Receipt,
  Cpu,
  CheckCircle2,
  Sliders,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'

const API = '/api'

export default function AdminPortal({ onClose }) {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [editingInterests, setEditingInterests] = useState([])
  const [editingDerived, setEditingDerived] = useState([])
  const [newTagInput, setNewTagInput] = useState('')
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null)
  const [actionSuccess, setActionSuccess] = useState('')

  // Fetch all users from API
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const { data } = await axios.get(`${API}/users`)
      if (data.users) {
        setUsers(data.users)
      }
    } catch (err) {
      console.error('Failed to fetch users for admin portal:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // Inspect single user
  const handleInspectUser = (user) => {
    setSelectedUser(user)
    setEditingInterests(user.selectedInterests || [])
    setEditingDerived(user.derivedInterests || [])
  }

  // Update User Interests (Admin action)
  const handleSaveUserInterests = async () => {
    if (!selectedUser) return
    try {
      const { data } = await axios.put(`${API}/users/${selectedUser.email}`, {
        selected_interests: editingInterests,
        derived_interests: editingDerived,
      })
      setSelectedUser(data)
      setActionSuccess('User profile updated successfully!')
      fetchUsers()
      setTimeout(() => setActionSuccess(''), 2500)
    } catch (err) {
      alert('Failed to update user profile.')
    }
  }

  // Delete User Account permanently (Admin action)
  const handleDeleteUser = async (email) => {
    try {
      await axios.delete(`${API}/users/${email}`)
      setDeleteConfirmUser(null)
      if (selectedUser?.email === email) {
        setSelectedUser(null)
      }
      setActionSuccess(`Account ${email} deleted successfully.`)
      fetchUsers()
      setTimeout(() => setActionSuccess(''), 2500)
    } catch (err) {
      alert('Failed to delete user account.')
    }
  }

  // Filter users by search query
  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/80 backdrop-blur-md fade-in-up overflow-hidden">
      <div className="w-full h-full bg-white dark:bg-slate-900 flex flex-col sm:flex-row overflow-hidden">
        
        {/* ── Admin Side Navbar ── */}
        <aside className="w-full sm:w-64 bg-slate-100 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 p-4 flex sm:flex-col justify-between flex-shrink-0">
          <div className="flex flex-col gap-6 w-full">
            
            {/* Header Brand */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-md">
                  <ShieldCheck className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">Admin Portal</h2>
                  <p className="text-[10px] text-slate-500 font-medium">User & Vector Inspector</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="sm:hidden p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Links */}
            <nav className="flex sm:flex-col gap-1 w-full overflow-x-auto sm:overflow-visible">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'users'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" /> Users Overview ({users.length})
              </button>

              <button
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === 'orders'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <Receipt className="w-4 h-4" /> All Customer Orders
              </button>
            </nav>
          </div>

          <button
            onClick={onClose}
            className="hidden sm:flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-bold transition-all mt-auto"
          >
            <ArrowLeft className="w-4 h-4" /> Exit Admin Portal
          </button>
        </aside>

        {/* ── Main Admin Content View ── */}
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
          
          {/* Header Action Bar */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {activeTab === 'users' ? 'Registered User Accounts' : 'Order & Purchase Logs'}
              </h2>

              {actionSuccess && (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {actionSuccess}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
            
            {/* ── TAB 1: USERS OVERVIEW TABLE ── */}
            {activeTab === 'users' && (
              <div className="flex flex-col gap-4">
                
                {/* Search Bar */}
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users by name or email…"
                    className="input-field pl-10"
                  />
                </div>

                {/* Users List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm hover:border-brand-500/50 transition-all"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{user.name}</h3>
                            <p className="text-xs text-slate-500 font-mono">{user.email}</p>
                          </div>
                          <span className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-md">
                            {user.orders?.length || 0} orders
                          </span>
                        </div>

                        {/* Selected vs Derived Interest Badges */}
                        <div className="mt-3 flex flex-col gap-2">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Explicit Selected Interests:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {user.selectedInterests?.length ? (
                                user.selectedInterests.map((tag, i) => (
                                  <span key={i} className="chip chip-hard text-[10px] py-0.5 px-2">
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">None selected</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                              <Cpu className="w-3 h-3" /> AI-Derived Interests:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {user.derivedInterests?.length ? (
                                user.derivedInterests.map((tag, i) => (
                                  <span key={i} className="chip chip-soft text-[10px] py-0.5 px-2">
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">None derived yet</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                          onClick={() => handleInspectUser(user)}
                          className="btn-primary py-1.5 px-3 text-xs font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Inspect & Edit
                        </button>

                        <button
                          onClick={() => setDeleteConfirmUser(user)}
                          className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete User Account"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB 2: ORDERS LOG ── */}
            {activeTab === 'orders' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Order Transactions</h3>
                  <div className="flex flex-col gap-2">
                    {users.flatMap((u) => u.orders || []).length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 text-center">No purchases recorded yet.</p>
                    ) : (
                      users.flatMap((u) => (u.orders || []).map((ord) => ({ ...ord, userEmail: u.email }))).map((ord) => (
                        <div key={ord.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white">Order ID: {ord.id.slice(0, 8)}</span>
                            <span className="text-slate-400 block font-mono text-[10px]">User: {ord.userEmail} · {ord.createdAt}</span>
                          </div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">${ord.totalAmount.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── USER DEEP-DIVE INSPECTOR MODAL ── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm fade-in-up">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-base">
                  {selectedUser.name[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedUser.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{selectedUser.email}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Interests Editor */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Explicit Selected Interests ({editingInterests.length}):
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800">
                {editingInterests.map((tag) => (
                  <span key={tag} className="chip chip-hard text-xs flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setEditingInterests(editingInterests.filter((t) => t !== tag))}
                      className="hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* AI-Derived Interests Editor */}
            <div>
              <label className="block text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Cpu className="w-4 h-4" /> AI-Derived Interests ({editingDerived.length}):
              </label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/40">
                {editingDerived.map((tag) => (
                  <span key={tag} className="chip chip-soft text-xs flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => setEditingDerived(editingDerived.filter((t) => t !== tag))}
                      className="hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Add Custom Tag */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Add new interest tag…"
                className="input-field flex-1"
              />
              <button
                type="button"
                onClick={() => {
                  if (newTagInput.trim()) {
                    setEditingInterests([...editingInterests, newTagInput.trim()])
                    setNewTagInput('')
                  }
                }}
                className="btn-secondary text-xs px-3"
              >
                <Plus className="w-4 h-4" /> Add Tag
              </button>
            </div>

            {/* Cart & Purchases Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">Active Cart Items:</span>
                <span className="text-slate-500">{selectedUser.cart?.length || 0} items pending</span>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white block mb-1">Total Orders Placed:</span>
                <span className="text-slate-500">{selectedUser.orders?.length || 0} completed orders</span>
              </div>
            </div>

            {/* Modal Action Buttons */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                onClick={() => setDeleteConfirmUser(selectedUser)}
                className="px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold border border-rose-200 dark:border-rose-800 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete User Account
              </button>

              <div className="flex gap-2">
                <button onClick={() => setSelectedUser(null)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button onClick={handleSaveUserInterests} className="btn-primary text-xs">
                  Save Interest Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in-up">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Account Confirmation</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete user <strong className="text-slate-900 dark:text-white">{deleteConfirmUser.email}</strong>? This action will erase all interest profiles, cart state, and order history.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button onClick={() => setDeleteConfirmUser(null)} className="btn-secondary text-xs">
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmUser.email)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all"
              >
                Confirm Permanent Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
