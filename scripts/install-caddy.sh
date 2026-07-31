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
sudo mkdir -p /var/log/caddy
sudo chown -R caddy:caddy /var/log/caddy
sudo cp Caddyfile.production /etc/caddy/Caddyfile

echo "🔑 [3/4] Configuring Tailscale local socket access permissions..."
# Allow caddy to fetch certificates from the Tailscale socket
sudo usermod -aG tailscale caddy || true

echo "🔄 [4/4] Restarting Caddy service..."
sudo systemctl restart caddy

echo "🎉 Caddy configuration and installation complete!"
