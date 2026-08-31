# SmartBudget — Phase 1 Visual Redesign Report

**Scope:** design system, light theme, dark theme, shared UI primitives, application shell, and the
authentication experience (Login, Signup, Forgot Password, AuthShell).
**Not touched:** Dashboard, Expenses, Budgets, Notifications page content — held for Phase 2 pending
your approval.

Phase 1 is complete and stopped here. Nothing in Phase 2 has been started.

---

## 1. Files modified

Eleven files were modified. No file was created, deleted, renamed or moved (this report is the only
new file, and it is documentation only — delete it freely). No dependency was added or removed:
`package.json` and `package-lock.json` carry their original timestamps, `dependencies` is still 11
entries and `devDependencies` still 8.

Modification times prove the scope lock. Every file outside the list below still carries the original
checkout timestamp of `15:12:53`, including all of `src/services/**`, `src/utils/axios.js`, all three
contexts (`AuthContext`, `NotificationContext`, `ThemeContext`), `App.jsx`, `main.jsx`,
`ProfileUtilityModals.jsx`, `NotificationItem.jsx`, and the four Phase-2 pages. Outside `src/`, only
`tailwind.config.js` changed — `vite.config.js` (including the dev proxy), `postcss.config.js`,
`index.html`, `jsconfig.json` and `.oxlintrc.json` are untouched.

