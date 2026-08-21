HOW TO DEPLOY (same as your previous "Add files via upload" commits)

1. Go to github.com/RandyP78/Lab-portal
2. Click "Add file" -> "Upload files"
3. Open this folder on your computer and drag EVERYTHING inside it
   (the netlify folder, the src folder, netlify.toml, package.json,
   package-lock.json) into the upload box. GitHub keeps the folder
   structure - existing files are replaced, new ones are added.
4. Commit directly to main. Netlify will auto-deploy in ~1-2 minutes.

What's in this update:
- License Forms tab (client dashboard) + License Forms panel (admin client detail)
- One questionnaire generates pre-filled PDFs: CMS-116 & CMS-209 for everyone,
  CA LAB series for CA labs, -OS series for labs outside CA, TX Supplement 3225
- Bulk multi-file document upload with drag & drop
