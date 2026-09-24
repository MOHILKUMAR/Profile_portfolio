# Portfolio

Personal portfolio built with Astro, backed by Supabase, deployed to Vercel.

- **System adapted dark mode.** Follows `prefers-color-scheme` by default, with a System / Light / Dark
  toggle that overrides it and persists per browser.
- **Three languages.** English at `/`, Hindi at `/hi/`, Spanish at `/es/`.
- **Reaction time game** at `/play`. Five rounds, average and personal best kept locally.
- **Admin panel** at `/admin`. Sign in by magic link, then add projects with a photo, description and
  live site link. Published projects appear on the public project pages immediately.

Design constraints: no gradients, no blue, Outfit as the typeface. The palette is a warm neutral base
with a terracotta accent, defined once in `src/styles/global.css`.

## Requirements

- Node 22.12 or newer
- A Supabase project (free tier is enough)
- A Vercel account, for deploying

## 1. Set up Supabase

**Create the tables.** In the Supabase dashboard open **SQL Editor > New query**, paste the whole of
[`supabase/schema.sql`](supabase/schema.sql) and run it. This creates the `projects` and `admins`
tables, the row level security policies, and the public `project-images` storage bucket. It is safe to
re-run.

**Create your admin user.** Go to **Authentication > Users > Add user**, and add your email address.
Sign-in is by magic link so the password is never used, but the address must be real. Then open
[`supabase/add-admin.sql`](supabase/add-admin.sql), replace `you@example.com` with that address, and run
it in the SQL editor.

Being a Supabase user is not enough to write anything. The row in `admins` is what grants access, and
every write policy checks it. `shouldCreateUser: false` on the login endpoint means nobody can sign
themselves up.

**Allow the redirect URL.** Under **Authentication > URL Configuration**, add both of these to
**Redirect URLs** (the `/**` matters, it lets the query string through):

- `http://localhost:4321/**`
- `https://your-production-origin/**`

**Change the magic link email template. This step is required.** Under **Authentication > Email
Templates > Magic Link**, replace the body with:

```html
<h2>Sign in to your portfolio</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
<p>This link works once and expires shortly.</p>
```

The default template uses a PKCE flow: requesting a link stores half of a key as a cookie in the
browser you used, and the link carries the other half. Open the email in any other browser (a
different app, your phone, or just a Gmail tab in another browser) and sign-in fails with "PKCE code
verifier not found in storage". The template above carries a self-contained token that the server
verifies directly, so the link works wherever you open it. It also skips a redirect hop through
Supabase, which stops corporate link scanners from burning the one-time token before you click.

`{{ .RedirectTo }}` is built from `PUBLIC_SITE_URL`, or from the address the admin panel is open on when
that is unset, so the same template works locally and in production. If links arrive pointing at the wrong host, the redirect URL was not on the allow list and
Supabase fell back to the Site URL: recheck the step above.

**Email sending limits.** Supabase's built-in sender only allows a few auth emails per hour and is meant
for testing. Before relying on sign-in in production, set up custom SMTP under **Project Settings >
Authentication > SMTP Settings** (Resend, Brevo and SendGrid all have free tiers).

## 2. Run it locally

```bash
cp .env.example .env
```

Fill in `.env` from **Project Settings > Data API** (the URL) and **API Keys** (the anon key). The anon
key belongs in the browser: row level security is what protects the data, not the key.

`PUBLIC_OG_IMAGE` is optional. Set it to a path such as `/og.png` for a file in `public/`, or an
absolute URL, and it becomes the social preview for pages that have no image of their own. Project
pages always prefer their own photo. Left blank, the `og:image` tag is omitted and link previews fall
back to a small summary card, which is better than pointing at an image that does not exist.

```bash
npm install
npm run dev
```

The site is at http://localhost:4321 and the admin panel at http://localhost:4321/admin.

## 3. Deploy to Vercel

The live site is the Vercel project `profile-portfolio`, currently at
https://profile-portfolio-xi-teal.vercel.app.

**Environment variables** live under **Project Settings > Environment Variables**, not in any file.
`PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are required. The contact and social ones from
`.env.example` are optional, and their links stay hidden until set. Variables are read at build time
too, so redeploy after changing one.

`WHATSAPP_NUMBER` turns on the "Chat on WhatsApp" button. It is server only and stored as a sensitive
variable: the button posts to `/api/contact/whatsapp`, which redirects into WhatsApp, so the number never
appears in any page, script or in this repository. Keep it without a `PUBLIC_` prefix, which would
bundle it into the site. WhatsApp itself still shows the number to anyone who opens the chat.

`PUBLIC_SITE_URL` is optional on Vercel. Without it, canonical links use the project's production
domain and sign-in links use whichever address the admin is on. Set it once you add a custom domain.

**Deploy from this machine** (the CLI is linked through `.vercel/project.json`):

```bash
npx vercel deploy --prod
```

`.vercelignore` keeps `.env`, `.env.local` and `test-images/` out of the upload. `vercel link` also
writes a `.env.local` holding a Vercel access token; it is gitignored and must stay that way.

**Allow sign-in on the live site.** In Supabase, add the production address to **Authentication > URL
Configuration > Redirect URLs** (for example `https://profile-portfolio-xi-teal.vercel.app/**`).
Without it, magic links from the live admin panel fall back to the Supabase Site URL.

