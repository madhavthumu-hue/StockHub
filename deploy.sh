#!/usr/bin/env bash
# Deploys Stock Investing Hub on an OCI Compute instance (Ubuntu or Oracle Linux / RHEL family).
# Usage:  sudo bash deploy.sh
#         sudo DOMAIN=invest.example.com EMAIL=you@example.com bash deploy.sh   # adds free HTTPS
set -euo pipefail
DOMAIN="${DOMAIN:-}"; EMAIL="${EMAIL:-}"
WEBROOT=/var/www/stock-hub
HERE="$(cd "$(dirname "$0")" && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo."; exit 1; }

echo "==> Installing nginx"
if command -v apt-get >/dev/null; then
  PM=apt; NGUSER=www-data
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y && apt-get install -y nginx curl
elif command -v dnf >/dev/null; then
  PM=dnf; NGUSER=nginx; dnf install -y nginx curl
elif command -v yum >/dev/null; then
  PM=yum; NGUSER=nginx; yum install -y nginx curl
else
  echo "Unsupported OS: need apt, dnf or yum."; exit 1
fi

echo "==> Publishing site to $WEBROOT"
mkdir -p "$WEBROOT"
cp -r "$HERE"/site/. "$WEBROOT"/
chown -R "$NGUSER":"$NGUSER" "$WEBROOT"; chmod -R a+rX "$WEBROOT"
if command -v getenforce >/dev/null && [ "$(getenforce)" != "Disabled" ]; then
  echo "==> SELinux enabled: labeling web root"
  chcon -R -t httpd_sys_content_t "$WEBROOT" || true
fi

echo "==> Configuring nginx"
[ -f /etc/nginx/nginx.conf.bak.stock-hub ] || cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak.stock-hub
sed -e "s/__NGINX_USER__/$NGUSER/" -e "s/__SERVER_NAME__/${DOMAIN:-_}/" \
  "$HERE/nginx/nginx.conf.template" > /etc/nginx/nginx.conf
nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Installing the live-data API (Python)"
if [ "$PM" = apt ]; then apt-get install -y python3 python3-venv python3-pip; else $PM install -y python3 python3-pip; fi
API=/opt/stockhub-api
mkdir -p "$API"; cp -r "$HERE"/backend/. "$API"/
python3 -m venv "$API/.venv"
"$API/.venv/bin/pip" install --upgrade pip -q
"$API/.venv/bin/pip" install -r "$API/requirements.txt" -q
chown -R "$NGUSER":"$NGUSER" "$API"
cat > /etc/systemd/system/stockhub-api.service <<UNIT
[Unit]
Description=Stock Investing Hub API
After=network-online.target
[Service]
User=$NGUSER
WorkingDirectory=$API
Environment=HOME=$API
Environment=EXCLUDE_TICKERS=
ExecStart=$API/.venv/bin/gunicorn -w 2 -b 127.0.0.1:8000 --timeout 180 app:app
Restart=always
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now stockhub-api
systemctl restart stockhub-api
if command -v setsebool >/dev/null; then setsebool -P httpd_can_network_connect 1 || true; fi

echo "==> Opening ports 80/443 in the OS firewall"
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http --add-service=https && firewall-cmd --reload
elif command -v iptables >/dev/null; then
  for port in 80 443; do
    if ! iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null; then
      pos="$(iptables -L INPUT --line-numbers -n | awk '/REJECT/{print $1; exit}')"
      if [ -n "$pos" ]; then iptables -I INPUT "$pos" -p tcp --dport "$port" -j ACCEPT
      else iptables -A INPUT -p tcp --dport "$port" -j ACCEPT; fi
    fi
  done
  if command -v netfilter-persistent >/dev/null; then netfilter-persistent save
  elif command -v service >/dev/null && [ -f /etc/sysconfig/iptables ]; then service iptables save
  elif [ -d /etc/iptables ]; then iptables-save > /etc/iptables/rules.v4; fi
fi

if [ -n "$DOMAIN" ] && [ -n "$EMAIL" ]; then
  echo "==> Enabling HTTPS for $DOMAIN (DNS A record must already point here)"
  if [ "$PM" = apt ]; then apt-get install -y certbot python3-certbot-nginx
  else $PM install -y certbot python3-certbot-nginx || { echo "Install certbot manually (see README), then run: certbot --nginx -d $DOMAIN"; exit 0; }; fi
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive --redirect
fi

IP="$(curl -s --max-time 4 https://ifconfig.me || true)"
echo; echo "Done. Local check:  curl -I http://localhost/healthz"
echo "Open: http://${DOMAIN:-${IP:-<public-ip>}}/   (if it times out, add the OCI ingress rules; see README step 2)"
