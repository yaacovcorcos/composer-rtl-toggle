# Composer RTL Toggle

Minimal Chrome extension that adds a small `RTL` / `LTR` toggle inside the composer on:

- `chatgpt.com`
- `gemini.google.com`
- `claude.ai`

The toggle is injected next to the composer action controls and remembers the direction per site using `chrome.storage.local`.

## Install

1. Open Chrome and go to `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select the downloaded or cloned extension folder.

## What It Does

- Adds one compact button inside the composer action row.
- Keeps the button footprint fixed so the layout does not jump when toggled.
- Switches the active composer between `LTR` and `RTL`.
- Reapplies direction when the site rerenders the composer.

## Support

For bug reports, feature requests, or support questions:

- Open a new issue: [github.com/yaacovcorcos/composer-rtl-toggle/issues/new](https://github.com/yaacovcorcos/composer-rtl-toggle/issues/new)
- View existing issues: [github.com/yaacovcorcos/composer-rtl-toggle/issues](https://github.com/yaacovcorcos/composer-rtl-toggle/issues)

For direct contact:

- Email: [coryacos1@gmail.com](mailto:coryacos1@gmail.com)
