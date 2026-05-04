import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, FolderTree, Database, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import type { Category } from '../../types';
import { categoryService } from '../../services/category.service';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

/* Phải khớp className="meteor" — từ trên-phải xuống dưới-trái; to top = đầu sáng phía trước quỹ đạo */
const meteorStyles = `
  @keyframes meteor-effect {
    0% { transform: translate(500px, -500px) rotate(-45deg); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translate(-1000px, 1000px) rotate(-45deg); opacity: 0; }
  }
  .meteor {
    position: absolute;
    width: 1.5px;
    height: 90px;
    background: linear-gradient(to top, rgba(99, 102, 241, 0.88), transparent);
    animation: meteor-effect linear infinite;
    pointer-events: none;
    z-index: 1;
  }
`;

type MeteorSpec = { id: number; top: string; right: string; animationDuration: string };

const CategoriesPage: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.system_role);
  const { t } = useTranslation();

  const canManage = useMemo(() => isAuthenticated && role === 'vien_truong', [isAuthenticated, role]);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; description: string }>({ name: '', description: '' });
  const [meteors, setMeteors] = useState<MeteorSpec[]>([]);

  // Hiệu ứng sao băng rơi (mỗi vệt có top/right/duration cố định — tránh random mỗi render)
  useEffect(() => {
    const interval = setInterval(() => {
      setMeteors((prev) => {
        const spec: MeteorSpec = {
          id: Date.now(),
          top: `${-(4 + Math.random() * 14)}%`,
          right: `${Math.random() * 38}%`,
          animationDuration: `${Math.random() * 2 + 1.5}s`,
        };
        return [...prev.slice(-10), spec];
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  const getApiErrorMessage = (err: unknown): string | undefined => {
    if (typeof err === 'object' && err !== null) {
      const e = err as { response?: { data?: { message?: string } } };
      const m = e.response?.data?.message;
      if (typeof m === 'string' && m.trim()) return translateApiMessage(t, m);
    }
    return undefined;
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await categoryService.list();
      setItems(res.data.items || []);
    } catch {
      toast.error(t('user:categories.toasts.fetchFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: '', description: '' });
  };

  const onCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    const name = form.name.trim();
    if (!name) return toast.error(t('user:categories.toasts.nameRequired'));

    setSubmitting(true);
    try {
      if (editingId) {
        await categoryService.update(editingId, { name, description: form.description.trim() || null });
        toast.success(t('user:categories.toasts.updated'));
      } else {
        await categoryService.create({ name, description: form.description.trim() || null });
        toast.success(t('user:categories.toasts.created'));
      }
      await load();
      resetForm();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err) || t('user:categories.toasts.createUpdateFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (cat: Category) => {
    if (!canManage) return;
    setEditingId(cat.id);
    setForm({ name: cat.name || '', description: cat.description ? String(cat.description) : '' });
  };

  const onDelete = async (id: string) => {
    if (!canManage) return;
    if (!window.confirm(t('user:categories.confirm.delete'))) return;
    setSubmitting(true);
    try {
      await categoryService.remove(id);
      toast.success(t('user:categories.toasts.deleted'));
      await load();
      resetForm();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err) || t('user:categories.toasts.deleteFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-20 relative overflow-hidden">
      <style>{meteorStyles}</style>

      {/* BACKGROUND DECOR */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20" />
        {meteors.map((m) => (
          <div
            key={m.id}
            className="meteor"
            style={{ top: m.top, right: m.right, animationDuration: m.animationDuration }}
          />
        ))}
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-16 relative z-10">
        {/* HEADER */}
        <header className="mb-12">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-[0.4em] mb-4">
            <Database size={14} />
            {t('user:categories.kicker')}
          </motion.div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
                {t('user:categories.title')}
              </h1>
              <p className="text-slate-400 mt-3 text-sm font-medium max-w-2xl border-l-2 border-indigo-500/30 pl-4">
                {t('user:categories.subtitle')}
              </p>
            </div>
            {!canManage && (
              <div className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-bold animate-pulse">
                {t('user:categories.noPermission')}
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* FORM PANEL */}
          {canManage && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-5">
              <div className="bg-white/[0.03] backdrop-blur-xl rounded-[40px] border border-white/10 p-8 sticky top-8 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                      <FolderTree size={20} />
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-tight text-white">
                      {editingId ? t('user:categories.form.editTitle') : t('user:categories.form.createTitle')}
                    </h2>
                  </div>
                  <button onClick={resetForm} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                    {t('user:categories.actions.reset')}
                  </button>
                </div>

                <form onSubmit={onCreateOrUpdate} className="space-y-6">
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-indigo-400 transition-colors ml-1">
                      {t('user:categories.form.nameLabel')}
                    </label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/10 outline-none font-bold text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                      placeholder={t('user:categories.form.namePlaceholder')}
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-focus-within:text-indigo-400 transition-colors ml-1">
                      {t('user:categories.form.descriptionLabel')}
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      className="w-full px-6 py-4 rounded-2xl bg-black/40 border border-white/10 outline-none font-bold text-sm text-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                      rows={5}
                      placeholder={t('user:categories.form.descriptionPlaceholder')}
                      disabled={submitting}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full relative group overflow-hidden flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-indigo-500/20 hover:bg-white hover:text-black transition-all duration-300 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? <Pencil size={16} /> : <Plus size={16} />}
                    {editingId ? t('user:categories.actions.update') : t('user:categories.actions.create')}
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* LIST PANEL */}
          <div className={canManage ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <div className="bg-white/[0.02] backdrop-blur-md rounded-[40px] border border-white/5 p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Activity size={18} className="text-indigo-400" />
                  <h2 className="text-lg font-black uppercase text-white tracking-tight">{t('user:categories.list.title')}</h2>
                </div>
                <div className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest border border-white/5">
                  {t('user:categories.list.count', { count: items.length })}
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Syncing Data Nodes...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-bold italic border-2 border-dashed border-white/5 rounded-3xl">
                  {t('user:categories.list.empty')}
                </div>
              ) : (
                <div className="overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-white/5">
                        <th className="pb-4 px-2">{t('user:categories.table.name')}</th>
                        <th className="pb-4 px-2 hidden md:table-cell">{t('user:categories.table.description')}</th>
                        {canManage && <th className="pb-4 text-right px-2">{t('user:categories.table.actions')}</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {items.map((cat, idx) => (
                        <motion.tr 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          key={cat.id} 
                          className="group hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-5 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full bg-indigo-500/40 group-hover:bg-indigo-400 transition-colors shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                              <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">{cat.name}</span>
                            </div>
                          </td>
                          <td className="py-5 px-2 text-xs text-slate-500 font-medium hidden md:table-cell max-w-[200px] truncate">
                            {cat.description ? String(cat.description) : t('user:categories.dash')}
                          </td>
                          {canManage && (
                            <td className="py-5 px-2 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => onEdit(cat)}
                                  className="p-2.5 rounded-xl bg-white/5 hover:bg-indigo-500 hover:text-white text-indigo-400 border border-white/5 transition-all"
                                  title={t('user:categories.actions.edit')}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => onDelete(cat.id)}
                                  className="p-2.5 rounded-xl bg-white/5 hover:bg-rose-500 hover:text-white text-rose-400 border border-white/5 transition-all"
                                  title={t('user:categories.actions.delete')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoriesPage;