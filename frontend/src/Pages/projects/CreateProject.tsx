import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Check, Loader2, Calendar, Code,
  Tag, User, GitBranch, X,
  PlusCircle, Sparkles, ShieldCheck,
  Terminal, Search, DollarSign, FileText,
  Clock
} from 'lucide-react';
import { projectService } from '../../services/project.service';
import { useAuthStore } from '../../store/authStore';
import type { ProjectTag, User as UserType } from '../../types';
import toast from 'react-hot-toast';
import { PROJECT_TAG_OPTIONS } from '../../constants/projectTags';
import { translateApiMessage, translateFieldErrors } from '../../utils/apiErrorI18n';
import { parseApiFormError } from '../../utils/formFieldErrors';

function mapApiFieldToFormKey(apiField: string): string {
  const base = apiField.split('.')[0].split('[')[0];
  const map: Record<string, string> = {
    code: 'code',
    name: 'name',
    tag: 'tag',
    description: 'description',
    start_date: 'startDate',
    end_date: 'endDate',
    budget: 'budget',
    git_repo_url: 'gitRepoUrl',
    participation_mode: 'participationMode',
    required_members: 'requiredMembers',
    leader_id: 'leaderId',
    members: 'members',
    model_type: 'modelType',
    party_a_id: 'partyAId',
    party_a_percent: 'partyA_percent',
    party_b_percent: 'partyB_percent',
  };
  return map[base] ?? base;
}

const FieldErrorMsg: React.FC<{ text?: string }> = ({ text }) =>
  text ? <p className="text-[10px] text-red-500 font-bold ml-1 mt-1 leading-snug">{text}</p> : null;

const FORM_FIELD_SCROLL_ORDER: string[] = [
  'code',
  'tag',
  'name',
  'gitRepoUrl',
  'participationMode',
  'requiredMembers',
  'members',
  'leaderId',
  'startDate',
  'endDate',
  'budget',
  'modelType',
  'partyA_percent',
  'partyB_percent',
  'partyAId',
];

function scrollToFirstFormError(errors: Record<string, string>) {
  for (const key of FORM_FIELD_SCROLL_ORDER) {
    if (!errors[key]) continue;
    const root = document.querySelector<HTMLElement>(`[data-form-field="${key}"]`);
    if (!root) continue;
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable = root.querySelector<HTMLElement>(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
    );
    if (focusable) focusable.focus({ preventScroll: true });
    break;
  }
}


interface ModelPercentage {
  a: number; 
  b: number; 
  minA: number; maxA: number; 
  minB: number; maxB: number; 
}

const getPercentages = (model: string): ModelPercentage => {
  switch (model) {
    case 'MODEL_2':
      return { a: 50, b: 50, minA: 50, maxA: 60, minB: 40, maxB: 50 };
    case 'MODEL_3':
      return { a: 40, b: 60, minA: 40, maxA: 50, minB: 50, maxB: 60 };
    case 'MODEL_1':
    default:
      return { a: 70, b: 30, minA: 65, maxA: 70, minB: 30, maxB: 35 };
  }
};


