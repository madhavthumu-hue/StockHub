"""Offline tests with a fake yfinance. Run: python tests/test_api.py (after pip install -r backend/requirements.txt)"""
import io, os, sys
from datetime import date, timedelta
import pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import analysis as A
import app as web


class Fake:
    def __init__(self, t):
        self.info = {"currentPrice": 50.0, "dividendRate": 2.0, "shortName": t,
                     "exDividendDate": int((pd.Timestamp.today() + pd.Timedelta(days=3)).timestamp()),
                     "dividendDate": int((pd.Timestamp.today() + pd.Timedelta(days=20)).timestamp())}
        self.calendar = {"Earnings Date": [date.today() + timedelta(days=60)]}
        self.options = tuple((date.today() + timedelta(days=d)).isoformat() for d in (7, 30, 90))

    def option_chain(self, e):
        class C: pass
        c = C()
        c.calls = pd.DataFrame({"strike": [48, 52, 53, 55], "lastPrice": [3.0, 1.2, 0.9, 0.4], "bid": [2.9, 1.1, .8, .3],
                                "ask": [3.1, 1.3, 1.0, .5], "volume": [100, 200, 300, 50], "openInterest": [500, 900, 800, 400],
                                "impliedVolatility": [.3, .3, .3, .3]})
        return c


A.yf.Ticker = Fake


def test_all():
    s = A.analyze_single("KO", 200, "monthly")
    assert s["calls"][0]["Days"] == 30 and s["Contracts"] == 2 and s["Dividend"]["Dividend Yield %"] == 4.0 and s["Price"] == 50.0
    assert s["calls"][0]["Dividend Risk"] is True and all(c["Strike"] > 50 for c in s["calls"]) and "Max Gain If Called" in s["calls"][0]
    x = A.analyze_single("KO", 250, "weekly")
    assert x["Contracts"] == 2 and x["Leftover Shares"] == 50
    assert A.analyze_single("KO", 40, "weekly")["Contracts"] == 0
    c = web.app.test_client()
    assert c.get("/api/health").json["ok"]
    assert c.get("/api/stock?ticker=%3Cbad%3E").status_code == 400
    csv = io.BytesIO(b"Institution,Ticker,Quantity\nFid,KO,200\nSch,JNJ,100\nFid,AAPL,50\n")
    r = c.post("/api/portfolio", data={"file": (csv, "p.csv"), "horizon": "weekly"}, content_type="multipart/form-data")
    j = r.json
    assert len(j["holdings"]) == 3 and j["holdings"][2]["Contracts"] == 0 and j["holdings"][0]["calls"]
    assert r.status_code == 200 and j["summary"]["tickers_with_calls"] == 2 and j["summary"]["quarterly_dividend_income"] > 0, j
    r = c.post("/api/export", data={"file": (io.BytesIO(b"Ticker,Quantity\nKO,200\n"), "p.csv")}, content_type="multipart/form-data")
    x = pd.ExcelFile(io.BytesIO(r.data))
    assert {"Summary", "Dividends", "Covered Calls", "Covered Calls Pivot"} <= set(x.sheet_names), x.sheet_names
    assert c.get("/api/template.xlsx").status_code == 200
    print("all tests passed")


if __name__ == "__main__":
    test_all()
