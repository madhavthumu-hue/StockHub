"""Batch mode, same as the original notebook: Excel in, Excel out.
Usage: python batch_cli.py [input.xlsx] [output.xlsx] [weekly|monthly|quarterly]"""
import sys
from pathlib import Path

import pandas as pd

import analysis as A

base = Path.home() / "Documents/Personal Files/Finance"
src = Path(sys.argv[1]) if len(sys.argv) > 1 else base / "stocks_input_Nihal.xlsx"
dst = Path(sys.argv[2]) if len(sys.argv) > 2 else base / "stocks_output_Nihal.xlsx"
hz = sys.argv[3] if len(sys.argv) > 3 else "weekly"
res = A.analyze_portfolio(pd.read_excel(src, sheet_name="Input"), hz)
dst.write_bytes(A.to_workbook(res))
print("Analysis complete. Results written to:", dst)
