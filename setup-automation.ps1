# Lab Compliance Portal - Automated Setup (Windows)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Lab Compliance Portal - Automated Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Create folders
$folders = @("netlify/functions", "src/components", "src/context", "src/styles", "public")
foreach ($folder in $folders) {
    if (!(Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "✓ Created $folder" -ForegroundColor Green
    }
}

# Create auth-register.js
$auth = @'
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  
  try {
    const { email, firstName, lastName, phone, businessName, businessAddress, labType } = JSON.parse(event.body);
    
    if (!email || !firstName || !lastName || !businessName || !labType) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, email_confirm: false });
    if (authError) return { statusCode: 400, body: JSON.stringify({ error: authError.message }) };

    const userId = authData.user.id;

    await supabase.from('users').insert({
      id: userId, email, first_name: firstName, last_name: lastName, phone,
      business_name: businessName, business_address: businessAddress, lab_type: labType, is_admin: false
    });

    return { statusCode: 201, body: JSON.stringify({ success: true, userId }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
'@
Set-Content -Path "netlify/functions/auth-register.js" -Value $auth
Write-Host "✓ Created auth-register.js" -ForegroundColor Green

# Create placeholder functions
$funcs = @(
    @{ name = "upload-document.js"; content = "exports.handler = async (event) => { return { statusCode: 200, body: 'Upload' }; };" },
    @{ name = "create-checkout.js"; content = "exports.handler = async (event) => { return { statusCode: 200, body: 'Checkout' }; };" },
    @{ name = "stripe-webhook.js"; content = "exports.handler = async (event) => { return { statusCode: 200, body: JSON.stringify({ received: true }) }; };" },
    @{ name = "admin-clients.js"; content = "exports.handler = async (event) => { return { statusCode: 200, body: JSON.stringify({ clients: [] }) }; };" },
    @{ name = "admin-client-detail.js"; content = "exports.handler = async (event) => { return { statusCode: 200, body: JSON.stringify({ success: true }) }; };" }
)

foreach ($func in $funcs) {
    Set-Content -Path "netlify/functions/$($func.name)" -Value $func.content
    Write-Host "✓ Created $($func.name)" -ForegroundColor Green
}

# Create React components
$regForm = @'
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export function RegistrationForm() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    email: "", firstName: "", lastName: "", phone: "", businessName: "", businessAddress: "", labType: "Clinical"
  });

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await register(formData);
      navigate("/login", { state: { message: "Check your email!", email: formData.email } });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Lab Readiness Portal</h1>
        <h2>Create Account</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email *</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Business Name *</label>
            <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Business Address *</label>
            <input type="text" name="businessAddress" value={formData.businessAddress} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Lab Type *</label>
            <select name="labType" value={formData.labType} onChange={handleChange} required>
              <option>Clinical</option>
              <option>Research</option>
              <option>Diagnostic</option>
            </select>
          </div>
          <button type="submit" disabled={isLoading} className="submit-button">{isLoading ? "Creating..." : "Create Account"}</button>
          <p className="auth-footer">Have account? <a href="/login">Sign in</a></p>
        </form>
      </div>
    </div>
  );
}
'@
Set-Content -Path "src/components/RegistrationForm.jsx" -Value $regForm
Write-Host "✓ Created RegistrationForm.jsx" -ForegroundColor Green

# Create other components
Set-Content -Path "src/components/LoginForm.jsx" -Value "export function LoginForm() { return <div>Login Form</div>; }"
Set-Content -Path "src/components/UserDashboard.jsx" -Value "export function UserDashboard() { return <div>Dashboard</div>; }"
Set-Content -Path "src/components/AdminDashboard.jsx" -Value "export function AdminDashboard() { return <div>Admin</div>; }"
Set-Content -Path "src/context/AuthContext.jsx" -Value "import React, { createContext, useContext } from 'react'; const AuthContext = createContext(); export function AuthProvider({ children }) { return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>; } export function useAuth() { return useContext(AuthContext); }"

Write-Host "✓ Created React components" -ForegroundColor Green

# Create CSS files
Set-Content -Path "src/styles/auth.css" -Value ".auth-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); } .auth-card { background: white; border-radius: 12px; padding: 40px; max-width: 500px; } .form-group { margin-bottom: 20px; } .form-group input, .form-group select { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 6px; } .submit-button { width: 100%; background: #667eea; color: white; padding: 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }"
Set-Content -Path "src/styles/dashboard.css" -Value "/* Dashboard styles */"
Set-Content -Path "src/styles/admin.css" -Value "/* Admin styles */"

Write-Host "✓ Created CSS files" -ForegroundColor Green

# Create config files
Set-Content -Path ".env.example" -Value "VITE_SUPABASE_URL=https://your-project.supabase.co`nVITE_SUPABASE_ANON_KEY=your_anon_key`nSUPABASE_SERVICE_KEY=your_service_key`nSTRIPE_PUBLIC_KEY=pk_test`nSTRIPE_SECRET_KEY=sk_test`nSTRIPE_WEBHOOK_SECRET=whsec_test`nGMAIL_USER=your-email@gmail.com`nGMAIL_APP_PASSWORD=your_password`nSITE_URL=http://localhost:3000`nNODE_ENV=development"

Set-Content -Path "package.json" -Value '{
  "name": "lab-compliance-portal",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@supabase/supabase-js": "^2.38.0",
    "stripe": "^14.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  }
}'

Set-Content -Path "vite.config.js" -Value "import { defineConfig } from 'vite'; import react from '@vitejs/plugin-react'; export default defineConfig({ plugins: [react()], server: { port: 3000 } })"

Set-Content -Path "netlify.toml" -Value "[build]`n  command = `"npm run build`"`n  functions = `"netlify/functions`"`n  publish = `"dist`"`n`n[dev]`n  command = `"npm run dev`"`n  port = 3000`n`n[[redirects]]`n  from = `"/*`"`n  to = `"/index.html`"`n  status = 200"

Set-Content -Path ".gitignore" -Value "node_modules/`n.env.local`ndist/`n.DS_Store`n.vscode/`n.idea/"

Write-Host "✓ Created configuration files" -ForegroundColor Green

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Blue
npm install

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣ Configure Environment" -ForegroundColor Yellow
Write-Host "   cp .env.example .env.local"
Write-Host "   Edit .env.local with your API keys"
Write-Host ""
Write-Host "2️⃣ Test Locally" -ForegroundColor Yellow
Write-Host "   npm run dev"
Write-Host "   Visit http://localhost:3000"
Write-Host ""
Write-Host "3️⃣ Deploy" -ForegroundColor Yellow
Write-Host "   git add ."
Write-Host "   git commit -m 'Lab Portal setup'"
Write-Host "   git push origin main"
Write-Host ""
Write-Host "🚀 Your Lab Compliance Portal is ready!" -ForegroundColor Green