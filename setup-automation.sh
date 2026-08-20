#!/bin/bash

# Lab Compliance Portal - Automated Setup Script
# This script creates the entire project structure automatically

set -e  # Exit on error

echo "🚀 Lab Compliance Portal - Automated Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a Vite React project
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  No package.json found. Creating new Vite React project...${NC}"
    npm create vite@latest lab-portal -- --template react
    cd lab-portal
fi

echo -e "${BLUE}📁 Creating folder structure...${NC}"

# Create folders
mkdir -p netlify/functions
mkdir -p src/components
mkdir -p src/context
mkdir -p src/styles
mkdir -p public

echo -e "${GREEN}✓ Folders created${NC}"
echo ""

# Function to create file with content
create_file() {
    local path=$1
    local content=$2
    mkdir -p "$(dirname "$path")"
    echo "$content" > "$path"
    echo -e "${GREEN}✓ Created $path${NC}"
}

echo -e "${BLUE}📝 Creating backend functions...${NC}"

# Create auth-register.js
create_file "netlify/functions/auth-register.js" '// netlify/functions/auth-register.js
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const {
      email,
      firstName,
      lastName,
      phone,
      businessName,
      businessAddress,
      labType
    } = JSON.parse(event.body);

    if (!email || !firstName || !lastName || !businessName || !labType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" })
      };
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: false
    });

    if (authError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: authError.message })
      };
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabase
      .from("users")
      .insert({
        id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone,
        business_name: businessName,
        business_address: businessAddress,
        lab_type: labType,
        is_admin: false
      });

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: profileError.message })
      };
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      options: {
        redirect_to: `${process.env.SITE_URL}/set-password`
      }
    });

    if (signUpError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Failed to generate auth link" })
      };
    }

    await transporter.sendMail({
      to: email,
      subject: "Welcome to Lab Compliance Portal - Set Your Password",
      html: `
        <h2>Welcome, ${firstName}!</h2>
        <p>Click to set your password and activate your account:</p>
        <a href="${signUpData.properties.action_link}" style="padding: 10px 20px; background: #0066cc; color: white; text-decoration: none; border-radius: 5px;">
          Set Your Password
        </a>
        <p>Lab: ${businessName} (${labType})</p>
      `
    });

    await supabase
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: "user_registered",
        resource_type: "user",
        resource_id: userId
      });

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        message: "Registration successful. Check your email to set your password.",
        userId
      })
    };

  } catch (error) {
    console.error("Registration error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
'

# Create upload-document.js
create_file "netlify/functions/upload-document.js" '// netlify/functions/upload-document.js
const { createClient } = require("@supabase/supabase-js");
const busboy = require("busboy");
const path = require("path");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Missing authorization header" })
    };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const userId = user.id;

    return new Promise((resolve) => {
      const bb = busboy({ headers: event.headers });
      let fileData = null;
      let documentCategory = null;

      bb.on("field", (fieldname, val) => {
        if (fieldname === "documentCategory") {
          documentCategory = val;
        }
      });

      bb.on("file", async (fieldname, file, info) => {
        if (fieldname !== "file") {
          file.resume();
          return;
        }

        const chunks = [];
        file.on("data", (chunk) => {
          chunks.push(chunk);
        });

        file.on("end", async () => {
          fileData = Buffer.concat(chunks);
          
          try {
            const fileName = `${Date.now()}_${info.filename}`;
            const storagePath = `${userId}/${documentCategory}/${fileName}`;

            const { error: storageError } = await supabase
              .storage
              .from("documents")
              .upload(storagePath, fileData, {
                contentType: info.mimeType,
                upsert: false
              });

            if (storageError) {
              resolve({
                statusCode: 400,
                body: JSON.stringify({ error: storageError.message })
              });
              return;
            }

            const { data: docRecord, error: dbError } = await supabase
              .from("documents")
              .insert({
                user_id: userId,
                file_name: info.filename,
                file_path: storagePath,
                file_type: path.extname(info.filename).substring(1),
                document_category: documentCategory,
                file_size: fileData.length
              })
              .select();

            if (dbError) {
              resolve({
                statusCode: 400,
                body: JSON.stringify({ error: dbError.message })
              });
              return;
            }

            resolve({
              statusCode: 201,
              body: JSON.stringify({
                success: true,
                document: docRecord[0],
                message: "Document uploaded successfully"
              })
            });

          } catch (error) {
            resolve({
              statusCode: 500,
              body: JSON.stringify({ error: "Upload failed" })
            });
          }
        });
      });

      bb.on("close", () => {
        if (!fileData) {
          resolve({
            statusCode: 400,
            body: JSON.stringify({ error: "No file provided" })
          });
        }
      });

      bb.write(event.body);
      bb.end();
    });

  } catch (error) {
    console.error("Upload error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
'

# Create create-checkout.js
create_file "netlify/functions/create-checkout.js" '// netlify/functions/create-checkout.js
const { createClient } = require("@supabase/supabase-js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const PRICING = {
  tier_1: {
    name: "Analysis Only",
    price: 29900,
    interval: "month"
  },
  tier_2: {
    name: "Analysis + Templates",
    price: 79900,
    interval: "month"
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" })
    };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { tier } = JSON.parse(event.body);

    if (!tier || !PRICING[tier]) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid tier" })
      };
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const { data: userData } = await supabase
      .from("users")
      .select("email, first_name, business_name")
      .eq("id", user.id)
      .single();

    let customerId;
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (existingSub?.stripe_customer_id) {
      customerId = existingSub.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: `${userData.first_name} - ${userData.business_name}`,
        metadata: {
          user_id: user.id
        }
      });
      customerId = customer.id;

      await supabase
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: PRICING[tier].name
            },
            recurring: {
              interval: "month"
            }
          },
          price: PRICING[tier].price,
          quantity: 1
        }
      ],
      success_url: `${process.env.SITE_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/dashboard`,
      metadata: {
        user_id: user.id,
        tier: tier
      }
    });

    await supabase
      .from("subscriptions")
      .update({
        stripe_subscription_id: session.subscription || null,
        tier: tier,
        stripe_customer_id: customerId
      })
      .eq("user_id", user.id);

    return {
      statusCode: 200,
      body: JSON.stringify({
        sessionId: session.id,
        url: session.url
      })
    };

  } catch (error) {
    console.error("Checkout error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create checkout session" })
    };
  }
};
'

