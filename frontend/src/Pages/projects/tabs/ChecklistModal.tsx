import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Plus, CheckCircle2, XCircle, AlertCircle, Clock, Edit3, Trash2, CheckSquare } from 'lucide-react';
import { projectService } from '../../../services/project.service';
import type { Checklist, ChecklistItemStatus, AddChecklistItemRequest, UpdateChecklistItemRequest } from '../../../types';
import toast from 'react-hot-toast';

interface ChecklistModalProps {
  projectId: string;
  milestoneId: string;
  checklist?: Checklist;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', label: 'Pending' },
  pass: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Pass' },
  fail: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Fail' },
  na: { icon: AlertCircle, color: 'text-slate-500', bg: 'bg-slate-50', label: 'N/A' },
};

const ChecklistModal: React.FC<ChecklistModalProps> = ({
  projectId, milestoneId, checklist, canEdit, onClose, onSaved
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<Partial<AddChecklistItemRequest>>({});

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    if (checklist?.id) {
      loadChecklist();
    }
  }, [checklist?.id]);

  const loadChecklist = async () => {
    try {
      const response = await projectService.getChecklist(projectId, milestoneId, checklist!.id);
      setData(response.checklist);
    } catch (err) {
      toast.error('Failed to load checklist');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (itemId: string, status: ChecklistItemStatus) => {
    if (!data) return;

    setData((prev) => prev ? {
      ...prev,
      items: prev.items.map((item) => item.id === itemId ? { ...item, status } : item),
    } : prev);

    try {
      const response = await projectService.updateChecklistItem(
        projectId, milestoneId, itemId,
        { status, actual_value: '', notes: '' }
      );
      setData(response.checklist);
      onSaved();
      toast.success(t('projects:checklist.item.statusUpdated', 'Status updated'));
    } catch (err) {
      toast.error(t('projects:checklist.item.statusError', 'Failed to update status'));
      await loadChecklist();
    }
  };

  const handleSaveItem = async (itemId: string, updates: { actual_value?: string; notes?: string }) => {
    if (!data) return;

    try {
      const validUpdates: UpdateChecklistItemRequest = {
        status: data.items.find(item => item.id === itemId)?.status || 'pending',
        ...updates
      };

      const response = await projectService.updateChecklistItem(
        projectId, milestoneId, itemId, validUpdates
      );
      setData(response.checklist);
      setEditingItem(null);
      onSaved();
      toast.success(t('projects:checklist.item.updated', 'Item updated'));
    } catch (err) {
      toast.error(t('projects:checklist.item.updateError', 'Failed to update item'));
    }
  };

  const handleAddItem = async () => {
    if (!data || !newItem.title) return;

    try {
      const response = await projectService.addChecklistItem(
        projectId, milestoneId, data.id,
        newItem as AddChecklistItemRequest
      );
      setData(response.checklist);
      setNewItem({});
      onSaved();
      toast.success(t('projects:checklist.item.added', 'Item added'));
    } catch (err) {
      toast.error(t('projects:checklist.item.addError', 'Failed to add item'));
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!data || !confirm(t('projects:checklist.item.confirmDelete', 'Are you sure you want to delete this item?'))) return;

    try {
      const response = await projectService.deleteChecklistItem(
        projectId, milestoneId, itemId
      );
      setData(response.checklist);
      onSaved();
      toast.success(t('projects:checklist.item.deleted', 'Item deleted'));
    } catch (err) {
      toast.error(t('projects:checklist.item.deleteError', 'Failed to delete item'));
    }
  };

  if (loading) {
    return createPortal(
      (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
        </div>
      ),
      document.body
    );
  }

  if (!data) return null;

  const completedItems = data.items.filter(item => item.status === 'pass' || item.status === 'fail' || item.status === 'na').length;
  const progressPercent = data.items.length > 0 ? Math.round((completedItems / data.items.length) * 100) : 0;

  return createPortal(
    (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[221] isolate w-full max-w-4xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 sm:p-7 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h3 className="text-lg font-black uppercase tracking-[0.08em] text-slate-900 flex items-center gap-2">
                <CheckSquare size={20} className="text-amber-600" />
                {data.title}
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {completedItems}/{data.items.length} completed ({progressPercent}%)
                </span>
              </div>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {data.description && (
            <p className="text-sm text-slate-600 italic">{data.description}</p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-white px-6 sm:px-7 pb-6">
          <div className="space-y-4">
            {data.items.map((item) => {
              const StatusIcon = STATUS_CONFIG[item.status].icon;
              const isEditing = editingItem === item.id;

              return (
                <div key={item.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-amber-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3">
                        <button
                          onClick={() => handleStatusChange(item.id, item.status === 'pass' ? 'pending' : 'pass')}
                          disabled={!canEdit}
                          className={`p-1 rounded-full transition-colors ${STATUS_CONFIG[item.status].bg} disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          <StatusIcon size={16} className={STATUS_CONFIG[item.status].color} />
                        </button>
                        <h4 className="text-sm font-bold text-slate-900 flex-1">{item.title}</h4>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <>
                              <button
                                onClick={() => setEditingItem(isEditing ? null : item.id)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, 'pass')}
                          disabled={!canEdit}
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all antialiased ${
                            item.status === 'pass'
                              ? 'bg-emerald-500 text-white shadow-md'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          ✓ {t('projects:checklist.item.pass', 'Pass')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, 'fail')}
                          disabled={!canEdit}
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all antialiased ${
                            item.status === 'fail'
                              ? 'bg-rose-500 text-white shadow-md'
                              : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          ✗ {t('projects:checklist.item.fail', 'Fail')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(item.id, 'na')}
                          disabled={!canEdit}
                          className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all antialiased ${
                            item.status === 'na'
                              ? 'bg-slate-500 text-white shadow-md'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                        >
                          {t('projects:checklist.item.na', 'N/A')}
                        </button>
                      </div>

                      {item.description && (
                        <p className="text-xs text-slate-600 mb-3 italic">{item.description}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {item.expected_value && (
                          <div>
                            <span className="font-semibold text-slate-500">{t('projects:checklist.item.expected', 'Expected')}:</span>
                            <span className="ml-2 text-slate-900 font-mono">{item.expected_value}</span>
                          </div>
                        )}
                        {item.actual_value && (
                          <div>
                            <span className="font-semibold text-slate-500">{t('projects:checklist.item.actual', 'Actual')}:</span>
                            <span className="ml-2 text-slate-900 font-mono">{item.actual_value}</span>
                          </div>
                        )}
                      </div>

                      {item.notes && (
                        <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-700">
                          <strong>{t('projects:checklist.item.notesLabel', 'Notes')}:</strong> {item.notes}
                        </div>
                      )}

                      {item.checked_by && (
                        <div className="mt-2 text-xs text-slate-500">
                          Checked by {item.checked_by.full_name} on {new Date(item.checked_at!).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {canEdit && isEditing && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder={t('projects:checklist.item.actualPlaceholder', 'Actual value')}
                          defaultValue={item.actual_value || ''}
                          className="bg-white px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          onBlur={(e) => {
                            const updates: Partial<UpdateChecklistItemRequest> = {};
                            if (e.target.value !== item.actual_value) {
                              updates.actual_value = e.target.value;
                            }
                            if (Object.keys(updates).length > 0) {
                              handleSaveItem(item.id, updates);
                            }
                          }}
                        />
                        <textarea
                          placeholder={t('projects:checklist.item.notesPlaceholder', 'Notes')}
                          defaultValue={item.notes || ''}
                          className="bg-white px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                          rows={2}
                          onBlur={(e) => {
                            if (e.target.value !== item.notes) {
                              handleSaveItem(item.id, { notes: e.target.value });
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {canEdit && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={t('projects:checklist.item.newTitlePlaceholder', 'New checklist item title...')}
                  value={newItem.title || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-white px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-bold text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder={t('projects:checklist.item.newExpectedPlaceholder', 'Expected value (optional)')}
                  value={newItem.expected_value || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, expected_value: e.target.value }))}
                  className="bg-white px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-semibold text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <textarea
                placeholder={t('projects:checklist.item.newDescriptionPlaceholder', 'Description (optional)')}
                value={newItem.description || ''}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                className="w-full mt-3 bg-white px-3 py-2 border-2 border-slate-200 rounded-lg text-sm font-medium text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                rows={2}
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.title?.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                  {t('projects:checklist.item.add', 'Add Item')}
                </button>
              </div>
            </div>
            )}
          </div>
        </div>

        <div className="shrink-0 px-6 sm:px-7 py-4 border-t border-slate-100 bg-slate-50 rounded-b-[30px]">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600">
              {data.is_completed ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle2 size={16} />
                  {t('projects:checklist.completedOn', 'Completed on')} {new Date(data.completed_at!).toLocaleDateString()}
                </span>
              ) : (
                <span>{t('projects:checklist.progress', 'Progress')}: {progressPercent}% {t('projects:checklist.complete', 'complete')}</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
              >
                {t('common.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    ),
    document.body
  );
};

export default ChecklistModal;
