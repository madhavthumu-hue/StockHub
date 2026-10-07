# Stock Investing Hub: OCI Compute deployment

A static site (one `index.html`, no backend, no database, no external calls) served by nginx.
Works on Ubuntu or Oracle Linux, on x86 (AMD/Intel) or Arm (Ampere A1), including Always Free shapes.

## Contents
- `site/index.html` the website
- `deploy.sh` one-command installer (nginx, config, firewall, optional HTTPS)
- `nginx/nginx.conf.template` hardened nginx config
- `Dockerfile`/`docker-compose.yml` optional container route

## 1. Create the instance
OCI Console > Compute > Instances > Create. Pick Ubuntu 22.04/24.04 or Oracle Linux 8/9, give it a **public IPv4 address**, and add your SSH key.

## 2. Open ports in the OCI network (most common cause of "site not loading")
Networking > Virtual Cloud Networks > your VCN > Subnet > Security List (or your NSG) > **Add Ingress Rules**:
| Source CIDR | Protocol | Dest. port |
|---|---|---|
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

The script opens the OS firewall for you; this step is the cloud-side firewall and must be done in the console.

## 3. Copy and deploy
```bash
scp -i <key> stock-hub-oci.zip ubuntu@<public-ip>:~     # user is opc on Oracle Linux
ssh -i <key> ubuntu@<public-ip>
sudo apt-get install -y unzip || sudo dnf install -y unzip
unzip stock-hub-oci.zip && cd stock-hub-oci
sudo bash deploy.sh
```
Browse to `http://<public-ip>/`. Health check: `curl http://localhost/healthz` returns `ok`.

## 4. Optional: domain and free HTTPS
1. Point a DNS **A record** for your domain at the instance's public IP (use a Reserved Public IP so it survives restarts).
2. Re-run: `sudo DOMAIN=invest.example.com EMAIL=you@example.com bash deploy.sh`
Certbot installs a Let's Encrypt certificate and sets up auto-renewal and HTTP-to-HTTPS redirect.
On Oracle Linux, if `certbot` is not in your repos, enable EPEL or install via snap, then run `sudo certbot --nginx -d <domain>`.

## 5. Updating the site
Replace `site/index.html`, then `sudo cp -r site/. /var/www/stock-hub/` (no restart needed).

## Docker alternative
```bash
sudo apt-get install -y docker.io docker-compose-v2   # or install Docker on Oracle Linux
sudo docker compose up -d --build
```
Still requires step 2 (OCI ingress rules).

## Troubleshooting
- **Timeout from the internet, works via `curl localhost`:** OCI ingress rule missing (step 2) or an instance firewall rule is below a REJECT line (`sudo iptables -L INPUT -n --line-numbers`).
- **403 on Oracle Linux:** SELinux label. Run `sudo chcon -R -t httpd_sys_content_t /var/www/stock-hub`.
- **nginx fails to start:** `sudo nginx -t` and `sudo journalctl -u nginx -n 50`. The original config is saved at `/etc/nginx/nginx.conf.bak.stock-hub`.
- **Page uses no external services**, so the restrictive Content-Security-Policy in the config is safe; edit it if you add analytics or fonts.

## Notes
- Visitors' CSV files are processed in their browser and never reach your server.
- The content is educational. Keep the disclaimers visible, and consider legal review before public launch.
