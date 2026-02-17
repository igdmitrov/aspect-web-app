# Aspect Web App

A Node.js web application for Invoice and Payment Settlement in AspectCTRM.

## Features

- **Login Authentication**: Secure login using AspectCTRM credentials
- **Two-Grid Layout**: View Invoices and Payments side by side
- **Multi-Select**: Select multiple invoices and payments for allocation
- **Create Allocations**: Link payments to invoices with custom amounts
- **Filter & Search**: Filter by counterparty, currency, and status
- **Real-time Updates**: Refresh data with one click

## Prerequisites

1. **Node.js** (v16 or higher)
2. **AspectCTRM** server with webservice access
3. **Webservices deployed** in AspectCTRM (see below)

## Installation

```bash
cd aspect-web-app
npm install
```

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Edit `.env` with your AspectCTRM server details:
```
ASPECT_BASE_URL=http://your-aspect-server:60000
ASPECT_WEBSERVICE_PATH=/webservice/aspectrs
PORT=3000
SESSION_SECRET=your-secret-key
```

## Required AspectCTRM Webservices

Deploy these webservices in AspectCTRM (Services > Webservices):

1. **getInvoices** - Already exists in your system
2. **getPayments** - Use `webservice_getPayments.js`
3. **getLastMoneyAllocation** - Already exists in your system
4. **createAllocation** - Use `webservice_createAllocation.js`

### Deploying Webservices

1. Go to **Services > Webservices** in AspectCTRM
2. Click **Create Webservice**
3. Name: `getPayments` (or `createAllocation`)
4. Copy the script content from the corresponding `.js` file
5. Save and test

## Running the App

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

Then open http://localhost:3000 in your browser.

## Usage

1. **Login** with your AspectCTRM username and password
2. **Filter** by counterparty, currency, or status (Open/All)
3. **Select invoices** in the left grid
4. **Select payments** in the right grid
5. Optionally enter a specific **allocation amount**
6. Click **Create Allocation**

## Project Structure

```
aspect-web-app/
├── server.js           # Express server with auth
├── routes/
│   └── api.js          # API routes for AspectCTRM
├── public/
│   ├── index.html      # Main dashboard
│   ├── login.html      # Login page
│   ├── css/
│   │   └── styles.css  # Styling
│   └── js/
│       └── app.js      # Frontend logic
├── .env                # Configuration
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | Login with credentials |
| `/auth/logout` | POST | Logout |
| `/auth/user` | GET | Get current user |
| `/api/invoices` | GET | Get all invoices |
| `/api/invoices/unpaid` | GET | Get unpaid invoices |
| `/api/payments` | GET | Get all payments |
| `/api/payments/unallocated` | GET | Get unallocated payments |
| `/api/allocations` | GET | Get money allocations |
| `/api/allocations` | POST | Create allocation |
| `/api/allocations/:id` | DELETE | Delete allocation |

## Deployment on CentOS Stream 9

This guide supports deploying **multiple similar web apps** on the same VM.

**Architecture Overview:**
```
CentOS Stream 9 Server
├── /var/www/apps/
│   ├── aspect-web-app/        (Port 3001) → settlement.domain.com
│   ├── aspect-reports-app/    (Port 3002) → reports.domain.com
│   └── aspect-trading-app/    (Port 3003) → trading.domain.com
├── Nginx (reverse proxy, SSL termination)
├── Systemd (service management)
└── GitHub Actions (CI/CD)
```

### 1. System Preparation

```bash
# Update system
sudo dnf update -y

# Install EPEL repository
sudo dnf install -y epel-release

# Install required packages
sudo dnf install -y git curl wget firewalld
```

### 2. Install Node.js

```bash
# Install Node.js 20.x (LTS)
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Create Application User and Directory Structure

For deploying multiple web apps on the same VM:

```bash
# Create a dedicated user for all web apps
sudo useradd -r -m -s /bin/bash webapps

# Create apps directory structure
sudo mkdir -p /var/www/apps
sudo chown webapps:webapps /var/www/apps

# Switch to the user (for app setup)
sudo su - webapps
```

**Directory structure for multiple apps:**
```
/var/www/apps/
├── aspect-web-app/          # Port 3001
├── aspect-reports-app/       # Port 3002
├── aspect-trading-app/       # Port 3003
└── aspect-admin-app/         # Port 3004
```

### 4. Deploy the Application from GitHub

