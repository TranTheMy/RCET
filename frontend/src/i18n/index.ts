import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import viCommon from './locales/vi/common.json';
import enCommon from './locales/en/common.json';
import viAuth from './locales/vi/auth.json';
import enAuth from './locales/en/auth.json';
import viVerilog from './locales/vi/verilog.json';
import enVerilog from './locales/en/verilog.json';
import viDocuments from './locales/vi/documents.json';
import enDocuments from './locales/en/documents.json';
import viProjects from './locales/vi/projects.json';
import enProjects from './locales/en/projects.json';
import viAdmin from './locales/vi/admin.json';
import enAdmin from './locales/en/admin.json';
import viHome from './locales/vi/home.json';
import enHome from './locales/en/home.json';
import viCurriculum from './locales/vi/curriculum.json';
import enCurriculum from './locales/en/curriculum.json';
import viResearch from './locales/vi/research.json';
import enResearch from './locales/en/research.json';
import viUser from './locales/vi/user.json';
import enUser from './locales/en/user.json';

const STORAGE_KEY = 'vkslab_lang';

function detectInitialLanguage(): 'vi' | 'en' {
  const stored = (localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
  if (stored === 'vi' || stored === 'en') return stored;
  return 'vi';
}

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        vi: {
          common: viCommon,
          auth: viAuth,
          verilog: viVerilog,
          documents: viDocuments,
          projects: viProjects,
          admin: viAdmin,
          home: viHome,
          curriculum: viCurriculum,
          research: viResearch,
          user: viUser,
        },
        en: {
          common: enCommon,
          auth: enAuth,
          verilog: enVerilog,
          documents: enDocuments,
          projects: enProjects,
          admin: enAdmin,
          home: enHome,
          curriculum: enCurriculum,
          research: enResearch,
          user: enUser,
        },
      },
      lng: detectInitialLanguage(),
      fallbackLng: 'vi',
      defaultNS: 'common',
      ns: ['common', 'auth', 'verilog', 'documents', 'projects', 'admin', 'home', 'curriculum', 'research', 'user'],
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      returnNull: false,
    })
    .catch(() => {});

  i18n.on('languageChanged', (lng) => {
    if (lng === 'vi' || lng === 'en') localStorage.setItem(STORAGE_KEY, lng);
  });
}

export default i18n;