| File | Visual change (presentation only) |
| --- | --- |
| `src/index.css` | Rewritten as the authoritative token foundation. New light and dark palettes, cool-navy shadow ramp, `--shadow-control` inset, system-first font stacks, tabular numerals on `body`, display-font + negative-tracking heading rule, `::selection` colour, and a global `:focus-visible` ring. Every original token **name** was preserved because several are read directly from JSX as `color="var(--…)"`. The `prefers-reduced-motion` block is byte-identical to the original. |
| `src/App.css` | Rewritten **unlayered**, exactly as the original was, with a header comment documenting the cascade. Four real conflicts resolved: the duplicate `--radius-*` block was removed (its 4/8/12/16px was silently replacing the design system's 8/10/14/16px); `--font-family-base` / `--font-family-mono` now delegate to the `index.css` stacks; the `.app-shell, .app-shell *` font-family rule was removed because a universal selector inside the shell tied with and defeated `font-mono` on tabular figures; `.primary-action` was re-pointed at `--accent-solid` so it agrees with the `bg-accent-solid` utility it is paired with. All 23 element-level selectors are preserved verbatim and unscoped, including `button:disabled { opacity: 0.6 }` and every legacy `.navbar` / `.card` / `.budget-card` rule. |
| `tailwind.config.js` | Additive only: `borderRadius.pill`, `boxShadow.control`, a `letterSpacing` scale (`display` / `heading` / `label` — new keys only, so Tailwind's own `tracking-tight`/`tighter` values are unchanged), and `fontFamily` re-pointed at the three CSS font stacks. `colors`, `spacing`, `transitionDuration`, `transitionTimingFunction`, `darkMode`, `content` and `plugins` are unchanged. |
| `src/components/ui/button.jsx` | Class strings only. Base gained an explicit transition list, `duration-fast ease-standard`, and a `focus-visible` ring offset against the canvas. `default` and `destructive` now use `bg-accent-solid` / `bg-error` with `text-text-on-accent` and `shadow-sm`. `outline` and `secondary` gained `border-solid` (see §6 — this is a bug fix, not decoration). All four **size** strings are byte-identical to the originals, so no button changes dimensions. |
| `src/components/ui/input.jsx` | One class string: token-driven border and surface, `shadow-control` inset, `hover:border-primary/40`, and a `focus-visible` border + ring. Height, padding and the `file:` / `placeholder:` / `disabled:` handling are unchanged. |
| `src/components/TiltCard.jsx` | One line: the hover sheen overlay changed from `rounded-2xl` to `rounded-[inherit]` so it follows the container's radius now that cards are 14px. All motion values, springs and pointer handlers untouched. |
| `src/components/SidebarLayout.jsx` | Restyled in place. Brand block `h-20` → `h-16` so the sidebar divider aligns with the 64px header divider; logo tile is a solid accent chip in light mode and a tinted ring in dark; active nav item moved from `bg-muted text-primary` to `bg-primary/[0.10] font-semibold text-primary`; sidebar user card gained a border; sidebar width `w-60` → `w-64` **with** its `lg:pl-60` → `lg:pl-64` offset changed in the same pass; mobile drawer gained `shadow-xl`; both dropdown panels moved to `rounded-xl shadow-xl`; the bell and profile triggers gained `border-solid` and `shadow-control`; `focus-visible` rings added throughout; uppercase micro-labels moved to the `tracking-label` token. |
| `src/components/AuthShell.jsx` | Two `aria-hidden` decorative blur washes inside the already-`overflow-hidden` marketing panel, with `relative z-10` on the logo row and footer so nothing is occluded. Headline gained `font-display`, `tracking-display` and `text-balance`; sub-copy gained `text-pretty`. The stacked "paper" sheets behind the preview card moved from translucent elevated to `bg-muted/55` / `bg-muted/80`, and the preview card itself from `bg-canvas/85` to opaque `bg-canvas`. |
| `src/pages/Login.jsx` | Heading moved to the display font and `tracking-heading`; password-visibility toggle gained `p-0`. Nothing else. |
| `src/pages/Signup.jsx` | Both headings to display font + `tracking-heading`; terms checkbox row gained a hover treatment; the back button, resend button and password toggle gained `p-0`, a radius and a `focus-visible` ring. No opacity utility was added to the resend button, so `button:disabled { opacity: 0.6 }` still governs its disabled look exactly as before. |
| `src/pages/ForgotPassword.jsx` | All four phase headings to display font + `tracking-heading` (the success heading keeps its `mt-6`); the three back links/buttons unified on one class string with a focus ring; both password toggles and the resend button gained `p-0`, a radius and a focus ring. |

---

## 2. Functionality preservation

**Confirmed: no functional code was changed.** Only `className` strings, Tailwind utilities, CSS
rules, and `aria-hidden` decorative wrappers were edited. Specifically unchanged across all eleven
files: every function and function signature, every event handler, `onClick` / `onSubmit` /
`onChange` / `onKeyDown` behaviour, all `useState` / `useEffect` / `useMemo` / `useCallback` /
`useRef` logic, all Context behaviour, authentication logic, notification logic, API calls, Axios
behaviour, async logic, navigation calls, route paths, validation rules, FormData field names and
keys, timers and intervals, retry behaviour, calculations, data transformations, response handling,
loading and error control flow, component props contracts, localStorage behaviour, theme persistence,
and business logic.

This was machine-verified rather than asserted. A 66-point assertion suite checks that each specific
behaviour the brief named is still present verbatim in the source — **66 of 66 pass**:

- **Login (18 checks):** `new FormData(event.currentTarget)`, the `email` and `password` FormData
  keys, `name="email"` / `name="password"` on the inputs, trim-and-lowercase on the submitted email,
  the raw-string read of the password, the `authService.login` call, the
  `response.user || { name, email }` fallback, `navigate('/dashboard')`, the 401-vs-generic error
  branch, `setPassword('')` on failure, the `finally` loading reset, the prefilled email from a reset
  redirect, and the success-banner source.
- **Signup (19 checks):** terms gating before the request, the signup call, response-driven email
  normalisation and cooldown seeding, the step advance to `otp`, OTP verification, `login(token, user)`,
  `navigate('/dashboard')`, the resend guard, the `retry-after` header handling, the cooldown interval
  and its cleanup, OTP sanitisation, the `returnToDetails` resets, the checkbox binding, `required` on
  the checkbox, and both `disabled` rules.
- **Forgot Password (22 checks):** all four phases, the three `authService` calls, both validation
  rules, the 400-status rewind with its full state reset, the 1800ms success delay, the exact
  `navigate('/login', …)` payload, timeout cleanup, the complete `changeEmail()` reset, the resend
  guard, the inline "use a different code" reset, OTP sanitisation, the cooldown interval, and the
  `GENERIC_STATUS` constant.
- **AuthShell (7 checks):** props signature, `{children}`, the `mode` branch, both legal links, the
  `TiltCard` prop, and `aria-hidden` on the new decorative layers.

`SidebarLayout.jsx` was verified separately by stripping all `className` attributes and confirming the
remainder is identical to the original — its `navItems` array, the absence of Notifications from the
sidebar, dropdown behaviour, the `slice(0, 5)` preview, profile actions, theme toggle, logout,
outside-click listener, mobile drawer behaviour and routing are all as they were. No navigation item
was added.

### Visual ideas rejected because they would have changed behaviour

- **Escape-to-close, focus trapping, focus return, and body scroll locking** on the notification and
  profile dropdowns and the profile modals. These are the most valuable accessibility improvements
  available, and all of them require new keyboard and lifecycle logic, so they were left out per the
  brief's Phase-1 behavioural-accessibility exclusion. Recommended as an explicit follow-up.
- **`gap-2` on the Button base class.** It would have double-spaced every existing
  `<Plus className="mr-2" />` icon, changing Phase-2 layout. Left out; the existing per-icon margins
  still own spacing.
- **`active:translate-y-*` press feedback on Button.** It would fight the `hover:-translate-y-0.5`
  already applied to some Phase-2 buttons. Left out.
- **Scoping App.css's element rules with `:not([class])`.** This looked like a clean way to stop
  legacy element styles reaching modern components, but it would have stripped legacy
  `margin-bottom` from classed Phase-2 headings and legacy padding/radius/weight from classed
  Phase-2 buttons — an out-of-scope layout shift. The rules were left unscoped and verbatim.
- **Raising the border tokens to WCAG 1.4.11's 3:1.** See §5.
- **A dismissal-on-action-select refinement for the profile menu.** Behavioural, so out of scope.

---

## 3. Light theme

Crisp and layered rather than flat white. The canvas is a faintly cool tinted navy-grey
(`rgb(239 243 249)`) so that pure-white cards read as genuinely raised without depending on shadow
alone; `--bg-muted` sits just below the canvas as a recessed well for inputs, tab tracks and
avatars. Text runs `#101828` / `#475467` / `#586576`. The accent is a deep teal-blue: `#056B8D`
whenever the accent is used as text or an icon, with `#087EA4` retained as a fill-only variant so
solid accent surfaces stay vivid while their labels still clear 4.5:1. Shadows are cool
(`rgb(16 33 66 / …)`) rather than neutral black. Beige, cream, washed-out grey, pale text and
invisible card boundaries were all avoided.

## 4. Dark theme

Deep layered navy, not black, and not uniformly cyan. Four distinct surface levels —
canvas `#07111F`, surface `#0F1D31`, elevated `#13233A`, and a deliberately *recessed*
`#0A1628` well that sits below the surface — so elevation reads structurally rather than through
glow. The accent is a restrained cyan (`#22C7E8` for text and icons, `#14B8D8` for fills), used on
active nav state, links, focus rings and the single highlighted progress bar rather than on every
border and icon. The decisive fix is `--text-on-accent: rgb(7 17 31)`: labels and icons on bright
accent and status fills are deep navy ink, not white, which is both correct for contrast and the
reason the dark theme reads as premium rather than neon. Chart hues align to each category's badge
colour in both themes.

Elevation is expressed as four levels (canvas → cards → interactive-elevated → dropdowns, modals and
floating layers) through background, border and shadow together. Radii are tokenised at 8 / 10 / 14 /
16px plus a pill, with no scattered arbitrary values. Typography is a deliberate system-first stack
with a separate display family for headings and tabular lining numerals globally for financial
figures — no Google Fonts, no `@font-face`, no font package, and no network font dependency anywhere.

The token system is complete and symmetric: 52 properties in `:root`, 38 of them overridden in
`.dark`, 14 intentionally theme-invariant (font stacks, radii, motion durations, easings), zero
dark-only tokens, and zero redundant overrides. Theme switching remains entirely the existing
`ThemeContext` mechanism — its toggle logic, localStorage behaviour, `.dark` application and
persistence were not touched.

---

## 5. Contrast verification

Relative luminance was computed programmatically from the shipped token values. **22 of 22 pairs pass
in both themes, with zero failures** — including every case the brief called out: primary auth
buttons, text on accent fills, the sidebar logo and accent, error icon colours, status colours, and
secondary/muted text.

| Pair | Light | Dark | Needs |
| --- | --- | --- | --- |
| Body text on canvas / surface | 15.94 / 17.75 | 17.78 / 15.90 | 4.5 |
| Secondary text on surface | 7.69 | 9.68 | 4.5 |
| Muted text on surface / on muted well | 5.94 / 5.09 | 5.42 / 5.80 | 4.5 |
| Accent as link text on surface / canvas | 6.01 / 5.40 | 8.39 / 9.38 | 4.5 |
| Label on primary button | 6.01 | 9.38 | 4.5 |
| Label on accent-solid fill | 4.64 | 8.00 | 4.5 |
| Icon on accent fill | 4.64 | 8.00 | 3.0 |
| Success / warning / error / info text on surface | 6.87 / 5.56 / 5.61 / 5.62 | 8.94 / 9.57 / 5.47 / 8.70 | 4.5 |
| Secondary accent on surface | 5.59 | 5.73 | 4.5 |
| Status text inside its own `/10` tinted alert box | 4.82–5.90 | 4.87–7.96 | 4.5 |
| Active nav label on `primary/10` | 5.19 | 6.96 | 4.5 |
| Focus ring vs canvas / surface | 5.40 / 6.01 | 9.38 / 8.39 | 3.0 |

### One deliberate, documented deviation

The border tokens do not meet WCAG 1.4.11's 3:1 for non-text UI boundaries: light `--border-subtle`
is 1.21:1 and `--border-strong` 1.68:1 on white; dark equivalents are 1.27:1 and 1.66:1 on surface.
Compliant values (light would need roughly `#6F7F99`) read heavy and dated, contradict the brief's
own border hexes, and would undercut the "crisp, expensive, spacious" direction. Borders were not in
the brief's enumerated contrast-fix list — all of which are fixed. Compensating measures shipped
instead: a tinted canvas so white cards separate by luminance rather than by outline, the
`--shadow-control` inset on inputs and the bell button, `hover:border-primary/40` on interactive
bordered surfaces, and a 2px `focus-visible` ring that does clear 3:1. Raising the tokens is a
one-line change in `index.css` if you would rather have strict compliance than the current look.

---

## 6. Verification performed

### Passed in this environment

- **CSS build, real plugin chain.** Both stylesheets were processed through the project's actual
  `postcss.config.js` chain (`tailwindcss` → `autoprefixer`) — this is the CSS half of `vite build`.
  `index.css` → 58,001 bytes, **0 warnings**. `App.css` → 12,650 bytes, **0 warnings**.
- **A real build error was caught and fixed this way.** An earlier draft of `App.css` wrapped its
  rules in `@layer base`, which is a hard failure —
  `` `@layer base` is used but no matching `@tailwind base` directive is present `` — because Tailwind
  v3's `@layer` is a *Tailwind* directive, not a CSS cascade layer, and `App.css` has no
  `@tailwind base`. `App.css` is now unlayered like the original; the three `@layer` mentions still in
  the file are inside the explanatory header comment and compile to nothing.
- **Utility generation.** 347 class tokens were harvested from the modified files and checked against
  the compiled stylesheet. Every Tailwind-recognised token generates, including all the new ones
  (`tracking-display`, `tracking-heading`, `tracking-label`, `font-display`, `shadow-control`,
  `border-solid`, `bg-primary/[0.10]`, `bg-primary/[0.06]`, `bg-secondary/[0.05]`, `lg:pl-64`,
  `focus-visible:ring-inset`, and the comma-bearing arbitraries such as
  `w-[min(23.75rem,calc(100vw-2rem))]`). All five `dark:` variants on the sidebar logo tile emit
  correctly as `:is(.dark *)` rules. `rounded-pill` resolves on demand and is simply unused so far.
- **Class-gluing audit.** Zero fused tokens. Two were introduced and fixed during the work — replacing
  a class string that ended in a space before a `${…}` interpolation produced
  `ring-primary/40border-l-error/70` and `tracking-labeltext-error`; both were caught and the spaces
  restored.
- **Syntax and imports.** All 37 JS/JSX files in `src` parse cleanly, and all 17 `@/`-aliased imports
  resolve.
- **Custom-property integrity.** 108 properties are defined; 67 are consumed somewhere in `src`; **0
  are consumed but undefined**, and the 33 referenced by `tailwind.config.js` all resolve. Nothing that
  a live component depends on was removed from `App.css`. The 34 unconsumed ones are the preserved
  legacy aliases.
- **Cascade audit.** Zero class-level collisions remain between `App.css` and the Tailwind output —
  the two class namespaces are now disjoint.
- **Responsive structure.** `AuthShell` owns the auth layout (single column below `lg` with the
  marketing panel hidden and a mobile logo row shown, a 38/62 grid at `lg`, and a
  `px-5` → `sm:px-8` → `lg:px-12` → `xl:px-14` padding ladder), which is why the three form pages carry
  no breakpoint utilities of their own. The shell hides the fixed sidebar below `lg`, offsets content by
  `lg:pl-64`, and clamps the drawer and both dropdowns with `min(…, 86vw)` /
  `min(…, calc(100vw - 2rem))`. `body { min-width: 320px }` is in place.

### Blocked in this environment — please run these on Windows

`node_modules` in this project was installed on Windows, so it contains only the win32 native
bindings, and package registries are unreachable from the sandbox. Two commands therefore cannot run
here, and both need your machine:

```
npm run build     # Vite 8 / rolldown: Cannot find module '@rolldown/binding-linux-x64-gnu'
                  # (only @rolldown/binding-win32-x64-msvc is installed)
npm run lint      # oxlint: Cannot find module './oxlint.linux-x64-gnu.node'
```

This is an environment limitation, not a code defect — the CSS half of the build was verified through
the real PostCSS chain above, and every JS/JSX file parses. No dev server was started at any point,
and every command used was finite with an explicit timeout.

### Still needs your eyes

Rendering could not be observed here. Please check, in both themes and at desktop / tablet / mobile
widths: Login, Signup (both steps), Forgot Password (all four phases), and the shell — sidebar,
header, notification dropdown, profile dropdown, and the mobile drawer.

---

## 7. Phase-2-visible side effects, disclosed

These follow unavoidably from the token and primitive changes and are visible on pages Phase 1 did not
redesign:

1. **`variant="outline"` buttons gain a visible border for the first time.** `button { border: none }`
   in `App.css` scores 0,0,1 and beats Tailwind preflight's `* { border-style: solid }` at 0,0,0, so
   every outline button has been rendering borderless. The `border-solid` utility in `button.jsx` fixes
   it, which changes the appearance of 14 buttons: 5 in Budgets, 4 in Expenses, 2 in Notifications, 3 in
   ProfileUtilityModals. There are no `variant="secondary"` usages in the codebase.
2. **Button default weight and elevation.** The base moved from `font-medium` to `font-semibold`, and
   `default` / `destructive` / `outline` gained `shadow-sm`. Sizes are unchanged, so nothing reflows.
3. **The "Transport" category badge changes from slate to blue** wherever `--accent-secondary` is
   consumed: `Budgets.jsx:16`, `Expenses.jsx:18`, `Dashboard.jsx:421`.
4. **Chart hues shift** so each category's slice matches its badge colour in both themes.
5. **One Phase-2 remnant left alone on purpose:** `Dashboard.jsx:532` has a bare `<button>` carrying a
   border utility that still renders borderless for the same specificity reason. Fixing it means editing
   a Phase-2 file, so it is listed as Phase-2 work rather than done here.

Two side effects claimed in earlier drafts were **withdrawn** after checking the compiler output rather
than reasoning from assumption: element selectors like `h1 { font-size }` and `input { width: 100% }`
never actually defeated `text-[2rem]` or `w-4`, because an element selector (0,0,1) always loses to a
class (0,1,0). No "stretched checkbox" or "spurious padding on link buttons" bug existed.

---

## 8. Phase 2 — identified, not implemented

For your approval before any work starts.

**Dashboard.** Establish a clear summary-card hierarchy on the new elevation levels, retire the
remaining hardcoded chart and badge colours in favour of tokens, tighten the recharts tooltip and
legend styling to match the new surfaces, and give the empty and loading states the same treatment as
the populated view. The bordered `<button>` at line 532 gets its `border-solid` fix here.

**Expenses.** Restyle the table or list rows as a scannable financial ledger with tabular figures,
sticky headers and clear zebra or divider logic; rework the filter and search bar into a coherent
control cluster; align the form and modal chrome with the new input primitive.

**Budgets.** Redesign the budget cards around the progress bar as the primary visual, with status
colour driven by the token statuses rather than ad-hoc values, and make the over-budget state read
clearly in both themes. The action menu's dismissal behaviour is a separate behavioural change and
would need its own approval.

**Notifications.** Unify the page rows with the sidebar dropdown rows so one presentation serves both,
strengthen the read/unread distinction, and restyle the category grouping and empty state.

**Cross-cutting, behavioural — needs explicit approval.** The dropdown and modal accessibility work
deferred from Phase 1: Escape to close, focus trapping, focus return, and body scroll locking. This
changes behaviour by definition, so it is called out separately rather than bundled into a visual
phase.