```bash
# As webapps user
cd /var/www/apps

# Option A: Public repository
git clone https://github.com/your-username/aspect-web-app.git

# Option B: Private repository with HTTPS (will prompt for credentials)
git clone https://github.com/your-username/aspect-web-app.git
# Enter your GitHub username and Personal Access Token (PAT) when prompted

# Option C: Private repository with SSH key
# First, generate SSH key as webapps user
ssh-keygen -t ed25519 -C "webapps@your-server"
cat ~/.ssh/id_ed25519.pub
# Add this public key to GitHub: Settings > SSH and GPG keys > New SSH key

# Then clone via SSH
git clone git@github.com:your-username/aspect-web-app.git

cd aspect-web-app

# Install dependencies
npm install --production
```

#### Setting up GitHub Personal Access Token (for private repos)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "CentOS Server Deploy"
4. Select scopes: `repo` (full control of private repositories)
5. Generate and copy the token

```bash
# Store credentials to avoid re-entering (as aspectapp user)
git config --global credential.helper store

# First pull will prompt for credentials, then they're saved
git pull
# Username: your-github-username
# Password: paste-your-personal-access-token
```

#### Alternative: Deploy via SCP (without Git on server)

From your local machine:
```bash
# Copy application files to server
scp -r aspect-web-app/ user@your-server:/tmp/

# SSH to server and move files
ssh user@your-server
sudo mv /tmp/aspect-web-app /var/www/apps/
sudo chown -R webapps:webapps /var/www/apps/aspect-web-app
```

### 5. Configure the Application

**Important:** Each app must use a unique PORT to avoid conflicts.

| App Name | Port |
|----------|------|
| aspect-web-app | 3001 |
| aspect-reports-app | 3002 |
| aspect-trading-app | 3003 |
| aspect-admin-app | 3004 |

```bash
# Create .env file (adjust PORT for each app)
cat > .env << 'EOF'
# AspectCTRM Server Configuration
ASPECT_BASE_URL=http://your-aspect-server:60000
ASPECT_WEBSERVICE_PATH=/webservice/aspectrs

# Server Configuration - USE UNIQUE PORT PER APP!
PORT=3001
SESSION_SECRET=generate-a-strong-secret-key-here
SESSION_TIMEOUT=1800000
EOF

# Generate a strong secret key (unique per app)
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env

# Exit webapps user
exit
```

### 6. Create Systemd Service

Create a separate service file for each app. Replace `APP_NAME` with your app name:

```bash
# Set app name variable (change this for each app)
APP_NAME="aspect-web-app"

# Create service file
sudo tee /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=${APP_NAME} - AspectCTRM Web Application
Documentation=https://github.com/your-repo
After=network.target

[Service]
Type=simple
User=webapps
Group=webapps
WorkingDirectory=/var/www/apps/${APP_NAME}
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${APP_NAME}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable ${APP_NAME}
sudo systemctl start ${APP_NAME}

# Check status
sudo systemctl status ${APP_NAME}
```

**Quick setup script for new apps:**

```bash
#!/bin/bash
# Usage: ./create-app-service.sh app-name
APP_NAME=$1

if [ -z "$APP_NAME" ]; then
  echo "Usage: $0 <app-name>"
  exit 1
fi

sudo tee /etc/systemd/system/${APP_NAME}.service << EOF
[Unit]
Description=${APP_NAME} - AspectCTRM Web Application
After=network.target

[Service]
Type=simple
User=webapps
Group=webapps
WorkingDirectory=/var/www/apps/${APP_NAME}
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${APP_NAME}
sudo systemctl start ${APP_NAME}
echo "Service ${APP_NAME} created and started!"
```

### 7. Configure Firewall

When using Nginx reverse proxy (recommended), you only need to open port 80/443:

