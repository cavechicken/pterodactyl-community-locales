<?php

namespace Pterodactyl\Http\Requests\Base;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LocaleRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'locale' => ['required', 'string', Rule::in(['en', 'de', 'swg', 'bar'])],
            'namespace' => ['required', 'string', 'regex:/^[a-z]{1,191}$/'],
        ];
    }
}