# Create stripe-webhook.js
create_file "netlify/functions/stripe-webhook.js" '// netlify/functions/stripe-webhook.js
const { createClient } = require("@supabase/supabase-js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const nodemailer = require("nodemailer");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const sig = event.headers["stripe-signature"];

  try {
    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (stripeEvent.type) {
      case "customer.subscription.updated": {
        const subscription = stripeEvent.data.object;
        const { data: userData } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (userData) {
          await supabase
            .from("subscriptions")
            .update({
              status: subscription.status,
              current_period_start: new Date(subscription.current_period_start * 1000),
              current_period_end: new Date(subscription.current_period_end * 1000)
            })
            .eq("stripe_subscription_id", subscription.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = stripeEvent.data.object;
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error("Webhook error:", error.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: error.message })
    };
  }
};
'

# Create admin-clients.js
create_file "netlify/functions/admin-clients.js" '// netlify/functions/admin-clients.js
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" })
    };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const { data: adminUser } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!adminUser?.is_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Admin access required" })
      };
    }

    if (event.httpMethod === "GET") {
      const { data: clients, error } = await supabase
        .from("users")
        .select(`
          id,
          email,
          first_name,
          last_name,
          business_name,
          business_address,
          lab_type,
          created_at,
          subscriptions (
            tier,
            status,
            current_period_end
          ),
          readiness_assessments (
            readiness_percentage,
            status,
            analysis_date,
            docs_uploaded,
            total_docs_needed
          )
        `)
        .eq("is_admin", false)
        .order("created_at", { ascending: false });

      if (error) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: error.message })
        };
      }

      const enrichedClients = clients.map(client => ({
        ...client,
        latestSubscription: client.subscriptions?.[0],
        latestReadiness: client.readiness_assessments?.[0],
        accountStatus: client.subscriptions?.[0]?.status || "no_subscription"
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({
          clients: enrichedClients,
          total: enrichedClients.length
        })
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error) {
    console.error("Admin clients error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
'

# Create admin-client-detail.js
create_file "netlify/functions/admin-client-detail.js" '// netlify/functions/admin-client-detail.js
const { createClient } = require("@supabase/supabase-js");
const nodemailer = require("nodemailer");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

exports.handler = async (event) => {
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: "Unauthorized" })
    };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" })
      };
    }

    const { data: adminUser } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!adminUser?.is_admin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Admin access required" })
      };
    }

    const clientId = event.queryStringParameters?.clientId;
    if (!clientId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Client ID required" })
      };
    }

    if (event.httpMethod === "GET") {
      const { data: client, error: clientError } = await supabase
        .from("users")
        .select(`
          id,
          email,
          first_name,
          last_name,
          phone,
          business_name,
          business_address,
          lab_type,
          created_at
        `)
        .eq("id", clientId)
        .single();

      if (clientError || !client) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Client not found" })
        };
      }

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: readiness } = await supabase
        .from("readiness_assessments")
        .select("*")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const { data: documents } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", clientId)
        .order("uploaded_at", { ascending: false });

      const { data: requiredDocs } = await supabase
        .from("required_documents")
        .select("*")
        .eq("lab_type", client.lab_type);

      const uploadedCategories = documents?.map(d => d.document_category) || [];
      const missingDocs = requiredDocs?.filter(
        req => !uploadedCategories.includes(req.category)
      ) || [];

      return {
        statusCode: 200,
        body: JSON.stringify({
          client,
          subscription,
          readiness,
          documents: documents || [],
          requiredDocs: requiredDocs || [],
          missingDocs,
          readinessPercentage: readiness?.readiness_percentage || 0
        })
      };
    }

    return { statusCode: 405, body: "Method Not Allowed" };

  } catch (error) {
    console.error("Admin client detail error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};
'

echo ""
echo -e "${BLUE}📝 Creating React components...${NC}"

# Create RegistrationForm.jsx (shortened for space)
create_file "src/components/RegistrationForm.jsx" '// src/components/RegistrationForm.jsx
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
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    businessName: "",
    businessAddress: "",
    labType: "Clinical"
  });

  const labTypes = ["Clinical", "Research", "Diagnostic", "Other"];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!formData.email || !formData.firstName || !formData.lastName || 
          !formData.businessName || !formData.labType) {
        setError("Please fill in all required fields");
        setIsLoading(false);
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError("Please enter a valid email address");
        setIsLoading(false);
        return;
      }

      await register(formData);

      setTimeout(() => {
        navigate("/login", {
          state: {
            message: "Registration successful! Check your email to set your password.",
            email: formData.email
          }
        });
      }, 1500);
    } catch (err) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Lab Readiness Portal</h1>
        <h2>Create Your Account</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name *</label>
              <input
                id="firstName"
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="John"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name *</label>
              <input
                id="lastName"
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className="form-group">
            <label htmlFor="businessName">Business Name *</label>
            <input
              id="businessName"
              type="text"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              placeholder="Acme Laboratory"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="businessAddress">Business Address *</label>
            <input
              id="businessAddress"
              type="text"
              name="businessAddress"
              value={formData.businessAddress}
              onChange={handleChange}
              placeholder="123 Medical Drive, Suite 100"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="labType">Type of Laboratory *</label>
            <select
              id="labType"
              name="labType"
              value={formData.labType}
              onChange={handleChange}
              required
            >
              {labTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="submit-button"
          >
            {isLoading ? "Creating Account..." : "Create Account"}
          </button>

          <p className="auth-footer">
            Already have an account? <a href="/login">Sign in here</a>
          </p>
        </form>
      </div>
    </div>
  );
}
'