```bash
# Start and enable firewalld
sudo systemctl enable --now firewalld

# With Nginx (recommended) - only open HTTP/HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Without Nginx - open ports for each app directly
# sudo firewall-cmd --permanent --add-port=3001/tcp
# sudo firewall-cmd --permanent --add-port=3002/tcp
# sudo firewall-cmd --permanent --add-port=3003/tcp
# sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

### 8. (Recommended) Setup Nginx Reverse Proxy for Multiple Apps

Use Nginx as a reverse proxy to route traffic to different apps via subdomains or paths:

```bash
# Install Nginx
sudo dnf install -y nginx
```

**Option A: Subdomain-based routing** (Recommended)

Each app gets its own subdomain:
- `settlement.yourdomain.com` → aspect-web-app (port 3001)
- `reports.yourdomain.com` → aspect-reports-app (port 3002)
- `trading.yourdomain.com` → aspect-trading-app (port 3003)

```bash
# Create a config file for each app
# App 1: aspect-web-app
sudo tee /etc/nginx/conf.d/aspect-web-app.conf << 'EOF'
server {
    listen 80;
    server_name settlement.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# App 2: aspect-reports-app
sudo tee /etc/nginx/conf.d/aspect-reports-app.conf << 'EOF'
server {
    listen 80;
    server_name reports.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
```

**Option B: Path-based routing**

All apps on one domain with different paths:
- `yourdomain.com/settlement/` → aspect-web-app (port 3001)
- `yourdomain.com/reports/` → aspect-reports-app (port 3002)

```bash
sudo tee /etc/nginx/conf.d/aspect-apps.conf << 'EOF'
server {
    listen 80;
    server_name yourdomain.com;

    # App 1: Settlement
    location /settlement/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # App 2: Reports
    location /reports/ {
        proxy_pass http://127.0.0.1:3002/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # App 3: Trading
    location /trading/ {
        proxy_pass http://127.0.0.1:3003/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

**Start Nginx:**

```bash
# Test configuration
sudo nginx -t

# Enable and start Nginx
sudo systemctl enable --now nginx

# Configure SELinux for proxy
sudo setsebool -P httpd_can_network_connect 1
```

### 9. (Optional) SSL with Let's Encrypt

**For subdomain-based setup:**
```bash
# Install certbot
sudo dnf install -y certbot python3-certbot-nginx

# Obtain certificates for all subdomains
sudo certbot --nginx -d settlement.yourdomain.com -d reports.yourdomain.com -d trading.yourdomain.com

# Auto-renewal is configured automatically
sudo systemctl enable --now certbot-renew.timer
```

**For single domain with paths:**
```bash
sudo certbot --nginx -d yourdomain.com
```

### 10. Useful Commands

Replace `APP_NAME` with your app name (e.g., `aspect-web-app`):

```bash
# Set app name
APP_NAME="aspect-web-app"

# View logs
sudo journalctl -u ${APP_NAME} -f

# Restart service
sudo systemctl restart ${APP_NAME}

# Stop service
sudo systemctl stop ${APP_NAME}

# Start service
sudo systemctl start ${APP_NAME}

# Check status
sudo systemctl status ${APP_NAME}

# List all aspect apps
sudo systemctl list-units --type=service | grep aspect

# Check all app ports
sudo ss -tlnp | grep -E '300[1-9]'

# Restart all apps
for svc in aspect-web-app aspect-reports-app aspect-trading-app; do
  sudo systemctl restart $svc 2>/dev/null && echo "Restarted $svc"
done
```

### 11. Update Application from GitHub

```bash
# Set app name
APP_NAME="aspect-web-app"

# Stop service
sudo systemctl stop ${APP_NAME}

# Update code (as webapps user)
sudo su - webapps
cd /var/www/apps/${APP_NAME}

# Pull latest changes from GitHub
git pull origin main

# Update dependencies (if package.json changed)
npm install --production

# Exit and restart
exit
sudo systemctl start ${APP_NAME}

# Verify service is running
sudo systemctl status ${APP_NAME}
```

#### Automated Deployment Script

Create a reusable deployment script for any app:

```bash
# Create deploy script
sudo tee /var/www/apps/deploy.sh << 'EOF'
#!/bin/bash
set -e

APP_NAME=$1

if [ -z "$APP_NAME" ]; then
  echo "Usage: $0 <app-name>"
  echo "Example: $0 aspect-web-app"
  exit 1
fi

APP_DIR="/var/www/apps/${APP_NAME}"

if [ ! -d "$APP_DIR" ]; then
  echo "Error: App directory $APP_DIR does not exist"
  exit 1
fi

echo "Stopping ${APP_NAME}..."
sudo systemctl stop ${APP_NAME}

echo "Pulling latest code..."
cd ${APP_DIR}
git pull origin main

echo "Installing dependencies..."
npm install --production

echo "Starting ${APP_NAME}..."
sudo systemctl start ${APP_NAME}

echo "Deployment complete!"
sudo systemctl status ${APP_NAME} --no-pager
EOF

sudo chown webapps:webapps /var/www/apps/deploy.sh
sudo chmod +x /var/www/apps/deploy.sh

# Usage:
sudo -u webapps /var/www/apps/deploy.sh aspect-web-app
```

## CI/CD with GitHub Actions

Automate deployments when you push to the main branch.

Since your server is behind VPN, use a **Self-Hosted Runner** - it connects OUT to GitHub (no incoming connections needed).

```
┌─────────────────────────────────────────────────────────────────────┐
│              SELF-HOSTED RUNNER (VPN-friendly!)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   YOUR SERVER (behind VPN)              GITHUB (cloud)              │
│   ────────────────────────              ──────────────              │
│                                                                     │
│   GitHub Runner ─────────────────────► Connects OUT to GitHub       │
│   (installed on your server)           (only outbound, no inbound!) │
│         │                                                           │
│         │  When you push:                                           │
│         │  1. GitHub tells runner "new job!"                        │
│         │  2. Runner pulls the code                                 │
│         │  3. Runner runs deployment locally                        │
│         │  4. Done! No SSH needed                                   │
│         ▼                                                           │
│   Deploys locally                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1. Install Self-Hosted Runner on Your Server

```bash
# Login to your CentOS server (via VPN)
# As root or sudo user

# Create runner directory
sudo mkdir -p /opt/actions-runner
sudo chown webapps:webapps /opt/actions-runner
cd /opt/actions-runner

# Download latest runner (check GitHub for latest version)
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz

# Extract
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Install dependencies
sudo ./bin/installdependencies.sh
```

### 2. Register Runner with GitHub

Go to your GitHub repository:
1. **Settings** → **Actions** → **Runners** → **New self-hosted runner**
2. Select **Linux** and **x64**
3. Copy the token shown on the page

```bash
# On your server, as webapps user
sudo su - webapps
cd /opt/actions-runner

# Configure (replace YOUR_TOKEN with the token from GitHub)
./config.sh --url https://github.com/YOUR_USERNAME/aspect-web-app --token YOUR_TOKEN

# When prompted:
# - Runner group: press Enter (default)
# - Runner name: press Enter (default) or enter a name like "centos-server"
# - Labels: enter "self-hosted,linux,x64,production"
# - Work folder: press Enter (default)
```

### 3. Install Runner as Service

```bash
# Install and start service (as root/sudo)
sudo ./svc.sh install webapps
sudo ./svc.sh start

# Check status
sudo ./svc.sh status

# The runner will auto-start on boot
```

### 4. Update Workflow for Self-Hosted Runner

Update `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:

env:
  APP_NAME: aspect-web-app
  APP_DIR: /var/www/apps/aspect-web-app

jobs:
  deploy:
    # Use self-hosted runner instead of GitHub's servers
    runs-on: [self-hosted, linux, production]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Deploy application
        run: |
          echo "📦 Copying code to app directory..."
          rsync -av --delete --exclude='.git' --exclude='node_modules' \
            $GITHUB_WORKSPACE/ ${{ env.APP_DIR }}/
          
          echo "📥 Installing dependencies..."
          cd ${{ env.APP_DIR }}
          npm install --production
          
          echo "🔄 Restarting service..."
          sudo /bin/systemctl restart ${{ env.APP_NAME }}
          
          echo "✅ Deployment complete!"

      - name: Verify deployment
        run: |
          sleep 3
          if sudo /bin/systemctl is-active --quiet ${{ env.APP_NAME }}; then
            echo "✅ ${{ env.APP_NAME }} is running"
          else
            echo "❌ ${{ env.APP_NAME }} failed to start"
            sudo /bin/systemctl status ${{ env.APP_NAME }} --no-pager
            exit 1
          fi
```

### 5. Verify Runner is Connected

Go to GitHub: **Settings** → **Actions** → **Runners**

You should see your runner with a green "Idle" status.

---

## Option B: Standard GitHub Actions (For Public Servers)

If your server is accessible from the internet, use SSH-based deployment.

### How It Works (No Installation Required!)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         HOW GITHUB ACTIONS WORKS                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   YOU (developer)              GITHUB (cloud)         YOUR SERVER   │
│   ──────────────              ──────────────         ────────────   │
│                                                                     │
│   1. git push ──────────────► GitHub receives                       │
│                               your code                             │
│                                     │                               │
│                                     ▼                               │
│                               2. GitHub Actions                     │
│                                  starts automatically               │
│                                  (runs on GitHub's                  │
│                                   servers, NOT yours)               │
│                                     │                               │
│                                     ▼                               │
│                               3. GitHub connects ───────► SSH       │
│                                  via SSH to your          │         │
│                                  server                   ▼         │
│                                                     4. Pulls code   │
│                                                        runs npm     │
│                                                        restarts app │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**What you need to install:**

| Location | What to Install |
|----------|-----------------|
| **GitHub** (cloud) | Nothing - it's already there! |
| **Your CentOS Server** | Only SSH server (already installed by default) |

**That's it!** GitHub Actions runs on GitHub's infrastructure. It connects to your server via SSH (like you do from your laptop) and runs commands remotely.

### 1. Server Preparation (Only SSH Setup)

Your server just needs SSH access enabled and an SSH key for GitHub to use:

```bash
# On your CentOS server, create SSH key for GitHub Actions
sudo su - webapps
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Copy the PRIVATE key (you'll paste this into GitHub)
cat ~/.ssh/github_actions
# Copy the ENTIRE output including -----BEGIN/END-----

exit
```

Allow webapps to restart services without password (for all apps):

```bash
# Add sudoers rule for all apps
sudo tee /etc/sudoers.d/webapps << 'EOF'
webapps ALL=(ALL) NOPASSWD: /bin/systemctl stop aspect-*
webapps ALL=(ALL) NOPASSWD: /bin/systemctl start aspect-*
webapps ALL=(ALL) NOPASSWD: /bin/systemctl restart aspect-*
webapps ALL=(ALL) NOPASSWD: /bin/systemctl status aspect-*
webapps ALL=(ALL) NOPASSWD: /bin/systemctl is-active aspect-*
EOF

sudo chmod 440 /etc/sudoers.d/webapps
```

### 2. Add Secrets to GitHub (One Time Setup)

Go to your GitHub repository in browser:

1. Click **Settings** (tab at top)
2. Click **Secrets and variables** (left sidebar)
3. Click **Actions**
4. Click **New repository secret**
5. Add each secret below:

| Secret Name | What to Enter |
|-------------|---------------|
| `SERVER_HOST` | Your server IP (e.g., `192.168.1.100` or `myserver.com`) |
| `SERVER_USER` | `webapps` |
| `SERVER_SSH_KEY` | Paste the ENTIRE private key from step 1 (including `-----BEGIN...` and `-----END...` lines) |
| `SERVER_PORT` | `22` (or your SSH port if different) |

**Note:** These secrets are encrypted. GitHub uses them to connect to your server.

### 3. Create Workflow File in Your Repository

Create file `.github/workflows/deploy.yml` in **your local project** (not on server!).

This file tells GitHub what to do when you push code.

**Important:** Change `APP_NAME` and `APP_DIR` for each app:

```yaml
name: Deploy to Production

on:
  push:
    branches:
      - main
  workflow_dispatch:  # Allow manual trigger

env:
  # ⚠️ CHANGE THESE FOR EACH APP REPOSITORY
  APP_NAME: aspect-web-app        # Service name
  APP_DIR: /var/www/apps/aspect-web-app  # Server path

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test --if-present

      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          port: ${{ secrets.SERVER_PORT }}
          script: |
            APP_NAME="${{ env.APP_NAME }}"
            APP_DIR="${{ env.APP_DIR }}"
            
            cd ${APP_DIR}
            
            echo "📦 Pulling latest code for ${APP_NAME}..."
            git fetch origin main
            git reset --hard origin/main
            
            echo "📥 Installing dependencies..."
            npm install --production
            
            echo "🔄 Restarting ${APP_NAME}..."
            sudo /bin/systemctl restart ${APP_NAME}
            
            echo "✅ Deployment complete!"

      - name: Verify deployment
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          port: ${{ secrets.SERVER_PORT }}
          script: |
            APP_NAME="${{ env.APP_NAME }}"
            sleep 3
            if sudo /bin/systemctl is-active --quiet ${APP_NAME}; then
              echo "✅ ${APP_NAME} is running"
            else
              echo "❌ ${APP_NAME} failed to start"
              exit 1
            fi
```

**Example settings for different apps:**

| Repository | APP_NAME | APP_DIR |
|------------|----------|---------|
| aspect-web-app | `aspect-web-app` | `/var/www/apps/aspect-web-app` |
| aspect-reports | `aspect-reports-app` | `/var/www/apps/aspect-reports-app` |
| aspect-trading | `aspect-trading-app` | `/var/www/apps/aspect-trading-app` |

### 4. (Optional) Add Staging Environment

```yaml
name: Deploy

on:
  push:
    branches:
      - main
      - develop

env:
  APP_NAME: aspect-web-app
  APP_DIR: /var/www/apps/aspect-web-app

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "host=${{ secrets.PROD_SERVER_HOST }}" >> $GITHUB_OUTPUT
          else
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "host=${{ secrets.STAGING_SERVER_HOST }}" >> $GITHUB_OUTPUT
          fi

      - name: Deploy to ${{ steps.env.outputs.environment }}
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ steps.env.outputs.host }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          port: ${{ secrets.SERVER_PORT }}
          script: |
            APP_NAME="${{ env.APP_NAME }}"
            APP_DIR="${{ env.APP_DIR }}"
            
            cd ${APP_DIR}
            git fetch origin ${{ github.ref_name }}
            git reset --hard origin/${{ github.ref_name }}
            npm install --production
            sudo /bin/systemctl restart ${APP_NAME}
```

### 5. (Optional) Slack/Discord Notifications

Add to your workflow:

```yaml
      - name: Notify on success
        if: success()
        uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: |
            {
              "text": "✅ Deployment successful!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "✅ *Aspect Web App* deployed to production\nCommit: `${{ github.sha }}`\nBy: ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1.25.0
        with:
          payload: |
            {
              "text": "❌ Deployment failed!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "❌ *Aspect Web App* deployment failed\nCommit: `${{ github.sha }}`\nBy: ${{ github.actor }}\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View logs>"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### 6. Workflow Status Badge

Add to your README.md:

```markdown
![Deploy](https://github.com/your-username/aspect-web-app/actions/workflows/deploy.yml/badge.svg)
```

### CI/CD Workflow Summary

**What happens when you `git push`:**

1. **Push to `main`** → GitHub detects the push
2. **GitHub Actions starts** → Runs on GitHub's servers (not yours!)
3. **SSH to your server** → GitHub connects using the SSH key you provided
4. **Pulls latest code** → `git pull` on your server
5. **Install deps** → `npm install --production`
6. **Restart service** → `systemctl restart`
7. **Verify** → Checks service is healthy

### Quick Checklist

**For VPN/Private Servers (Self-Hosted Runner):**

On your CentOS server (one time):
- [ ] Install GitHub Actions Runner (`/opt/actions-runner`)
- [ ] Register runner with your GitHub repository
- [ ] Install runner as systemd service
- [ ] Add sudoers rule for passwordless service restart
- [ ] Install rsync: `sudo dnf install -y rsync`

On GitHub (one time per repository):
- [ ] Create `.github/workflows/deploy.yml` with `runs-on: [self-hosted, linux, production]`
- [ ] Verify runner shows "Idle" status in Settings → Actions → Runners

**For Public Servers (SSH-based):**

On your CentOS server (one time):
- [ ] SSH server running (default: yes)
- [ ] Create SSH key: `ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N ""`
- [ ] Add public key: `cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys`
- [ ] Copy private key: `cat ~/.ssh/github_actions`
- [ ] Add sudoers rule for passwordless service restart

On GitHub (one time per repository):
- [ ] Add secret `SERVER_HOST` (your server IP)
- [ ] Add secret `SERVER_USER` (`webapps`)
- [ ] Add secret `SERVER_SSH_KEY` (paste entire private key)
- [ ] Add secret `SERVER_PORT` (`22`)
- [ ] Create `.github/workflows/deploy.yml` file

**That's it! Now every `git push` auto-deploys.**

## Troubleshooting

### Self-Hosted Runner Issues

**Runner shows "Offline" in GitHub:**
```bash
# Check runner service status
sudo /opt/actions-runner/svc.sh status

# Restart runner
sudo /opt/actions-runner/svc.sh stop
sudo /opt/actions-runner/svc.sh start

# Check logs
journalctl -u actions.runner.* -f
```

**"Permission denied" during deployment:**
```bash
# Ensure webapps owns app directory
sudo chown -R webapps:webapps /var/www/apps

# Ensure sudoers rule is correct
sudo visudo -cf /etc/sudoers.d/webapps
```

**rsync not found:**
```bash
sudo dnf install -y rsync
```

### Application Issues

### "Unable to connect to AspectCTRM server"
- Check `ASPECT_BASE_URL` in `.env`
- Ensure AspectCTRM server is running
- Check network connectivity

### "Invalid credentials"
- Verify username/password
- Check user has webservice access in AspectCTRM

### "Failed to fetch payments"
- Ensure `getPayments` webservice is deployed
- Check webservice permissions

## License

Internal use only - AspectCTRM integration
