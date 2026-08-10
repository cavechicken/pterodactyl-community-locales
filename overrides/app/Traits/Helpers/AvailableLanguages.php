<?php

namespace Pterodactyl\Traits\Helpers;

trait AvailableLanguages
{
    private const SUPPORTED_LANGUAGE_NAMES = __PTERO_I18N_LANGUAGE_NAMES__;

    /**
     * Return only the locales declared by the reviewed localization manifest.
     */
    public function getAvailableLanguages(bool $localize = false): array
    {
        return collect(self::SUPPORTED_LANGUAGE_NAMES)->mapWithKeys(function ($names, $code) use ($localize) {
            return [$code => $names[$localize ? 'native' : 'english']];
        })->toArray();
    }
}
