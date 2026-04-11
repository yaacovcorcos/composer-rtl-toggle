# Chrome Web Store Prep

## Suggested Name
Composer RTL Toggle

## Category
Productivity

## Short Description
Add a clean RTL/LTR toggle to the composer on ChatGPT, Gemini, and Claude, with support for Hebrew, Arabic, Persian, and other right-to-left writing.

## Detailed Description
Composer RTL Toggle adds a small, minimalist direction toggle directly inside the prompt composer on supported AI chat sites.

With one click, you can switch the active composer between left-to-right and right-to-left writing without changing the rest of the page layout.

It is especially useful for Hebrew, Arabic, Persian, and other right-to-left writing.

Supported sites:

- ChatGPT
- Gemini
- Claude

What it does:

- Adds a compact toggle next to the existing composer controls
- Switches the active composer between LTR and RTL
- Keeps the button footprint stable so the composer does not jump
- Remembers your preferred direction per supported site
- Matches the surrounding UI with a lightweight native-feeling design

What it does not do:

- It does not collect your prompts
- It does not send data to a server
- It does not inject ads or unrelated UI

This extension is designed to stay minimal and focused on one job: making RTL writing inside supported AI composer boxes feel natural and convenient.

## Single Purpose
Adds an RTL/LTR direction toggle to the prompt composer on supported AI chat websites.

## Permissions Justification
`storage`

Used only to remember the selected writing direction (`LTR` or `RTL`) separately for each supported site.

## Remote Code Declaration
No, this extension does not use remote code.

## Data Usage
This extension does not collect, transmit, sell, or share personal or sensitive user data.

It stores only a local preference in Chrome storage:

- selected direction mode per supported site

## Recommended Store Assets
- `store/assets/promo-small-440x280.png`
- `store/assets/screenshots/chatgpt-1280x800.png`
- `store/assets/screenshots/gemini-1280x800.png`

## Optional Test Instructions
No special credentials or setup are required for basic review.

Reviewer steps:

1. Open ChatGPT or Gemini.
2. Locate the composer at the bottom of the page.
3. Verify a small toggle icon appears next to the native composer controls.
4. Click the toggle.
5. Confirm the composer switches between LTR and RTL.
6. Confirm the page layout does not shift unexpectedly.
