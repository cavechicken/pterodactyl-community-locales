<?php

namespace Pterodactyl\Http\Controllers\Base;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Traits\Helpers\AvailableLanguages;

class LanguageController extends Controller
{
    use AvailableLanguages;

    public function __invoke(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'language' => ['required', 'string', Rule::in(array_keys($this->getAvailableLanguages()))],
        ]);

        $user = $request->user();
        $previous = $user->language;

        if ($previous !== $validated['language']) {
            $user->forceFill(['language' => $validated['language']])->save();

            Activity::event('user:account.language-changed')
                ->property(['old' => $previous, 'new' => $validated['language']])
                ->log();
        }

        return redirect()->back();
    }
}
