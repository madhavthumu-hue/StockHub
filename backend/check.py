"""Diagnose live-data problems. Usage: python check.py [TICKER]   (run from the backend folder, venv active)"""
import platform, sys
import pandas as pd
import yfinance as yf

t = sys.argv[1] if len(sys.argv) > 1 else "KO"
print("python", platform.python_version(), "| yfinance", yf.__version__, "| pandas", pd.__version__)


def step(name, fn):
    try:
        print("OK   ", name, "->", str(fn())[:110])
    except Exception as e:
        print("FAIL ", name, "->", type(e).__name__, str(e)[:160])


s = yf.Ticker(t)
step("info (fields)", lambda: len(s.info))
step("price via fast_info", lambda: s.fast_info["last_price"])
step("price via history", lambda: s.history(period="5d")["Close"].iloc[-1])
step("dividends (last 2)", lambda: s.dividends.tail(2).to_dict())
step("calendar", lambda: s.calendar)
step("option expirations", lambda: s.options[:3])
step("option chain rows", lambda: len(s.option_chain(s.options[0]).calls))
import analysis
step("full analysis", lambda: analysis.analyze_single(t, 200, "monthly")["Price"])
