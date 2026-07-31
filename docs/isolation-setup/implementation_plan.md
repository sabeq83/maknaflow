# Plan: Caddy Routing & Tailscale MagicDNS SSL Setup

Provide a secure reverse-proxy configuration using Caddy on Node 1 Gateway (`nuc-desktop.tail8194e4.ts.net`) to route both **MAKNA Grid** and **MAKNA Flow** using automatic HTTPS certificates.

---

## User Review Required

> [!IMPORTANT]
> 1. **Sudo Privileges for Caddy Installation:** Installing Caddy and binding to port `443` requires superuser (`sudo`) privileges on Node 1. The script will ask for your sudo password when run.
> 2. **Port Conflict Check:** If any process (like an old nginx or apache) is currently listening on port `8443` or `443` on Node 1, it must be stopped before starting Caddy.

---

## Proposed Routing Architecture

We will route incoming HTTPS requests using Tailscale MagicDNS (`nuc-desktop.tail8194e4.ts.net`) to internal app ports:

| External URL & Port | Internal Target | Target Application | Certificate Provider |
| :--- | :--- | :--- | :--- |
| `https://nuc-desktop.tail8194e4.ts.net` (Port 443) | `127.0.0.1:3000` | MAKNA Grid Production | Tailscale MagicDNS SSL |
| `https://nuc-desktop.tail8194e4.ts.net:8443` | `127.0.0.1:5000` | MAKNA Flow Production | Tailscale MagicDNS SSL |

---

## Execution Task List

- [x] Create Caddy configuration template (`Caddyfile.production`)
- [x] Create Caddy installation script (`scripts/install-caddy.sh`)
- [x] Run Caddy installation and configuration script on Node 1 Gateway
- [x] Verify Caddy server routing and SSL health

---

## Proposed Changes

### [NEW] [Caddyfile.production](file:///Users/sabeqmmursyid/_maknaflow/Caddyfile.production)
Template for the Caddy configuration file:
```caddy
# ==============================================================================
# Caddyfile for Node 1 Gateway (MAKNA Grid & MAKNA Flow)
# Path: /etc/caddy/Caddyfile
# ==============================================================================

# MAKNA Grid Production
nuc-desktop.tail8194e4.ts.net {
    reverse_proxy 127.0.0.1:3000
    
    # Enable automatic Tailscale MagicDNS SSL
    tls {
        get_certificate tailscale
    }
}

# MAKNA Flow Production
nuc-desktop.tail8194e4.ts.net:8443 {
    reverse_proxy 127.0.0.1:5000
    
    # Enable automatic Tailscale MagicDNS SSL
    tls {
        get_certificate tailscale
    }
}
```

### [NEW] [install-caddy.sh](file:///Users/sabeqmmursyid/_maknaflow/scripts/install-caddy.sh)
Script to install Caddy on Node 1, deploy the configuration, and enable Caddy socket access for Tailscale:
```bash
#!/bin/bash
# ==============================================================================
# Script to install and configure Caddy for Tailscale MagicDNS on Node 1
# ==============================================================================

set -e

echo "🔒 [1/4] Installing Caddy package from official repository..."
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy

echo "📝 [2/4] Deploying Caddyfile configuration..."
sudo cp Caddyfile.production /etc/caddy/Caddyfile

echo "🔑 [3/4] Configuring Tailscale local socket access permissions..."
# Allow caddy to fetch certificates from the Tailscale socket
sudo usermod -aG tailscale caddy || true

echo "🔄 [4/4] Restarting Caddy service..."
sudo systemctl restart caddy

echo "🎉 Caddy configuration and installation complete!"
```

---

## Verification Plan

### Manual Verification
1. Access `https://nuc-desktop.tail8194e4.ts.net` via browser on local/WAN network to verify MAKNA Grid redirects cleanly over HTTPS.
2. Access `https://nuc-desktop.tail8194e4.ts.net:8443` via browser to verify MAKNA Flow redirects cleanly over HTTPS with a valid certificate.
