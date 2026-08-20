# Lab Compliance Portal - Automated Setup Guide

This guide will get your entire project set up in **under 5 minutes** using automation scripts.

## 🚀 Choose Your Operating System

### **Mac/Linux Users** → Use Bash Script
### **Windows Users** → Use PowerShell Script

---

## 📋 Prerequisites (Required First!)

Before running any script, you need:

- ✅ Git installed and configured
- ✅ Node.js 16+ and npm installed
- ✅ A Git repository (new or existing)
- ✅ Terminal/PowerShell access

Check your versions:
```bash
git --version
node --version
npm --version
```

---

## 🐧 Mac/Linux Setup (Bash Script)

### Step 1: Download the Script
Get `setup-automation.sh` from the files provided

### Step 2: Make it Executable
```bash
chmod +x setup-automation.sh
```

### Step 3: Run the Script
```bash
./setup-automation.sh
```

**That's it!** The script will:
- ✅ Create all folder structure
- ✅ Create all 24 project files
- ✅ Install npm dependencies
- ✅ Generate `.env.example`
- ✅ Set up Git configuration
- ✅ Show next steps

**Total time: ~3 minutes**

---

## 🪟 Windows Setup (PowerShell Script)

### Step 1: Download the Script
Get `setup-automation.ps1` from the files provided

### Step 2: Run PowerShell as Administrator
- Right-click PowerShell
- Select "Run as Administrator"
- Navigate to your project directory:
```powershell
cd C:\path\to\your\project
```

### Step 3: Enable Script Execution
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 4: Run the Script
```powershell
.\setup-automation.ps1
```

**That's it!** Same as Mac/Linux - everything gets created automatically.

**Total time: ~3 minutes**

---

## 📋 What the Scripts Do

Both scripts automate:

1. **Create Folder Structure**
   ```
   netlify/functions/
   src/components/
   src/context/
   src/styles/
   public/
   ```

2. **Generate All Files**
   - 6 Netlify backend functions
   - 4 React components
   - 3 CSS stylesheets
   - Configuration files (package.json, vite.config.js, netlify.toml, etc.)
   - Environment template (.env.example)

3. **Install Dependencies**
   - Runs `npm install` automatically
   - Gets React, Vite, Supabase, Stripe, etc.

4. **Create .env.local** (optional)
   - Auto-creates from `.env.example`
   - You fill in your API keys

---

## 🎯 Next Steps After Script Runs

### Step 1: Add Your API Keys (5 minutes)

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_KEY=YOUR_SERVICE_KEY
STRIPE_PUBLIC_KEY=YOUR_PUBLIC_KEY
STRIPE_SECRET_KEY=YOUR_SECRET_KEY
STRIPE_WEBHOOK_SECRET=YOUR_WEBHOOK_SECRET
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=YOUR_APP_PASSWORD
SITE_URL=http://localhost:3000
```

### Step 2: Test Locally (2 minutes)

```bash
npm run dev
```

Visit: **http://localhost:3000**

You should see the registration page!

### Step 3: Set Up Services (30-45 minutes)

Follow this order for each service:

**1. Supabase**
- Create project at supabase.com
- Copy your URL and keys to `.env.local`
- In Supabase SQL Editor, run `schema.sql` (the database file)

**2. Stripe**
- Get API keys from dashboard
- Create webhook endpoint
- Add keys to `.env.local`

**3. Gmail**
- Enable 2FA
- Generate app password
- Add to `.env.local`

**4. Netlify**
- Connect your Git repo
- Add environment variables in Netlify settings

### Step 4: Deploy (1 minute)

```bash
git add .
git commit -m "Lab Portal - Automated setup complete"
git push origin main
```

Netlify auto-deploys when you push! 🚀

---

## ⚙️ Troubleshooting

### "Permission denied" (Mac/Linux)
```bash
chmod +x setup-automation.sh
./setup-automation.sh
```

### "Cannot be loaded because running scripts is disabled" (Windows)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup-automation.ps1
```

### "npm: command not found"
- Install Node.js from nodejs.org
- Restart terminal
- Try again

### "git: command not found"
- Install Git from git-scm.com
- Restart terminal
- Try again

### Script creates files but they're empty
- Make sure you have write permissions in the directory
- Try running in a different folder
- Check disk space

### npm install fails
```bash
# Clear cache and try again
npm cache clean --force
npm install
```

---

## 📁 Project Structure After Script

```
your-project/
├── netlify/functions/          ✅ Created
│   ├── auth-register.js
│   ├── upload-document.js
│   ├── create-checkout.js
│   ├── stripe-webhook.js
│   ├── admin-clients.js
│   └── admin-client-detail.js
├── src/                        ✅ Created
│   ├── components/
│   ├── context/
│   ├── styles/
│   └── App.jsx
├── package.json                ✅ Created
├── vite.config.js              ✅ Created
├── netlify.toml                ✅ Created
├── .env.example                ✅ Created (you edit this)
├── .gitignore                  ✅ Created
└── node_modules/               ✅ Installed
```

---

## ✅ Verification Checklist

After script runs, verify:

- [ ] All folders created (`netlify/functions`, `src/components`, etc.)
- [ ] All files exist (6 functions, 4 components, CSS files)
- [ ] `package.json` has all dependencies
- [ ] `.env.example` file created
- [ ] `.gitignore` file created
- [ ] `npm install` completed successfully
- [ ] `npm run dev` starts without errors
- [ ] Browser shows registration form at http://localhost:3000

---

## 🆘 Need Full Documentation?

After the script runs, you'll have access to:
- **README.md** - Project overview
- **SETUP_GUIDE_QUICK.md** - Quick setup reference
- **All inline code comments** - Detailed explanations

---

## 💡 Pro Tips

1. **Keep .env.local private** - Never commit it to Git
2. **Use test Stripe keys first** - Switch to production keys later
3. **Gmail 2FA is required** - Can't skip this step
4. **Save your API keys** - You'll need them for Netlify too
5. **Test locally first** - Before deploying to Netlify

---

## 🎯 Timeline

| Step | Time | What |
|------|------|------|
| Script Run | 3 min | Folders, files, npm install |
| Add API Keys | 5 min | Copy/paste from services |
| Test Locally | 2 min | `npm run dev` |
| Set Up Services | 30-45 min | Supabase, Stripe, Gmail |
| Deploy | 1 min | `git push` |
| **TOTAL** | **40-55 min** | **Live & Working!** |

---

## 🚀 You're Done!

After script completes, you have:
- ✅ Complete project structure
- ✅ All source code
- ✅ All configuration
- ✅ Ready to configure services
- ✅ Ready to deploy

**Next: Copy your API keys to `.env.local` and test!**

---

## 📞 Support

If you get stuck:

1. **Check error message** - Read what the terminal says
2. **Verify prerequisites** - Git, Node, npm all installed?
3. **Check permissions** - Can you write to this folder?
4. **Try another folder** - Maybe current folder has permissions issue
5. **Run as administrator** (Windows only)

**Still stuck?** Check the detailed README.md that gets created, or the individual file comments in the code.

---

**Your Lab Compliance Portal is ready to build! 🎉**
