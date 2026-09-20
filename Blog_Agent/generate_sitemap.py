"""Compatibility entry point: now includes BOTH blog pipelines."""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
from indexing_agent import build
if __name__=='__main__':print(json.dumps(build(),indent=2))
