# Live-data API

Python (Flask) service behind the website's Holdings analyzer. Uses `yfinance` for prices, dividends and option chains.

## Run locally (Mac)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python app.py            # open http://localhost:8000  (serves the site and the API)
```
## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/stock?ticker=KO&shares=200&horizon=monthly` | Dividend and covered-call scope for one stock |
| POST | `/api/portfolio` (file, horizon) | Analyze an uploaded `.xlsx`/`.csv` |
| POST | `/api/export` (file, horizon) | Same analysis as a colour-coded Excel report |
| GET | `/api/template.xlsx` | Input template |

`horizon` is `weekly` (~7 days), `monthly` (~30) or `quarterly` (~90); the expiration closest to that is used.

## Input format
Sheet named `Input` (or first sheet) or a CSV with columns `Institution` (optional), `Ticker`, `Quantity`.

## Behavior changes from the notebook
- Expiration is selectable (the notebook used the first expiry within 7 days).
- Earnings detection works with current yfinance (`calendar` is now a dict; the old check silently failed).
- Ex-dividend risk is flagged between today and expiry; ETFs without `currentPrice` use `regularMarketPrice`.
- Dividend yield is computed as dividend / price. Colouring finds columns by header, not by letter.
- The hard-coded ORCL exclusion is now `EXCLUDE_TICKERS` (comma-separated environment variable, default empty).
- `batch_cli.py` keeps the original Excel-in/Excel-out workflow.

Limits: 60 rows per upload, 2 MB files, 30 API requests per minute per IP. Market data is delayed and unofficial; verify at your broker before trading.

## Production (Oracle instance)
`sudo bash deploy.sh` installs this API into `/opt/stockhub-api`, runs it with gunicorn as the `stockhub-api` systemd service on 127.0.0.1:8000, and nginx proxies `/api/` to it.
Check it: `systemctl status stockhub-api` and `curl http://localhost/api/health`. Logs: `journalctl -u stockhub-api -n 50`.
To exclude tickers: edit `Environment=EXCLUDE_TICKERS=ORCL` in `/etc/systemd/system/stockhub-api.service`, then `sudo systemctl daemon-reload && sudo systemctl restart stockhub-api`.
