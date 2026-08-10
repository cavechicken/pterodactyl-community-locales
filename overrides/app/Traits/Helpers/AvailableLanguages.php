<?php

namespace Pterodactyl\Traits\Helpers;

use Matriphe\ISO639\ISO639;
use Illuminate\Filesystem\Filesystem;

trait AvailableLanguages
{
    private ?ISO639 $iso639 = null;

    private ?Filesystem $filesystem = null;

    /**
     * Locale names which cannot be resolved by the upstream two-letter ISO
     * helper. The keys are valid ISO 639-3 codes and fit the existing users
     * table language column.
     */
    private const CUSTOM_LANGUAGE_NAMES = [
        'swg' => ['english' => 'Swabian', 'native' => 'Schwäbisch'],
        'bar' => ['english' => 'Bavarian', 'native' => 'Bayrisch'],
    ];

    /**
     * Return all languages for which the Panel has a resource directory.
     */
    public function getAvailableLanguages(bool $localize = false): array
    {
        return collect($this->getFilesystemInstance()->directories(resource_path('lang')))->mapWithKeys(function ($path) use ($localize) {
            $code = basename($path);

            if (isset(self::CUSTOM_LANGUAGE_NAMES[$code])) {
                $name = self::CUSTOM_LANGUAGE_NAMES[$code][$localize ? 'native' : 'english'];

                return [$code => $name];
            }

            $value = $localize ? $this->getIsoInstance()->nativeByCode1($code) : $this->getIsoInstance()->languageByCode1($code);

            return [$code => title_case($value)];
        })->toArray();
    }

    private function getFilesystemInstance(): Filesystem
    {
        return $this->filesystem = $this->filesystem ?: app()->make(Filesystem::class);
    }

    private function getIsoInstance(): ISO639
    {
        return $this->iso639 = $this->iso639 ?: app()->make(ISO639::class);
    }
}