## Using the admin panel

`/admin` lists every project including drafts. **New project** opens the form:

| Field | What it does |
| --- | --- |
| Title | Required. Also generates the page address if you leave that blank. |
| Page address | The short name in `/projects/<address>`. Not the live site link. |
| Short description | Shown on the project cards and used as the page description. |
| Full description | The body of the project page. Plain text, blank line between paragraphs. |
| Live site URL | The "Visit site" button. `https://` is added if you leave it off. |
| Tech used | Comma separated, rendered as tags. |
| Project photo | Up to 5 MB, PNG / JPEG / WebP / AVIF / GIF. A 16:10 crop fits the cards best. |
| Translations | Optional Hindi and Spanish copy. Blank fields fall back to the English text. |
| Published | Unpublish to hide a project from the public site without deleting it. |
| Featured | Featured projects fill the home page section. Without any, it shows the newest three. |
| Sort order | Higher shows first. |

Deleting a project also deletes its uploaded photo.

## Caching

`src/middleware.ts` puts `public, max-age=0, s-maxage=60, stale-while-revalidate=600` on public pages.
Vercel's CDN keeps each page for 60 seconds, browsers always check back with it, so **a published edit
shows within about a minute**. You can watch it work in the `X-Vercel-Cache` response header: `MISS` on
the first request, `HIT` after. Change `PUBLIC_CACHE` in that file if you want it tighter or looser.

Three things are deliberately never cached: anything under `/admin` or `/api/` is `private, no-store`;
any response carrying a `Set-Cookie` is skipped, because a shared cache holding a refreshed session
cookie would hand one visitor's login to the next; and any page rendered after a failed Supabase read
is `no-store`, so a brief outage is not served as "no projects" after the database recovers.

`/robots.txt` and `/sitemap.xml` are generated at request time. The sitemap lists all three locales for
every page plus every published project, with `hreflang` cross references so the translations are not
read as duplicate content.

## Translations

`src/i18n/en.json` holds the real copy. `hi.json` and `es.json` currently contain the **English text as
placeholders**, so nothing on the site is machine translated. Replace the values as you go: any key you
have not translated falls back to English rather than rendering blank, so you can do it piecemeal.

To add a fourth language:

1. Copy `src/i18n/en.json` to `src/i18n/fr.json` and translate the values.
2. Add the locale to `LOCALES`, `LOCALE_NAMES` and `LOCALE_TAGS` in `src/i18n/utils.ts`.
3. Add it to `i18n.locales` in `astro.config.mjs`.
4. Copy `src/pages/es/` to `src/pages/fr/` and change `locale="es"` to `locale="fr"` in the four files.
5. Add it to `TRANSLATABLE_LOCALES` in `src/lib/projectForm.ts` and add a matching block to
   `src/components/ProjectForm.astro` if you want per-project translations too.

## Project layout

```
src/
  components/
    pages/             Page bodies, shared by all three locales
    ProjectForm.astro  The admin create and edit form
    ReactionGame.astro The game, self contained
  i18n/                Locale files and the t() helper
  layouts/             Base.astro (public), Admin.astro (admin)
  lib/
    env.ts             Reads process.env on Vercel, .env locally
    supabase.ts        Per request client, cookie backed sessions
    projects.ts        Queries, types, locale overlay
    projectForm.ts     Form parsing and image upload
  middleware.ts        Locale detection and the admin guard
  pages/
    index.astro …      English routes
    hi/ es/            Thin wrappers that render the same page bodies
    admin/             Admin screens
    api/admin/         Form POST handlers
supabase/
  schema.sql           Tables, policies, storage bucket
  add-admin.sql        Grant admin access to a user
```

Routes under `/admin` and `/api/admin` are gated in `src/middleware.ts`, which revalidates the JWT with
Supabase on every request rather than trusting the cookie, then checks the `admins` table. The database
policies enforce the same rule independently, so a bug in the middleware alone cannot expose writes.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server at localhost:4321 |
| `npm run build` | Production build into `dist/` |
| `npm run check` | Type check every Astro and TypeScript file |
| `npx vercel deploy --prod` | Deploy to production on Vercel |
