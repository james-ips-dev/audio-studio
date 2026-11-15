import { createContext, useContext } from 'react';

export type Language = 'en' | 'ja';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key, fallback) => fallback ?? key,
});

export const useTranslation = (): LanguageContextType => {
  return useContext(LanguageContext);
};
