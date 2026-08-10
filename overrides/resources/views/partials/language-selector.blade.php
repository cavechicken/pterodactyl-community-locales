@auth
    @php
        $pteroI18nLanguages = __PTERO_I18N_LANGUAGE_SELECTOR__;
        $pteroI18nCurrentLanguage = $pteroI18nLanguages[Auth::user()->language] ?? $pteroI18nLanguages['en'];
    @endphp

    <details class="ptero-i18n-language-menu">
        <summary aria-label="{{ __('frontend.language') }}">
            <span class="ptero-i18n-language-flag ptero-i18n-language-flag--{{ Auth::user()->language }}" aria-hidden="true">
                {{ $pteroI18nCurrentLanguage['short'] }}
            </span>
            <span class="ptero-i18n-language-current">{{ $pteroI18nCurrentLanguage['name'] }}</span>
            <span class="ptero-i18n-language-chevron" aria-hidden="true"></span>
        </summary>

        <div class="ptero-i18n-language-popover" role="group" aria-label="{{ __('frontend.language') }}">
            <header>
                <strong>{{ __('frontend.chooseLanguage') }}</strong>
                <span>{{ __('frontend.chooseLanguageDescription') }}</span>
            </header>

            <div class="ptero-i18n-language-options">
                @foreach($pteroI18nLanguages as $code => $language)
                    <form method="POST" action="{{ route('account.language') }}">
                        @csrf
                        <input type="hidden" name="language" value="{{ $code }}">
                        <button type="submit" @if(Auth::user()->language === $code) aria-current="true" @endif>
                            <span class="ptero-i18n-language-flag ptero-i18n-language-flag--{{ $code }}" aria-hidden="true">
                                {{ $language['short'] }}
                            </span>
                            <span class="ptero-i18n-language-copy">
                                <strong>{{ $language['name'] }}</strong>
                                <small>{{ $language['description'] }}</small>
                            </span>
                            @if(Auth::user()->language === $code)
                                <span class="ptero-i18n-language-check" aria-label="{{ __('frontend.activeLanguage') }}">✓</span>
                            @endif
                        </button>
                    </form>
                @endforeach
            </div>
        </div>
    </details>
@endauth
