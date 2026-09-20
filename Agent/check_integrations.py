"""Production smoke checks for configured SMTP and LINE integrations.
Usage:
  python check_integrations.py --smtp recipient@example.com
  python check_integrations.py --line LINE_USER_ID
No secrets are printed.
"""
import argparse, os, smtplib, requests
from email.mime.text import MIMEText
from dotenv import load_dotenv
load_dotenv()

def smtp_check(to):
    host=os.getenv('SMTP_SERVER');port=int(os.getenv('SMTP_PORT','587'));user=os.getenv('SMTP_USERNAME');pw=os.getenv('SMTP_PASSWORD');sender=os.getenv('SENDER_EMAIL')
    if not all([host,user,pw,sender]): raise RuntimeError('SMTP_SERVER/SMTP_USERNAME/SMTP_PASSWORD/SENDER_EMAIL are required')
    msg=MIMEText('ScholarPortal SMTP integration check succeeded.','plain');msg['Subject']='ScholarPortal SMTP test';msg['From']=sender;msg['To']=to
    cls=smtplib.SMTP_SSL if port==465 else smtplib.SMTP
    with cls(host,port,timeout=20) as s:
        if port!=465:s.starttls()
        s.login(user,pw);s.sendmail(sender,[to],msg.as_string())
    print('SMTP: OK (test message accepted by server)')

def line_check(user_id):
    token=os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
    if not token: raise RuntimeError('LINE_CHANNEL_ACCESS_TOKEN is required')
    r=requests.post('https://api.line.me/v2/bot/message/push',headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},json={'to':user_id,'messages':[{'type':'text','text':'ScholarPortal LINE integration check succeeded ✅'}]},timeout=20)
    r.raise_for_status();print('LINE: OK (push accepted by LINE API)')

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--smtp');ap.add_argument('--line');a=ap.parse_args()
    if not a.smtp and not a.line: ap.error('use --smtp EMAIL and/or --line LINE_USER_ID')
    if a.smtp:smtp_check(a.smtp)
    if a.line:line_check(a.line)
