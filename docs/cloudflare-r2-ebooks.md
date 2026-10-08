# Curvafit ebook storage on Cloudflare R2

The ebook PDFs belong in a private R2 bucket. Cloudflare Pages Functions receive
the bucket binding as `env.EBOOKS_BUCKET`; no permanent public file URLs or
payment/download routes are created by this infrastructure setup.

## One-time Cloudflare setup

1. Install Wrangler in the project: `npm install --save-dev wrangler`.
2. Authenticate the CLI: `npx wrangler login`.
3. Create the private bucket: `npx wrangler r2 bucket create curvafit-ebooks`.
4. Confirm the bucket exists: `npx wrangler r2 bucket list`.
5. Deploy the existing Cloudflare Pages project with the updated `wrangler.toml`.
   Keep the existing Pages project name unchanged. The binding is `EBOOKS_BUCKET`.

The R2 binding needs no access key in the site or Pages secrets. Wrangler uses
the authenticated Cloudflare account for uploads; Pages Functions access R2
through the binding.

## Upload the PDFs

Put the 12 files below in the local `ebooks-to-upload` folder. This folder is
ignored by Git so the PDFs are not added to the website repository.

```text
ebooks-to-upload/
  gentle-walking/en.pdf
  gentle-walking/fr.pdf
  gentle-walking/es.pdf
  simple-meal-planner/en.pdf
  simple-meal-planner/fr.pdf
  simple-meal-planner/es.pdf
  move-at-home/en.pdf
  move-at-home/fr.pdf
  move-at-home/es.pdf
  back-on-track/en.pdf
  back-on-track/fr.pdf
  back-on-track/es.pdf
```

From the project root, run:

```powershell
./scripts/upload-ebooks-to-r2.ps1
```

Or pass a different source directory:

```powershell
./scripts/upload-ebooks-to-r2.ps1 -SourceDirectory 'D:\Curvafit PDFs'
```

The script verifies that all 12 PDFs exist before uploading and stores them
under matching keys in the private bucket. The object keys (for example,
`gentle-walking/en.pdf`) identify each file to the future server-side download
handler. They are not public download URLs. Secure, payment-verified links will
be added separately as requested.
