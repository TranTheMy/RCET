import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Heart,
  MessageSquare,
  Share2,
  Terminal,
  MoreHorizontal,
  Zap,
  Layers,
  Send,
  Radio,
  Activity,
  Loader2,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { forumService } from '../../services/forum.service';
import { useAuthStore } from '../../store/authStore';
import type { ForumPostDetail, ForumPostListItem } from '../../types';
import { ROUTER } from '../../routes/router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { translateApiMessage } from '../../utils/apiErrorI18n';

function initials(name?: string | null): string {
  const s = name?.trim() || '';
  if (!s) return '?';
  return s.slice(0, 2).toUpperCase();
}

function ForumAuthorAvatar({
  name,
  avatar,
  sizeClass = 'w-12 h-12 text-xs',
}: {
  name?: string | null;
  avatar?: string | null;
  sizeClass?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = avatar?.trim();
  const showImg = Boolean(src) && !broken;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center text-white font-bold border border-white/10 shrink-0 overflow-hidden ${sizeClass}`}
    >
      {showImg ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}

function formatTime(iso: string | undefined, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(locale);
  } catch {
    return iso;
  }
}

function forumWriteErrorMessage(
  err: unknown,
  t: TFunction,
  defaultKey: string,
): string {
  if (axios.isAxiosError(err) && err.response?.data && typeof err.response.data === 'object') {
    const m = (err.response.data as { message?: string }).message;
    if (typeof m === 'string' && m.trim()) return translateApiMessage(t, m.trim());
  }
  const st = axios.isAxiosError(err) ? err.response?.status : undefined;
  if (st === 422) return t('user:forums.toasts.moderationRejected');
  if (st === 503) return t('user:forums.toasts.moderationUnavailable');
  return t(defaultKey);
}

const UUID_HASH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const Forums: React.FC = () => {
  const { user, isAuthenticated, initialized } = useAuthStore();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN';
  const [posts, setPosts] = useState<ForumPostListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailByPost, setDetailByPost] = useState<Record<string, ForumPostDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<ForumPostListItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadPosts = useCallback(async (opts?: { silent?: boolean }) => {
    if (!isAuthenticated) return;
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const res = await forumService.listPosts({ page: 1, limit: 50 });
      setPosts(res.data?.posts ?? []);
    } catch {
      if (!silent) toast.error(t('user:forums.toasts.fetchFailed'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAuthenticated, t]);

  useEffect(() => {
    if (!initialized) return;
    if (isAuthenticated) loadPosts();
    else {
      setPosts([]);
    }
  }, [initialized, isAuthenticated, loadPosts]);

  const hashPostId = useMemo(() => {
    const raw = location.hash?.replace(/^#/, '').trim();
    if (!raw || !UUID_HASH_RE.test(raw)) return null;
    return raw;
  }, [location.hash]);

  const hashDeepLinkAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    hashDeepLinkAppliedRef.current = null;
  }, [hashPostId]);

  useEffect(() => {
    if (!hashPostId || loading || !isAuthenticated) return;
    if (!posts.some((p) => p.id === hashPostId)) return;
    if (hashDeepLinkAppliedRef.current === hashPostId) return;
    hashDeepLinkAppliedRef.current = hashPostId;

    let cancelled = false;
    (async () => {
      setExpandedId(hashPostId);
      setCommentDraft('');
      setDetailLoading(hashPostId);
      try {
        const res = await forumService.getPost(hashPostId);
        const d = res.data;
        if (!cancelled && d) setDetailByPost((m) => ({ ...m, [hashPostId]: d }));
      } catch {
        if (!cancelled) toast.error(t('user:forums.toasts.fetchDetailFailed'));
      } finally {
        if (!cancelled) setDetailLoading(null);
      }
      if (!cancelled) {
        requestAnimationFrame(() => {
          window.setTimeout(() => {
            document.getElementById(`forum-post-${hashPostId}`)?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }, 120);
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hashPostId, loading, posts, isAuthenticated, t]);

  const openDetail = async (postId: string) => {
    if (expandedId === postId) {
      setExpandedId(null);
      return;
    }
    setCommentDraft('');
    setExpandedId(postId);
    if (detailByPost[postId]) return;
    setDetailLoading(postId);
    try {
      const res = await forumService.getPost(postId);
      const d = res.data;
      if (d) setDetailByPost((m) => ({ ...m, [postId]: d }));
    } catch {
      toast.error(t('user:forums.toasts.fetchDetailFailed'));
      setExpandedId(null);
    } finally {
      setDetailLoading(null);
    }
  };

  const refreshDetail = async (postId: string) => {
    try {
      const res = await forumService.getPost(postId);
      const d = res.data;
      if (d) setDetailByPost((m) => ({ ...m, [postId]: d }));
    } catch {
      /* ignore */
    }
  };

  const onCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    const content = newContent.trim();
    if (title.length < 3 || content.length < 3) {
      toast.error(t('user:forums.toasts.minLength'));
      return;
    }
    setCreating(true);
    try {
      await forumService.createPost({ title, content });
      toast.success(t('user:forums.toasts.posted'));
      setNewTitle('');
      setNewContent('');
      await loadPosts({ silent: true });
    } catch (err: unknown) {
      toast.error(forumWriteErrorMessage(err, t, 'user:forums.toasts.postFailed'));
    } finally {
      setCreating(false);
    }
  };

  const onToggleLike = async (postId: string) => {
    try {
      await forumService.likePost(postId);
      await loadPosts({ silent: true });
      await refreshDetail(postId);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        try {
          await forumService.unlikePost(postId);
          await loadPosts({ silent: true });
          await refreshDetail(postId);
        } catch {
          toast.error(t('user:forums.toasts.likeUpdateFailed'));
        }
      } else {
        toast.error(t('user:forums.toasts.likeUpdateFailed'));
      }
    }
  };

  const likedByCurrentUser = (postId: string): boolean => {
    const uid = user?.id;
    if (!uid) return false;
    const d = detailByPost[postId];
    if (d?.liked_by) return d.liked_by.includes(uid);
    return false;
  };

  const onAddComment = async (postId: string) => {
    const c = commentDraft.trim();
    if (c.length < 1) {
      toast.error(t('user:forums.toasts.commentRequired'));
      return;
    }
    try {
      await forumService.addComment(postId, { content: c });
      setCommentDraft('');
      await refreshDetail(postId);
      await loadPosts({ silent: true });
      toast.success(t('user:forums.toasts.commentSent'));
    } catch (err: unknown) {
      toast.error(forumWriteErrorMessage(err, t, 'user:forums.toasts.commentFailed'));
    }
  };

  const onDeletePost = async (postId: string) => {
    if (!window.confirm(t('user:forums.confirm.deletePost'))) return;
    try {
      await forumService.deletePost(postId);
      toast.success(t('user:forums.toasts.postDeleted'));
      setExpandedId(null);
      setDetailByPost((m) => {
        const n = { ...m };
        delete n[postId];
        return n;
      });
      await loadPosts({ silent: true });
    } catch {
      toast.error(t('user:forums.toasts.postDeleteFailed'));
    }
    setMenuOpenId(null);
  };

  const startEdit = (p: ForumPostListItem) => {
    setEditingPost(p);
    setEditTitle(p.title);
    setEditContent(p.content);
    setMenuOpenId(null);
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    const title = editTitle.trim();
    const content = editContent.trim();
    if (title.length < 3 || content.length < 3) {
      toast.error(t('user:forums.toasts.minLength'));
      return;
    }
    setSavingEdit(true);
    try {
      await forumService.updatePost(editingPost.id, { title, content });
      toast.success(t('user:forums.toasts.updated'));
      setEditingPost(null);
      await loadPosts({ silent: true });
      if (detailByPost[editingPost.id]) await refreshDetail(editingPost.id);
    } catch (err: unknown) {
      toast.error(forumWriteErrorMessage(err, t, 'user:forums.toasts.updateFailed'));
    } finally {
      setSavingEdit(false);
    }
  };

  const onDeleteComment = async (commentId: string, postId: string) => {
    if (!window.confirm(t('user:forums.confirm.deleteComment'))) return;
    try {
      await forumService.deleteComment(commentId);
      await refreshDetail(postId);
      await loadPosts({ silent: true });
      toast.success(t('user:forums.toasts.commentDeleted'));
    } catch {
      toast.error(t('user:forums.toasts.commentDeleteFailed'));
    }
  };

  if (!initialized) {
    return (
      <div className="min-h-screen bg-[#02040a] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#02040a] text-slate-300 flex flex-col items-center justify-center px-6 font-mono">
        <Terminal className="w-16 h-16 text-cyan-500/50 mb-6" />
        <h1 className="text-xl font-black text-white uppercase tracking-widest mb-2">{t('user:forums.auth.title')}</h1>
        <p className="text-slate-500 text-sm text-center max-w-md mb-8">
          {t('user:forums.auth.hint')}
        </p>
        <Link
          to={ROUTER.USER.LOGIN}
          className="px-8 py-3 bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-cyan-400"
        >
          {t('common:actions.login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#02040a] text-slate-300 font-mono selection:bg-cyan-500/30 overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#0f172a_0%,#02040a_100%)]" />
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
      </div>

      <main className="relative z-10 max-w-[1400px] mx-auto grid grid-cols-12 gap-8 px-8 py-10">
        <aside className="col-span-3 space-y-6 hidden lg:block">
          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 backdrop-blur-md">
            <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity size={14} /> Active_Nodes
            </h3>
            <ul className="space-y-4">
              {['Quantum_Lab', 'Neural_Sectors', 'Robotics_R&D', 'Bio_Sync'].map((item) => (
                <li key={item} className="group flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-slate-500 group-hover:text-white transition-colors">#{item}</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full group-hover:shadow-[0_0_8px_#10b981]" />
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-6 space-y-6">
          <form
            onSubmit={onCreatePost}
            className="bg-slate-900/60 border border-white/10 rounded-[32px] p-6 shadow-2xl"
          >
            <div className="flex gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 border border-cyan-500/20 shrink-0">
                <Terminal size={20} />
              </div>
              <div className="flex-1 space-y-3">
                <input
                  type="text"
                  placeholder={t('user:forums.form.titlePlaceholder')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                  maxLength={150}
                />
                <textarea
                  placeholder={t('user:forums.form.contentPlaceholder')}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-200 placeholder:text-slate-600 resize-none min-h-[80px] text-sm"
                  maxLength={5000}
                />
                <p className="text-[9px] text-slate-600 leading-relaxed mt-2">{t('user:forums.form.moderationHint')}</p>
              </div>
            </div>
            <div className="flex justify-between mt-4 pt-4 border-t border-white/5">
              <div className="flex gap-4 text-slate-600">
                <Zap size={18} />
                <Layers size={18} />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="px-8 py-2 bg-cyan-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-cyan-400 disabled:opacity-50"
              >
                {creating ? t('common:status.loading') : t('user:forums.actions.post')}
              </button>
            </div>
          </form>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />
            </div>
          ) : (
            <AnimatePresence>
              {posts.map((post, idx) => (
                <motion.div
                  key={post.id}
                  id={`forum-post-${post.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group bg-[#0d1117]/80 border border-white/5 rounded-[32px] p-8 hover:border-cyan-500/30 transition-all duration-500 scroll-mt-24"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <ForumAuthorAvatar name={post.author?.full_name} avatar={post.author?.avatar} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-white truncate">
                            {post.author?.full_name ?? t('user:forums.fallback.member')}
                          </span>
                          <span className="text-[8px] px-2 py-0.5 rounded bg-white/5 text-slate-500 border border-white/10 font-black uppercase tracking-widest">
                            {post.author?.system_role ?? 'user'}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-600">{formatTime(post.created_at, dateLocale)}</span>
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === post.id ? null : post.id)}
                        className="text-slate-700 hover:text-white"
                        aria-label={t('user:forums.actions.menu')}
                      >
                        <MoreHorizontal className="cursor-pointer" />
                      </button>
                      {menuOpenId === post.id && user?.id === post.user_id ? (
                        <div className="absolute right-0 top-8 z-20 bg-slate-900 border border-white/10 rounded-xl py-1 min-w-[140px] shadow-xl">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-white/5"
                            onClick={() => startEdit(post)}
                          >
                            <Pencil size={14} /> {t('user:forums.actions.edit')}
                          </button>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-rose-400 hover:bg-white/5"
                            onClick={() => onDeletePost(post.id)}
                          >
                            <Trash2 size={14} /> {t('user:forums.actions.delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <h2 className="text-xl font-bold text-white mb-3 group-hover:text-cyan-400 transition-colors tracking-tight">
                    {post.title}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed mb-6 whitespace-pre-wrap">{post.content}</p>

                  <div className="flex items-center gap-8 pt-6 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => onToggleLike(post.id)}
                      className={`flex items-center gap-2 text-xs font-bold transition-all ${
                        likedByCurrentUser(post.id)
                          ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                          : 'text-slate-500 hover:text-rose-400'
                      }`}
                    >
                      <Heart size={18} fill={likedByCurrentUser(post.id) ? 'currentColor' : 'none'} />
                      {post.likes_count}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDetail(post.id)}
                      className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      <MessageSquare size={18} />
                      {t('user:forums.actions.responses')}
                      {detailByPost[post.id] != null ? ` (${detailByPost[post.id].comments.length})` : ''}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-white transition-colors ml-auto"
                      onClick={() => {
                        void navigator.clipboard.writeText(`${window.location.origin}/publication/forums#${post.id}`);
                        toast.success(t('user:forums.toasts.linkCopied'));
                      }}
                    >
                      <Share2 size={18} />
                      {t('user:forums.actions.copyLink')}
                    </button>
                  </div>

                  {expandedId === post.id && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                      {detailLoading === post.id ? (
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                      ) : detailByPost[post.id] ? (
                        <>
                          <ul className="space-y-3 max-h-64 overflow-y-auto">
                            {detailByPost[post.id].comments.map((cm) => (
                              <li
                                key={cm.id}
                                className="rounded-xl bg-black/30 border border-white/5 px-3 py-2 text-sm"
                              >
                                <div className="flex items-start gap-2 mb-1">
                                  <ForumAuthorAvatar
                                    name={cm.author?.full_name}
                                    avatar={cm.author?.avatar}
                                    sizeClass="w-8 h-8 text-[9px] rounded-xl"
                                  />
                                  <div className="flex-1 min-w-0">
                                <div className="flex justify-between gap-2">
                                  <span className="text-cyan-500/90 text-[10px] font-black uppercase">
                                    {cm.author?.full_name ?? t('user:forums.fallback.user')}
                                  </span>
                                  {user?.id === cm.user_id ? (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteComment(cm.id, post.id)}
                                      className="text-slate-600 hover:text-rose-400"
                                      aria-label={t('user:forums.actions.deleteComment')}
                                    >
                                      <X size={14} />
                                    </button>
                                  ) : null}
                                </div>
                                <p className="text-slate-300 whitespace-pre-wrap">{cm.content}</p>
                                <span className="text-[9px] text-slate-600">{formatTime(cm.created_at, dateLocale)}</span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                          <div className="flex gap-2">
                            <textarea
                              value={commentDraft}
                              onChange={(e) => setCommentDraft(e.target.value)}
                              placeholder={t('user:forums.form.commentPlaceholder')}
                              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 min-h-[56px] resize-none"
                              maxLength={2000}
                            />
                            <button
                              type="button"
                              onClick={() => onAddComment(post.id)}
                              className="self-end p-3 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                              aria-label={t('user:forums.actions.send')}
                            >
                              <Send size={18} />
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-slate-500 text-sm">{t('user:forums.comments.loadFailed')}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loading && posts.length === 0 && (
            <p className="text-center text-slate-600 py-16 text-sm">{t('user:forums.empty')}</p>
          )}
        </section>

        <aside className="col-span-3 hidden lg:block space-y-6">
          <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-3xl p-6">
            <h4 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4">Hub_Intelligence</h4>
            <p className="text-xs text-slate-500 leading-relaxed italic">
              Dữ liệu đồng bộ API <code className="text-cyan-500/80">GET /api/forum/posts</code>. Thích và bình luận theo thời gian thực.
            </p>
          </div>
          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6">
            <div className="flex items-center gap-2 text-[10px] font-black text-white uppercase mb-4">
              <Radio size={14} className="text-rose-500 animate-pulse" /> Live_Feed
            </div>
            <p className="text-[10px] text-slate-500">{t('user:forums.sidebar.loggedInAs', { name: user?.full_name })}</p>
          </div>
        </aside>
      </main>

      {editingPost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#0d1117] border border-white/10 rounded-2xl p-6 max-w-lg w-full space-y-4">
            <h3 className="text-white font-bold text-sm">{t('user:forums.editModal.title')}</h3>
            <input
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={150}
            />
            <textarea
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white min-h-[120px]"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              maxLength={5000}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => void saveEdit()}
                className="px-4 py-2 bg-cyan-500 text-black text-xs font-black uppercase rounded-lg disabled:opacity-50"
              >
                {savingEdit ? '...' : t('user:forums.actions.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Forums;
