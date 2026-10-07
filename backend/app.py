"""Flask API for the Stock Investing Hub analyzer. Run locally: python app.py  ->  http://localhost:8000"""
import io, os, time
from collections import defaultdict, deque

import pandas as pd
from flask import Flask, jsonify, request, send_file

import analysis as A

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "site"))
app = Flask(__name__, static_folder=SITE, static_url_path="")      # also serves the website for local testing
app.config["MAX_CONTENT_LENGTH"] = 2 * 1024 * 1024
_hits = defaultdict(deque)
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@app.before_request
def rate_limit():
    if not request.path.startswith("/api/"):
        return None
    ip, now = request.headers.get("X-Real-IP", request.remote_addr), time.time()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= 30:
        return jsonify(error="Too many requests. Please wait a minute."), 429
    q.append(now)
    return None


def horizon():
    h = (request.values.get("horizon") or "weekly").lower()
    return h if h in A.HORIZONS else "weekly"


def read_upload():
    f = request.files.get("file")
    if not f or not f.filename:
        raise ValueError("Attach a .xlsx or .csv file.")
    name = f.filename.lower()
    raw = io.BytesIO(f.read())                       # pandas needs a seekable buffer, not the upload stream
    if name.endswith(".csv"):
        return pd.read_csv(raw, encoding="utf-8-sig")  # utf-8-sig handles the BOM that Excel adds to CSVs
    if name.endswith(".xlsx"):
        x = pd.ExcelFile(raw)
        return x.parse("Input" if "Input" in x.sheet_names else x.sheet_names[0])
    raise ValueError("Unsupported file type. Use .xlsx or .csv.")


@app.after_request
def local_cors(resp):
    """Lets the page work when served by a plain local file server (e.g. port 8080) while this API runs on 8000."""
    o = request.headers.get("Origin", "")
    if o.startswith(("http://localhost", "http://127.0.0.1")):
        resp.headers["Access-Control-Allow-Origin"] = o
    return resp


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.get("/api/health")
def health():
    return jsonify(ok=True, horizons=list(A.HORIZONS))


@app.get("/api/stock")
def stock():
    t = (request.args.get("ticker") or "").strip().upper()
    if not A.TICKER_RE.match(t):
        return jsonify(error="Enter a valid ticker, for example KO."), 400
    try:
        qty = int(request.args.get("shares", "100"))
        assert 1 <= qty <= 10_000_000
    except (ValueError, AssertionError):
        return jsonify(error="Shares must be a whole number of at least 1."), 400
    try:
        return jsonify(A.analyze_single(t, qty, horizon()))
    except LookupError as e:
        return jsonify(error=str(e)), 404
    except Exception:
        return jsonify(error="The market data provider did not respond. Try again shortly."), 502


@app.post("/api/portfolio")
def portfolio():
    try:
        return jsonify(A.to_json(A.analyze_portfolio(read_upload(), horizon())))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    except Exception:
        return jsonify(error="Could not read that file or reach the market data provider."), 502


@app.post("/api/export")
def export():
    try:
        data = A.to_workbook(A.analyze_portfolio(read_upload(), horizon()))
    except ValueError as e:
        return jsonify(error=str(e)), 400
    except Exception:
        return jsonify(error="Could not build the report."), 502
    return send_file(io.BytesIO(data), as_attachment=True, download_name="stocks_output.xlsx", mimetype=XLSX)


@app.get("/api/template.xlsx")
def template():
    buf = io.BytesIO()
    pd.DataFrame({"Institution": ["Fidelity", "Schwab", "Fidelity"], "Ticker": ["KO", "JNJ", "AAPL"],
                  "Quantity": [200, 100, 50]}).to_excel(buf, sheet_name="Input", index=False)
    buf.seek(0)
    return send_file(buf, as_attachment=True, download_name="stocks_input_template.xlsx", mimetype=XLSX)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "8000")))
