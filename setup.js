const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Lab Compliance Portal - Automated Setup');
console.log('==========================================\n');

// Create folders
const folders = [
  'netlify/functions',
  'src/components',
  'src/context',
  'src/styles',
  'public'
];

folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`✓ Created ${folder}`);
  }
});

console.log('');

// Create package.json
const packageJson = {
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
};

fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
console.log('✓ Created package.json');

// Create .env.example
const envContent = `VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
STRIPE_PUBLIC_KEY=pk_live_or_test_key
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
GMAIL_USER=your-lab-portal@gmail.com
GMAIL_APP_PASSWORD=your_app_specific_password
SITE_URL=http://localhost:3000
NODE_ENV=development`;

fs.writeFileSync('.env.example', envContent);
console.log('✓ Created .env.example');

// Create vite.config.js
const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }
})`;

fs.writeFileSync('vite.config.js', viteConfig);
console.log('✓ Created vite.config.js');

// Create netlify.toml
const netlifyToml = `[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "dist"

[dev]
  command = "npm run dev"
  functions = "netlify/functions"
  port = 3000

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200`;

fs.writeFileSync('netlify.toml', netlifyToml);
console.log('✓ Created netlify.toml');

// Create .gitignore
const gitignore = `node_modules/
.env.local
dist/
.DS_Store
.vscode/
.idea/`;

fs.writeFileSync('.gitignore', gitignore);
console.log('✓ Created .gitignore');

console.log('\n✓ Creating backend functions...');

// Create backend functions
const functions = {
  'netlify/functions/auth-register.js': `// Placeholder - see full version in docs
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ message: 'Auth function' }) };
};`,
  
  'netlify/functions/upload-document.js': `// Placeholder - see full version in docs
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ message: 'Upload function' }) };
};`,
  
  'netlify/functions/create-checkout.js': `// Placeholder - see full version in docs
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ message: 'Checkout function' }) };
};`,
  
  'netlify/functions/stripe-webhook.js': `// Placeholder - see full version in docs
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};`,
  
  'netlify/functions/admin-clients.js': `// Placeholder - see full version in docs
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ clients: [] }) };
};`,
  
  'netlify/functions/admin-client-detail.js': `// Placeholder - see full version in docs
exports.handler = async (event) => {
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};`
};

Object.keys(functions).forEach(filePath => {
  fs.writeFileSync(filePath, functions[filePath]);
  console.log(`✓ Created ${filePath}`);
});

console.log('\n✓ Creating React components...');

// Create components
const components = {
  'src/components/RegistrationForm.jsx': `import React, { useState } from 'react';
export function RegistrationForm() {
  return <div>Registration Form</div>;
}`,

  'src/components/LoginForm.jsx': `import React, { useState } from 'react';
export function LoginForm() {
  return <div>Login Form</div>;
}`,

  'src/components/UserDashboard.jsx': `import React from 'react';
export function UserDashboard() {
  return <div>User Dashboard</div>;
}`,

  'src/components/AdminDashboard.jsx': `import React from 'react';
export function AdminDashboard() {
  return <div>Admin Dashboard</div>;
}`
};

Object.keys(components).forEach(filePath => {
  fs.writeFileSync(filePath, components[filePath]);
  console.log(`✓ Created ${filePath}`);
});

console.log('\n✓ Creating context...');

// Create AuthContext
const authContext = `import React, { createContext, useContext } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}`;

fs.writeFileSync('src/context/AuthContext.jsx', authContext);
console.log('✓ Created src/context/AuthContext.jsx');

console.log('\n✓ Creating styles...');

// Create CSS files
const cssFiles = {
  'src/styles/auth.css': `.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.auth-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  max-width: 500px;
  width: 100%;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.submit-button {
  width: 100%;
  background: #667eea;
  color: white;
  padding: 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.error-message {
  background: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 20px;
}`,

  'src/styles/dashboard.css': `/* Dashboard styles */`,
  'src/styles/admin.css': `/* Admin styles */`
};

Object.keys(cssFiles).forEach(filePath => {
  fs.writeFileSync(filePath, cssFiles[filePath]);
  console.log(`✓ Created ${filePath}`);
});

console.log('\n==========================================');
console.log('✅ Setup Complete!');
console.log('==========================================\n');

console.log('Next Steps:\n');
console.log('1️⃣  Install dependencies:');
console.log('   npm install\n');

console.log('2️⃣  Configure environment:');
console.log('   cp .env.example .env.local');
console.log('   # Edit .env.local with your API keys\n');

console.log('3️⃣  Test locally:');
console.log('   npm run dev');
console.log('   # Visit http://localhost:3000\n');

console.log('4️⃣  Deploy:');
console.log('   git add .');
console.log('   git commit -m "Lab Portal setup"');
console.log('   git push origin main\n');

console.log('🚀 Your Lab Compliance Portal is ready!\n');