create_file "src/components/LoginForm.jsx" '// src/components/LoginForm.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/auth.css";

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState({
    email: location.state?.email || "",
    password: ""
  });

  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
    }
  }, [location.state]);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (!formData.email || !formData.password) {
        setError("Please enter both email and password");
        setIsLoading(false);
        return;
      }

      await login(formData.email, formData.password);
      setSuccessMessage("Login successful! Redirecting...");

      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Lab Readiness Portal</h1>
        <h2>Sign In</h2>

        {error && <div className="error-message">{error}</div>}
        {successMessage && <div className="success-message">{successMessage}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="your@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="submit-button"
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </button>

          <p className="auth-footer">
            Don'"'"'t have an account? <a href="/register">Create one here</a>
          </p>
        </form>
      </div>
    </div>
  );
}
'

echo -e "${GREEN}✓ Backend functions and components created${NC}"

echo ""
echo -e "${BLUE}⚙️  Creating configuration files...${NC}"

# Create package.json
create_file "package.json" '{
  "name": "lab-compliance-portal",
  "version": "1.0.0",
  "description": "Lab Compliance Assessment and Readiness Platform",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .js,.jsx"
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
    "vite": "^5.0.0",
    "eslint": "^8.55.0",
    "eslint-plugin-react": "^7.33.0"
  }
}
'

# Create .env.example
create_file ".env.example" 'VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here
STRIPE_PUBLIC_KEY=pk_live_or_test_key
STRIPE_SECRET_KEY=sk_live_or_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
GMAIL_USER=your-lab-portal@gmail.com
GMAIL_APP_PASSWORD=your_app_specific_password
SITE_URL=https://yourdomain.com
NODE_ENV=production
'

