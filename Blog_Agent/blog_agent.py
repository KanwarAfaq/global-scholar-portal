"""Standalone researched blogs. Never writes opportunity_blogs or sends messages."""
import argparse,sys,json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'Agent'))
from content_pipeline import StandaloneBlogAgent
if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--query',default='official university graduate admissions scholarship application guidance')
    parser.add_argument('--limit',type=int,default=2)
    args=parser.parse_args()
    print(json.dumps(StandaloneBlogAgent().run(args.query,max(1,min(args.limit,10))),indent=2))
