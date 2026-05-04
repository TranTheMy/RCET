import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { projectService } from '../../../services/project.service';
import type { CreateChecklistRequest } from '../../../types';
import toast from 'react-hot-toast';

interface CreateChecklistModalProps {
  projectId: string;
  milestoneId: string;
  onClose: () => void;
  onCreated: () => void;
}

const CreateChecklistModal: React.FC<CreateChecklistModalProps> = ({
  projectId, milestoneId, onClose, onCreated
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<Omit<CreateChecklistRequest, 'category' | 'items'>>({
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    try {
      await projectService.createChecklist(projectId, milestoneId, form);
      toast.success(t('projects:checklist.create.success', 'Checklist created successfully'));
      onCreated();
      onClose();
    } catch (err) {
      toast.error(t('projects:checklist.create.error', 'Failed to create checklist'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[221] isolate w-full max-w-lg overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl">
        <div className="p-6 sm:p-7 pb-4">
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-1">
              <h3 className="text-lg font-black uppercase tracking-[0.08em] text-slate-900 flex items-center gap-2">
                <Plus size={20} className="text-amber-600" />
                {t('projects:checklist.create.title', 'Create Checklist')}
              </h3>
              <p className="text-sm text-slate-600">{t('projects:checklist.create.subtitle', 'Add a new technical checklist for this milestone')}</p>
            </div>
            <button onClick={onClose} className="p-3 hover:bg-slate-50 rounded-full text-slate-400 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 sm:px-7 pb-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                {t('projects:checklist.create.titleLabel', 'Checklist Title')} *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t('projects:checklist.create.titlePlaceholder', 'e.g., Sensor Accuracy Testing')}
                className="w-full px-4 py-3 border border-amber-300 rounded-xl text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-900 mb-2">
                {t('projects:checklist.create.descriptionLabel', 'Description')}
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('projects:checklist.create.descriptionPlaceholder', 'Optional description of what this checklist covers...')}
                rows={3}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none placeholder-slate-400"
              />
            </div>

            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={20} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <strong>{t('projects:checklist.create.note', 'Note')}:</strong> {t('projects:checklist.create.noteText', 'You can add checklist items after creating the checklist. Start with the title, then add specific test items in the detail view.')}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-slate-600 hover:text-slate-800 font-semibold transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || saving}
              className="flex items-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {t('common.creating', 'Creating...')}
                </>
              ) : (
                <>
                  <Plus size={16} />
                  {t('projects:checklist.create.title', 'Create Checklist')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    ),
    document.body
  );
};

export default CreateChecklistModal;