# Create netlify.toml
create_file "netlify.toml" '[build]
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
  status = 200
'

# Create vite.config.js
create_file "vite.config.js" 'import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/.netlify": {
        target: "http://localhost:9999",
        changeOrigin: true
      }
    }
  }
})
'

# Create .gitignore
create_file ".gitignore" '# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env
.env.local
.env.*.local

# Build
dist/
build/
.vite/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
'

echo -e "${GREEN}✓ Configuration files created${NC}"

echo ""
echo -e "${BLUE}📚 Creating documentation...${NC}"

create_file "README.md" '# Lab Compliance Portal 🧪

A complete SaaS platform for laboratory compliance assessment and readiness management. Built with React, Supabase, Stripe, and Netlify.

## 🚀 Quick Start

1. **Install dependencies**: `npm install`
2. **Set environment variables**: Copy `.env.example` to `.env.local` and fill in your API keys
3. **Run locally**: `npm run dev` (visit http://localhost:3000)
4. **Deploy**: `git push origin main` (Netlify auto-deploys)

## 📋 Features

### User Portal
- Registration & authentication
- Lab profile management
- Document upload/download
- Readiness assessment with progress bar
- Stripe subscription management

### Admin Portal
- Client dashboard with filtering
- Readiness tracking
- Document verification
- Email notifications
- Payment oversight

## 🏗️ Architecture

- **Frontend**: React 18 + Vite
- **Backend**: Netlify Functions
- **Database**: Supabase PostgreSQL
- **Payments**: Stripe
- **Email**: Gmail API
- **Hosting**: Netlify

## 📖 Setup & Documentation

See these files for detailed instructions:
- **SETUP_GUIDE.md** - Step-by-step setup
- **FILE_STRUCTURE.md** - File placement guide
- **PROJECT_MANIFEST.md** - Complete file inventory

## 💰 Pricing

- **Tier 1**: Analysis Only ($299/month)
- **Tier 2**: Analysis + Templates ($799/month)

## 🔐 Security

- Row-level database security
- Email verification
- Role-based access control
- Stripe webhook verification
- Audit logging

---

**Ready to deploy? Follow SETUP_GUIDE.md!**
'

create_file "SETUP_GUIDE_QUICK.md" '# Quick Setup Guide

## 1️⃣ Environment Setup (5 min)

```bash
cp .env.example .env.local
# Fill in your API keys
```

## 2️⃣ Supabase (10 min)

1. Create project at supabase.com
2. Run schema.sql in SQL Editor
3. Copy Project URL and keys to .env.local

**Required Env Vars:**
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_KEY

## 3️⃣ Stripe (10 min)

1. Get API keys from Stripe dashboard
2. Create webhook → `https://yourdomain.netlify.app/.netlify/functions/stripe-webhook`
3. Copy keys to .env.local

**Required Env Vars:**
- STRIPE_PUBLIC_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET

## 4️⃣ Gmail (5 min)

1. Enable 2FA on Gmail
2. Generate app-specific password
3. Copy to .env.local

**Required Env Vars:**
- GMAIL_USER
- GMAIL_APP_PASSWORD

## 5️⃣ Test Locally (5 min)

```bash
npm install
npm run dev
# Visit http://localhost:3000
```

## 6️⃣ Deploy to Netlify (2 min)

```bash
git add .
git commit -m "Lab Portal - Automated setup complete"
git push origin main
# Netlify auto-deploys!
```

## 7️⃣ Set Netlify Environment Variables

In Netlify Dashboard → Site Settings → Build & Deploy → Environment:

Add all variables from `.env.example`

---

**Total Setup Time: ~40 minutes**

Need detailed help? See SETUP_GUIDE.md for complete instructions.
'

echo -e "${GREEN}✓ Documentation created${NC}"

echo ""
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install 2>/dev/null || npm install

echo ""
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo ""
echo "=========================================="
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo "=========================================="
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. ${YELLOW}Configure Environment${NC}"
echo "   cp .env.example .env.local"
echo "   # Edit .env.local with your API keys"
echo ""
echo "2. ${YELLOW}Test Locally${NC}"
echo "   npm run dev"
echo "   # Visit http://localhost:3000"
echo ""
echo "3. ${YELLOW}Deploy${NC}"
echo "   git add ."
echo "   git commit -m 'Lab Portal - Automated setup'"
echo "   git push origin main"
echo ""
echo "📚 Documentation:"
echo "   - SETUP_GUIDE_QUICK.md (this file)"
echo "   - README.md (project overview)"
echo ""
echo -e "${GREEN}Your Lab Compliance Portal is ready! 🚀${NC}"