const CreateProject: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isTruongLab = user?.system_role === 'truong_lab';

     
  const [participationMode, setParticipationMode] = useState<'tag' | 'join'>('tag');
  const [requiredMembers, setRequiredMembers] = useState<number>(5);

  const [formData, setFormData] = useState({
    code: '', name: '', description: '',
    tag: '' as ProjectTag | '',
    leaderId: '',
    startDate: '', endDate: '',
    budget: '', gitRepoUrl: '',
    modelType: 'MODEL_1',
    partyAId: '',
  });

  const formatVND = (value: number) => {
    if (!value || isNaN(value)) return '';
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  const parseVND = (value: string) => {
    if (!value) return '';
    return value.toString().replace(/\./g, '');
  };

  const today = new Date().toISOString().split('T')[0];

  const getDurationText = (start: string, end: string) => {
    if (!start || !end) return null;
    const diff = Math.ceil(
      (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff <= 0) return null;
  
    const years = Math.floor(diff / 365);
    const remainAfterYears = diff % 365;
    const months = Math.floor(remainAfterYears / 30);
    const days = remainAfterYears % 30;
  
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} năm`);
    if (months > 0) parts.push(`${months} tháng`);
    if (days > 0) parts.push(`${days} ngày`);
  
    return parts.join(' ') || null;
  };

  const [percentA, setPercentA] = useState<number>(70);
  const [percentError, setPercentError] = useState<string>('');

  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<UserType[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserType[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [partyAOptions, setPartyAOptions] = useState<UserType[]>([]);

  useEffect(() => {
    const loadPartyA = async () => {
      try {
        const users = await projectService.searchActiveUsers('', { partyAOnly: true });
        if (Array.isArray(users)) {
          setPartyAOptions(users);
        }
      } catch (error) {
        console.error('Failed to load Party A options', error);
      }
    };
    loadPartyA();
  }, []);

  useEffect(() => {
    const checkCode = async () => {
      if (!formData.code || formData.code.length < 2) { setCodeStatus('idle'); return; }
      setCodeStatus('checking');
      try {
        const res = await projectService.checkCode(formData.code);
        setCodeStatus(res.exists ? 'taken' : 'available');
      } catch { setCodeStatus('idle'); }
    };
    const timer = setTimeout(checkCode, 600);
    return () => clearTimeout(timer);
  }, [formData.code]);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) { setMemberResults([]); return; }
    try {
      const users = await projectService.searchActiveUsers(query, {
        excludeVienTruong: true,
        checkCapacity: true,
      });
      setMemberResults(Array.isArray(users) ? users : []);
    } catch { setMemberResults([]); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(memberQuery), 300);
    return () => clearTimeout(timer);
  }, [memberQuery, searchUsers]);

  const addMember = (u: UserType) => {
    if (u.at_project_limit) {
      toast.error(
        'Thành viên này đang tham gia đủ số dự án cho phép (tối đa 2), không thể mời thêm.',
      );
      return;
    }
    clearFieldError('members');
    setSelectedMembers((prev) => {
      if (prev.some((x) => x.id === u.id)) return prev;
      if (prev.length >= 5) {
        toast.error(t('projects:create.errors.maxMembers'));
        return prev;
      }
      return [...prev, u];
    });
    setMemberQuery('');
    setMemberResults([]);
  };

  const removeMember = (uid: string) => {
    clearFieldError('members');
    setSelectedMembers((prev) => prev.filter((x) => x.id !== uid));
    setFormData((prev) => ({
      ...prev,
      leaderId: prev.leaderId === uid ? '' : prev.leaderId,
    }));
  };

  const clearFieldError = useCallback((key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const validateClientFields = useCallback((): { valid: boolean; errors: Record<string, string> } => {
    const errors: Record<string, string> = {};
    const isTagMode = participationMode === 'tag';

    if (!formData.code.trim()) {
      errors.code = t('projects:create.errors.fieldCodeRequired');
    } else if (codeStatus === 'taken') {
      errors.code = t('projects:create.errors.codeTaken');
    }

    if (!formData.tag) {
      errors.tag = t('projects:create.errors.fieldTagRequired');
    }

    const nameTrim = formData.name.trim();
    if (!nameTrim) {
      errors.name = t('projects:create.errors.fieldNameRequired');
    } else if (nameTrim.length < 5) {
      errors.name = t('projects:create.errors.nameMinLength');
    }

    if (!formData.startDate) {
      errors.startDate = t('projects:create.errors.startDateRequired');
    }
    if (!formData.endDate) {
      errors.endDate = t('projects:create.errors.endDateRequired');
    } else if (formData.startDate && formData.endDate <= formData.startDate) {
      errors.endDate = t('projects:create.errors.endAfterStart');
    }

    if (formData.gitRepoUrl.trim() && isTruongLab) {
      try {
        new URL(formData.gitRepoUrl);
      } catch {
        errors.gitRepoUrl = t('projects:create.errors.gitUrlInvalid');
      }
    }

    if (percentError) {
      errors.partyA_percent = percentError;
    }

    if (!formData.partyAId) {
      errors.partyAId = t('projects:create.errors.partyARequired');
    }

    if (isTagMode) {
      if (selectedMembers.length === 0) {
        errors.members = t('projects:create.errors.tagAtLeastOne');
      } else if (selectedMembers.length > 5) {
        errors.members = t('projects:create.errors.maxMembers');
      }
      if (!formData.leaderId) {
        errors.leaderId = t('projects:create.errors.chooseLeader');
      } else if (!selectedMembers.some((m) => m.id === formData.leaderId)) {
        errors.leaderId = t('projects:create.errors.leaderMustBeTagged');
      }
    } else if (!user?.id) {
      errors.participationMode = t('projects:create.errors.cannotIdentifyCreator');
    }

    setFieldErrors(errors);
    const valid = Object.keys(errors).length === 0;
    return { valid, errors };
  }, [
    participationMode,
    formData,
    codeStatus,
    selectedMembers,
    percentError,
    user?.id,
    isTruongLab,
    t,
  ]);

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    clearFieldError('modelType');
    const newModel = e.target.value;
    setFormData({ ...formData, modelType: newModel });

    const defaults = getPercentages(newModel);
    setPercentA(defaults.a);
    setPercentError('');
  };

  const handlePercentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFieldError('partyA_percent');
    const val = Number(e.target.value);
    setPercentA(val);

    const limits = getPercentages(formData.modelType);
    if (val < limits.minA || val > limits.maxA) {
      setPercentError(`Vui lòng nhập từ ${limits.minA}% đến ${limits.maxA}%`);
    } else {
      setPercentError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateClientFields();
    if (!validation.valid) {
      toast.error(t('projects:create.errors.fixHighlighted'));
      requestAnimationFrame(() => scrollToFirstFormError(validation.errors));
      return;
    }

    const isTagMode = participationMode === 'tag';

    setSubmitting(true);
    try {
             
      const basePayload: any = {
        code: formData.code,
        name: formData.name,
        description: formData.description,
        tag: formData.tag || undefined,
        status: 'planning',
        start_date: formData.startDate,
        end_date: formData.endDate,
        budget: formData.budget ? Number(formData.budget) : undefined,
        git_repo_url: formData.gitRepoUrl || undefined,

        model_type: formData.modelType,
        party_a_id: formData.partyAId,
        party_a_percent: percentA,
        party_b_percent: 100 - percentA,
        participation_mode: isTagMode ? 'TAG' : 'SELF_JOIN',
      };

      if (isTagMode) {
        basePayload.leader_id = formData.leaderId;
        basePayload.members = selectedMembers.map((m) => m.id);
      } else {
        basePayload.leader_id = null;
        basePayload.members = undefined;
        basePayload.required_members = requiredMembers;
      }

      const created = await projectService.create(basePayload as any);
      setFieldErrors({});
      toast.success("Tạo dự án và gửi yêu cầu Cam kết thành công!");
      if (created?.id) navigate(`/projects/${created.id}`);
    } catch (error: unknown) {
      const parsed = parseApiFormError(error);
      const mapped: Record<string, string> = {};
      for (const [apiKey, msg] of Object.entries(parsed.fieldErrors)) {
        if (!msg || typeof msg !== 'string') continue;
        const formKey = mapApiFieldToFormKey(apiKey);
        if (!mapped[formKey]) mapped[formKey] = msg;
      }
      const translated = translateFieldErrors(t, mapped);
      const cleaned: Record<string, string> = {};
      for (const [k, v] of Object.entries(translated)) {
        if (typeof v === 'string' && v) cleaned[k] = v;
      }
      setFieldErrors(cleaned);
      requestAnimationFrame(() => scrollToFirstFormError(cleaned));

      const firstField = Object.values(cleaned).find((m) => typeof m === 'string' && m);
      const rawTop =
        parsed.message ||
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as Error)?.message;
      const apiMessage = typeof rawTop === 'string' ? translateApiMessage(t, rawTop) : '';
      toast.error(
        (typeof firstField === 'string' && firstField) ||
          apiMessage ||
          t('projects:create.errors.createFailed'),
      );
    } finally { setSubmitting(false); }
  };

  const inputBase = "w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-sm font-bold text-slate-900 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 transition-all placeholder:text-slate-300 shadow-sm";
  const inputErr = (key: string) =>
    fieldErrors[key] ? 'border-red-500 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100/40' : '';
  const availableResults = memberResults.filter((u) => !selectedMembers.some((m) => m.id === u.id)).slice(0, 8);

  return (
    <div className="min-h-screen bg-white text-slate-600 font-sans pb-24 relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-5%] right-[-5%] w-[600px] h-[600px] bg-cyan-50/50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[500px] h-[500px] bg-indigo-50/40 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-12 relative z-10">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-cyan-600 transition-all mb-8"
          >
            <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center group-hover:border-cyan-200 group-hover:bg-cyan-50 transition-all shadow-sm">
              <ArrowLeft size={16} />
            </div>
            {t('projects:create.backToProjects')}
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-10">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-600 text-[10px] font-black uppercase tracking-[0.2em]">
                <Sparkles size={12} /> {t('projects:create.resourceCenter')}
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-none">
                {t('projects:create.title1')} <span className="text-cyan-600 italic">{t('projects:create.title2')}</span>
              </h1>
            </div>
            <div className="text-left md:text-right p-5 rounded-3xl bg-slate-50/80 border border-slate-100 backdrop-blur-md">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center md:justify-end gap-2">
                <Terminal size={12} /> {t('projects:create.systemSession')}
              </p>
              <p className="text-xs font-bold text-cyan-600 uppercase tracking-widest italic">{t('projects:create.stableConfig')}</p>
            </div>
          </div>
        </motion.header>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-8 space-y-8">
            <div className="bg-white border border-slate-100 rounded-[48px] p-8 md:p-10 shadow-xl shadow-slate-200/40 relative">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-cyan-600 flex items-center justify-center text-white shadow-lg shadow-cyan-200">
                  <Code size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">{t('projects:create.identityConfigTitle')}</h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('projects:create.identityConfigSubtitle')}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3" data-form-field="code">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('projects:create.fields.code')}</label>
                  <div className="relative">
                    <input
                      type="text" value={formData.code}
                      onChange={(e) => {
                        clearFieldError('code');
                        setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') });
                      }}
                      aria-invalid={!!fieldErrors.code}
                      className={`${inputBase} font-mono ${inputErr('code')} ${!fieldErrors.code && codeStatus === 'available' ? 'border-emerald-200 bg-emerald-50/20' : ''}`}
                      placeholder={t('projects:create.placeholders.codeExample')}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {codeStatus === 'checking' && <Loader2 size={18} className="animate-spin text-cyan-600" />}
                      {codeStatus === 'available' && !fieldErrors.code && <Check size={18} className="text-emerald-500" />}
                    </div>
                  </div>
                  <FieldErrorMsg text={fieldErrors.code} />
                </div>

                <div className="space-y-3" data-form-field="tag">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('projects:create.fields.tag')}</label>
                  <div className="relative">
                    <Tag size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                    <select
                      value={formData.tag}
                      onChange={(e) => {
                        clearFieldError('tag');
                        setFormData({ ...formData, tag: e.target.value as ProjectTag });
                      }}
                      aria-invalid={!!fieldErrors.tag}
                      className={`${inputBase} pl-12 appearance-none cursor-pointer ${inputErr('tag')}`}
                    >
                      <option value="">{t('projects:create.placeholders.chooseTag')}</option>
                      {PROJECT_TAG_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <FieldErrorMsg text={fieldErrors.tag} />
                </div>

                <div className="md:col-span-2 space-y-3" data-form-field="name">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('projects:create.fields.name')}</label>
                  <input
                    type="text" value={formData.name}
                    onChange={(e) => {
                      clearFieldError('name');
                      setFormData({ ...formData, name: e.target.value });
                    }}
                    aria-invalid={!!fieldErrors.name}
                    placeholder={t('projects:create.placeholders.name')}
                    className={`${inputBase} ${inputErr('name')}`}
                  />
                  <FieldErrorMsg text={fieldErrors.name} />
                </div>

                <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('projects:create.fields.description')}</label>
                  <textarea
                    rows={4} value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t('projects:create.placeholders.description')}
                    className={`${inputBase} resize-none font-medium h-32`}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[40px] p-8 shadow-lg shadow-slate-200/30">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-slate-900 text-white"><GitBranch size={20} /></div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">{t('projects:create.integrationTitle')}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{t('projects:create.integrationSubtitle')}</p>
                </div>
              </div>
              <div data-form-field="gitRepoUrl">
                <input
                  type="url" disabled={!isTruongLab}
                  value={formData.gitRepoUrl}
                  onChange={(e) => {
                    clearFieldError('gitRepoUrl');
                    setFormData({ ...formData, gitRepoUrl: e.target.value });
                  }}
                  aria-invalid={!!fieldErrors.gitRepoUrl}
                  placeholder={t('projects:create.placeholders.gitRepoUrl')}
                  className={`${inputBase} font-mono disabled:bg-slate-50 disabled:text-slate-400 ${inputErr('gitRepoUrl')}`}
                />
                <FieldErrorMsg text={fieldErrors.gitRepoUrl} />
              </div>
            </div>
          </motion.div>

          <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="xl:col-span-4 space-y-8">
            <div className="bg-white border border-slate-100 rounded-[48px] p-8 shadow-xl shadow-slate-200/40">

              <div className="space-y-4 mb-10">
                <div data-form-field="participationMode" className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 flex items-center gap-2">
                    <User size={14} /> {t('projects:create.participationMode.label')}
                  </label>
                  <div className={`grid grid-cols-2 gap-2 p-1.5 bg-slate-50 border rounded-2xl ${fieldErrors.participationMode ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      clearFieldError('participationMode');
                      setParticipationMode('tag');
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${participationMode === 'tag'
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {t('projects:create.participationMode.optionTag')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearFieldError('participationMode');
                      setParticipationMode('join');
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${participationMode === 'join'
                        ? 'bg-cyan-600 text-white shadow-md'
                        : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {t('projects:create.participationMode.optionJoin')}
                  </button>
                  </div>
                  <FieldErrorMsg text={fieldErrors.participationMode} />
                </div>
                {participationMode === 'tag' && (
                  <p className="text-[10px] font-medium text-slate-500 leading-relaxed">
                    {t('projects:create.participationMode.tagInviteHint')}
                  </p>
                )}

                {participationMode === 'join' && (
                  <div data-form-field="requiredMembers" className={`space-y-2 p-4 rounded-2xl bg-cyan-50/50 border ${fieldErrors.requiredMembers ? 'border-red-500 ring-2 ring-red-100' : 'border-cyan-100'}`}>
                    <label className="text-[10px] font-black uppercase tracking-widest text-cyan-700 block">{t('projects:create.requiredJoin.label')}</label>
                    <select
                      value={requiredMembers}
                      onChange={(e) => {
                        clearFieldError('requiredMembers');
                        setRequiredMembers(Number(e.target.value));
                      }}
                      aria-invalid={!!fieldErrors.requiredMembers}
                      className={`${inputBase} py-3 ${inputErr('requiredMembers')}`}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <option key={n} value={n}>{t('projects:create.requiredJoin.membersOption', { count: n })}</option>
                      ))}
                    </select>
                    <p className="text-[10px] font-bold text-cyan-700/70">
                      {t('projects:create.requiredJoin.hint')}
                    </p>
                    <FieldErrorMsg text={fieldErrors.requiredMembers} />
                  </div>
                )}

                {participationMode === 'tag' && (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input
                        type="text" value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder={t('projects:create.placeholders.memberSearch')}
                        className={`${inputBase} pl-12`}
                      />
                    </div>
                    {availableResults.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-md">
                        {availableResults.map((u) => {
                          const blocked = !!u.at_project_limit;
                          return (
                            <button
                              key={u.id}
                              type="button"
                              disabled={blocked}
                              onClick={() => addMember(u)}
                              className={`w-full p-3 text-left transition-all border-b border-slate-50 last:border-0 ${
                                blocked
                                  ? 'cursor-not-allowed bg-slate-50 opacity-75'
                                  : 'hover:bg-cyan-50'
                              }`}
                            >
                              <p className={`text-sm font-black ${blocked ? 'text-slate-500' : 'text-slate-900'}`}>
                                {u.full_name}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono italic">{u.email}</p>
                              {blocked && (
                                <p className="text-[9px] font-bold text-amber-600 mt-1 uppercase tracking-wide">
                                  Đã tham gia đủ số dự án — không thể mời
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="space-y-2" data-form-field="members">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {t('projects:create.taggedCount', { count: selectedMembers.length })}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedMembers.map((m) => (
                          <span key={m.id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-50 border border-cyan-100 text-cyan-700 text-[10px] font-black uppercase tracking-widest">
                            {m.full_name}
                            <button type="button" onClick={() => removeMember(m.id)} className="text-cyan-600/70 hover:text-red-500 transition-colors">
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <FieldErrorMsg text={fieldErrors.members} />
                    </div>
                    <div className="space-y-2 pt-2" data-form-field="leaderId">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">{t('projects:create.fields.leader')}</label>
                      <select
                        value={formData.leaderId}
                        onChange={(e) => {
                          clearFieldError('leaderId');
                          setFormData({ ...formData, leaderId: e.target.value });
                        }}
                        aria-invalid={!!fieldErrors.leaderId}
                        className={`${inputBase} appearance-none cursor-pointer ${inputErr('leaderId')}`}
                      >
                        <option value="">{t('projects:create.placeholders.chooseLeader')}</option>
                        {selectedMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name} ({m.email})
                          </option>
                        ))}
                      </select>
                      <FieldErrorMsg text={fieldErrors.leaderId} />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4 pt-8 border-t border-slate-50">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 flex items-center gap-2 mb-4">
                  <Calendar size={14} /> {t('projects:create.timeline.label')}
                </label>
                <div className="space-y-3">
                  <div data-form-field="startDate" className={`bg-slate-50/50 p-2 rounded-2xl border flex items-center group transition-all ${fieldErrors.startDate ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-100 focus-within:border-cyan-200'} focus-within:bg-white`}>
                    <span className="w-12 text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">{t('projects:create.timeline.start')}</span>
                    <input
                      type="date"
                      min={today}
                      value={formData.startDate}
                      onChange={(e) => {
                        clearFieldError('startDate');
                        setFormData({ ...formData, startDate: e.target.value });
                      }}
                      aria-invalid={!!fieldErrors.startDate}
                      className="flex-1 bg-transparent px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <FieldErrorMsg text={fieldErrors.startDate} />
                  <div data-form-field="endDate" className={`bg-slate-50/50 p-2 rounded-2xl border flex items-center group transition-all ${fieldErrors.endDate ? 'border-red-500 ring-2 ring-red-100' : 'border-slate-100 focus-within:border-cyan-200'} focus-within:bg-white`}>
                    <span className="w-12 text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">{t('projects:create.timeline.end')}</span>
                    <input
                      type="date"
                      min={formData.startDate || today}
                      value={formData.endDate}
                      onChange={(e) => {
                        clearFieldError('endDate');
                        setFormData({ ...formData, endDate: e.target.value });
                      }}
                      aria-invalid={!!fieldErrors.endDate}
                      className="flex-1 bg-transparent px-4 py-2 text-sm font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <FieldErrorMsg text={fieldErrors.endDate} />
                </div>
                {getDurationText(formData.startDate, formData.endDate) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-cyan-50 rounded-xl border border-cyan-100">
                    <Clock size={12} className="text-cyan-500 shrink-0" />
                    <span className="text-[11px] font-bold text-cyan-600">
                      Thời gian thực hiện:&nbsp;
                    </span>
                    <span className="text-[11px] font-black text-cyan-800">
                      {getDurationText(formData.startDate, formData.endDate)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-8 border-t border-slate-50">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 flex items-center gap-2 mb-4">
                  <DollarSign size={14} /> {t('projects:BUDGET')}
                </label>
                <div className="relative" data-form-field="budget">
                  <input
                    type="text"
                    value={formatVND(Number(formData.budget))}
                    onChange={(e) => {
                      clearFieldError('budget');
                      setFormData({ ...formData, budget: parseVND(e.target.value) });
                    }}
                    aria-invalid={!!fieldErrors.budget}
                    placeholder="Nhập ngân sách dự kiến"
                    className={`${inputBase} pr-14 ${inputErr('budget')}`}
                  />
                  <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">VND</span>
                </div>
                <FieldErrorMsg text={fieldErrors.budget} />
              </div>

                
              <div className="space-y-4 pt-8 border-t border-slate-50">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 flex items-center gap-2 mb-4">
                  <FileText size={14} /> MÔ HÌNH CAM KẾT
                </label>

                <div className="space-y-3" data-form-field="modelType">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Mô hình hợp tác *</label>
                  <select
                    value={formData.modelType}
                    onChange={handleModelChange}
                    aria-invalid={!!fieldErrors.modelType}
                    className={`${inputBase} appearance-none cursor-pointer py-3 ${inputErr('modelType')}`}
                  >
                    <option value="MODEL_1">Mô hình 1: Giảng viên làm chính – Sinh viên học việc (65-70/30-35)</option>
                    <option value="MODEL_2">Mô hình 2: Đồng tác giả thực chất (50-60/40-50)</option>
                    <option value="MODEL_3">Mô hình 3: Sinh viên làm chính – Giảng viên bảo trợ học thuật (40-50/50-60)</option>
                  </select>
                  <FieldErrorMsg text={fieldErrors.modelType} />
                </div>

                <div data-form-field="partyA_percent" className={`p-4 bg-cyan-50/50 border rounded-2xl ${fieldErrors.partyA_percent || percentError ? 'border-red-400 ring-2 ring-red-100' : 'border-cyan-100'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-cyan-800">Quỹ Quản lý (Bên A):</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={percentA}
                        onChange={handlePercentChange}
                        aria-invalid={!!(percentError || fieldErrors.partyA_percent)}
                        className={`w-16 p-1 text-xs text-right font-black ${percentError || fieldErrors.partyA_percent ? 'text-red-500 border-red-300' : 'text-cyan-600 border-cyan-200'} bg-white border rounded focus:outline-none focus:ring-1 focus:ring-cyan-500`}
                      />
                      <span className="text-xs font-black text-cyan-600">%</span>
                    </div>
                  </div>
                  {(percentError || fieldErrors.partyA_percent) && (
                    <div className="text-[10px] text-red-500 font-bold mb-2 text-right italic">
                      {percentError || fieldErrors.partyA_percent}
                    </div>
                  )}
              
                  <div data-form-field="partyB_percent" className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-cyan-800">Quỹ Thực thi (Bên B):</span>
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        value={100 - percentA}
                        readOnly
                        className="w-16 p-1 text-xs text-right font-black text-gray-500 bg-gray-100 border border-gray-200 rounded focus:outline-none"
                      />
                      <span className="text-xs font-black text-gray-500">%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mt-4" data-form-field="partyAId">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Đại diện pháp lý (Bên A) *</label>
                  <select
                    value={formData.partyAId}
                    onChange={(e) => {
                      clearFieldError('partyAId');
                      setFormData({ ...formData, partyAId: e.target.value });
                    }}
                    aria-invalid={!!fieldErrors.partyAId}
                    className={`${inputBase} appearance-none cursor-pointer py-3 ${inputErr('partyAId')}`}
                  >
                    <option value="">-- Chọn Viện trưởng ký duyệt --</option>
                    {partyAOptions.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.system_role === 'vien_truong' ? 'Viện trưởng' : 'Trưởng Lab'})
                      </option>
                    ))}
                  </select>
                  <FieldErrorMsg text={fieldErrors.partyAId} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 rounded-[32px] bg-cyan-50/30 border border-cyan-100">
                <ShieldCheck size={20} className="text-cyan-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-cyan-800/60 font-bold leading-relaxed italic">
                  {t('projects:create.policyNotice')}
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting || codeStatus === 'taken' || !!percentError}
                className={`w-full h-16 rounded-[32px] text-[11px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 group
                  ${(submitting || codeStatus === 'taken' || !!percentError)
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70'
                    : 'bg-slate-900 text-white hover:bg-cyan-600 hover:shadow-xl hover:shadow-cyan-100 hover:-translate-y-1'
                  }
                `}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : (
                  <>
                    <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                    CREATE & SEND COMMITMENTS
                  </>
                )}
              </button>
            </div>
          </motion.aside>
        </form>
      </div>
    </div>
  );
};

export default CreateProject;