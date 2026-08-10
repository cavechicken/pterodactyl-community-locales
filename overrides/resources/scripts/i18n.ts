import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import I18NextHttpBackend, { HttpBackendOptions } from 'i18next-http-backend';
import I18NextMultiloadBackendAdapter from 'i18next-multiload-backend-adapter';

type SupportedLocale = __PTERO_I18N_SUPPORTED_LOCALE_TYPE__;

interface LocalizedWindow extends Window {
    PterodactylUser?: { language?: string };
    PterodactylLocale?: Record<string, unknown>;
    SiteConfiguration?: { locale?: string };
}

const supportedLocales: ReadonlyArray<SupportedLocale> = __PTERO_I18N_SUPPORTED_LOCALES__;

function supportedLocale(value: unknown): SupportedLocale | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase().replace('_', '-');
    if (supportedLocales.includes(normalized as SupportedLocale)) return normalized as SupportedLocale;
    const base = normalized.split('-')[0];
    return supportedLocales.includes(base as SupportedLocale) ? (base as SupportedLocale) : null;
}

function initialLocale(): SupportedLocale {
    const localizedWindow = window as LocalizedWindow;
    return (
        supportedLocale(localizedWindow.PterodactylUser?.language) ||
        supportedLocale(localizedWindow.SiteConfiguration?.locale) ||
        __PTERO_I18N_DEFAULT_LOCALE__
    );
}

// If we're using HMR use a unique hash per page reload so that we're always
// doing cache busting. Otherwise use the builder-provided hash.
const hash = module.hot ? Date.now().toString(16) : process.env.WEBPACK_BUILD_HASH;
const locale = initialLocale();
const localizedWindow = window as LocalizedWindow;

document.documentElement.lang = locale;

i18n.use(I18NextMultiloadBackendAdapter)
    .use(initReactI18next)
    .init({
        debug: process.env.DEBUG === 'true',
        lng: locale,
        // Most translated strings are invoked directly from catalogued source
        // expressions. Supplying the authenticated user's frontend catalog in
        // the initial HTML makes initialization synchronous, so the first
        // React render cannot freeze the English defaultValue before the HTTP
        // backend finishes loading.
        initImmediate: false,
        resources: {
            [locale]: {
                frontend: localizedWindow.PterodactylLocale || {},
            },
        },
        ns: ['frontend'],
        defaultNS: 'frontend',
        partialBundledLanguages: true,
        supportedLngs: [...supportedLocales],
        nonExplicitSupportedLngs: true,
        fallbackLng: __PTERO_I18N_FALLBACKS__,
        keySeparator: '.',
        backend: {
            backend: I18NextHttpBackend,
            backendOption: {
                loadPath: '/locales/locale.json?locale={{lng}}&namespace={{ns}}',
                queryStringParams: { hash },
                allowMultiLoading: true,
            } as HttpBackendOptions,
        } as Record<string, any>,
        interpolation: {
            // React escapes interpolated values. Do not disable that boundary
            // in translation strings by introducing raw HTML rendering.
            escapeValue: false,
        },
    });

export default i18n;
