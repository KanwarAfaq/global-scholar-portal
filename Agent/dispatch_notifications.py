import os, smtplib, json
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests
from core import supabase, log_event, platform_setting

SITE=os.getenv('SCHOLARPORTAL_BASE_URL','https://scholarportal.site').rstrip('/')

def values(v):
    if isinstance(v,list): return [str(x).strip() for x in v if str(x).strip()]
    if not v or str(v).lower()=='all': return []
    return [x.strip() for x in str(v).split(',') if x.strip()]

def match_rules(o,s):
    blob=' '.join([str(o.get('country') or ''),str(o.get('type') or ''),str(o.get('field') or ''),' '.join(o.get('tags') or [])]).lower()
    for key,new_key in (('alert_countries','alert_countries_v2'),('alert_levels','alert_levels_v2'),('alert_fields','alert_fields_v2')):
        wanted=values(s.get(new_key)) or values(s.get(key));
        if wanted and not any(x.lower() in blob for x in wanted): return False
    return True

def due(s,last_sent):
    freq=(s.get('alert_frequency') or 'weekly').lower(); now=datetime.now(timezone.utc)
    if not last_sent:return True
    try:last=datetime.fromisoformat(last_sent.replace('Z','+00:00'))
    except:return True
    delta=now-last
    return delta >= {'daily':timedelta(hours=20),'weekly':timedelta(days=6),'monthly':timedelta(days=27)}.get(freq,timedelta(days=6))

class SMTPEmail:
    """Single supported email transport: SMTP. Fail loudly so operations can monitor it."""
    def send(self,to,subject,html):
        host=os.getenv('SMTP_SERVER'); user=os.getenv('SMTP_USERNAME'); pw=os.getenv('SMTP_PASSWORD'); sender=os.getenv('SENDER_EMAIL')
        if not all([host,user,pw,sender]): raise RuntimeError('SMTP not configured')
        port=int(os.getenv('SMTP_PORT','587')); msg=MIMEMultipart('alternative'); msg['Subject']=subject; msg['From']=f'ScholarPortal <{sender}>'; msg['To']=to; msg.attach(MIMEText(html,'html'))
        if port == 465:
            with smtplib.SMTP_SSL(host,port,timeout=25) as server: server.login(user,pw); server.sendmail(sender,to,msg.as_string())
        else:
            with smtplib.SMTP(host,port,timeout=25) as server: server.starttls(); server.login(user,pw); server.sendmail(sender,to,msg.as_string())
        return 'smtp'

EMAIL=SMTPEmail()

def line_send(line_id,text):
    token=os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
    if not token: raise RuntimeError('LINE not configured')
    r=requests.post('https://api.line.me/v2/bot/message/push',headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},json={'to':line_id,'messages':[{'type':'text','text':text[:4900]}]},timeout=25);r.raise_for_status();return 'line'

class NotificationAgent:
    name='notification-agent'
    def delivery_exists(self,user_id,channel,key):
        return bool(supabase.table('notification_deliveries').select('id').eq('user_id',user_id).eq('channel',channel).eq('delivery_key',key).limit(1).execute().data or [])
    def record(self,user_id,opp_id,channel,key,typ,meta):
        try:supabase.table('notification_deliveries').insert({'user_id':user_id,'opportunity_id':opp_id,'channel':channel,'delivery_key':key,'notification_type':typ,'metadata':meta}).execute()
        except Exception:pass
    def last_digest(self,user_id,channel):
        rows=(supabase.table('notification_deliveries').select('sent_at')
              .eq('user_id',user_id).eq('channel',channel).eq('notification_type','match_digest')
              .order('sent_at',desc=True).limit(1).execute().data or [])
        return rows[0]['sent_at'] if rows else None
    def run(self,run_id=None,changes=None):
        global_cfg=platform_setting('notifications',{})
        settings=supabase.table('user_settings').select('*').execute().data or []
        recent_opps=supabase.table('global_opportunities').select('*').eq('verified',True).order('created_at',desc=True).limit(200).execute().data or []
        recent_map={o['id']:o for o in recent_opps}
        sent={'email':0,'line':0,'in_app':0}
        change_map={x['opportunity_id']:x for x in (changes or [])}
        for s in settings:
            uid=s.get('user_id')
            if not uid:continue

            # Digest frequency applies only to digest deliveries. Watchlist change/deadline
            # notifications are evaluated every run regardless of daily/weekly/monthly digest cadence.
            try:u=supabase.auth.admin.get_user_by_id(uid); email=u.user.email if u and u.user else None
            except Exception:email=None
            email_due=bool(global_cfg.get('email_enabled',True)) and bool(s.get('email_alerts_enabled')) and bool(s.get('notify_new_matches',True)) and due(s,self.last_digest(uid,'email'))
            line_due=bool(global_cfg.get('line_enabled',True)) and bool(s.get('line_alerts_enabled')) and bool(s.get('notify_new_matches',True)) and due(s,self.last_digest(uid,'line'))
            if email_due or line_due:
                matched=[o for o in recent_opps if match_rules(o,s)][:5]
                if matched:
                    html='<h2>ScholarPortal verified opportunity digest</h2><p>Official sources remain authoritative.</p><ul>'+''.join(f"<li><b>{o['title']}</b> — {o.get('organization','')} — deadline {o.get('deadline','Unknown')} — <a href=\"{o.get('official_source_url') or o.get('url')}\">official source</a></li>" for o in matched)+'</ul>'
                    digest_key='digest:'+datetime.now(timezone.utc).strftime('%Y-%m-%d')+':'+':'.join(str(o['id'])[:8] for o in matched)
                    if email_due and email and not self.delivery_exists(uid,'email',digest_key):
                        try:provider=EMAIL.send(email,f"ScholarPortal: {len(matched)} verified matches",html);self.record(uid,matched[0]['id'],'email',digest_key,'match_digest',{'provider':provider});sent['email']+=1
                        except Exception as e:log_event(self.name,f'email {uid}: {e}','warn',run_id)
                    if line_due and s.get('line_user_id') and not self.delivery_exists(uid,'line',digest_key):
                        text='🎓 ScholarPortal verified matches\n\n'+'\n\n'.join(f"• {o['title']}\n{o.get('deadline','Unknown')}\n{o.get('official_source_url') or o.get('url')}" for o in matched)
                        try:line_send(s['line_user_id'],text);self.record(uid,matched[0]['id'],'line',digest_key,'match_digest',{});sent['line']+=1
                        except Exception as e:log_event(self.name,f'LINE {uid}: {e}','warn',run_id)

            watched=supabase.table('user_watchlists').select('*').eq('user_id',uid).execute().data or []
            missing_ids=[w['opportunity_id'] for w in watched if w['opportunity_id'] not in recent_map]
            watched_map={}
            if missing_ids:
                try:
                    more=supabase.table('global_opportunities').select('*').in_('id',missing_ids).execute().data or []
                    watched_map={o['id']:o for o in more}
                except Exception:pass
            opp_map={**recent_map,**watched_map}

            for w in watched:
                if w.get('notify_changes') and s.get('notify_watchlist_changes',True):
                    ch=change_map.get(w['opportunity_id'])
                    if ch:
                        key=f"change:{w['opportunity_id']}:{ch['hash'][:16]}"
                        meta={**ch,'title':ch.get('title') or (opp_map.get(w['opportunity_id']) or {}).get('title')}
                        if s.get('in_app_alerts_enabled',True) and not self.delivery_exists(uid,'in_app',key):
                            self.record(uid,w['opportunity_id'],'in_app',key,'opportunity_change',meta);sent['in_app']+=1
                        if s.get('urgent_change_alerts',True):
                            if s.get('email_alerts_enabled') and email and not self.delivery_exists(uid,'email',key):
                                try:
                                    provider=EMAIL.send(email,f"ScholarPortal update: {meta.get('title') or 'watched opportunity'}",f"<h2>Watched opportunity changed</h2><p>{meta.get('title') or ''}</p><p>Changed fields: {', '.join(meta.get('changed_fields') or []) or 'See portal for details'}</p><p><a href='{SITE}/intelligence'>Open watchlist</a></p>")
                                    self.record(uid,w['opportunity_id'],'email',key,'opportunity_change',{'provider':provider,**meta});sent['email']+=1
                                except Exception as e:log_event(self.name,f'change email {uid}: {e}','warn',run_id)
                            if s.get('line_alerts_enabled') and s.get('line_user_id') and not self.delivery_exists(uid,'line',key):
                                try:
                                    line_send(s['line_user_id'],f"🔔 ScholarPortal watchlist update\n{meta.get('title') or 'Opportunity changed'}\nChanged: {', '.join(meta.get('changed_fields') or []) or 'details updated'}\n{SITE}/intelligence")
                                    self.record(uid,w['opportunity_id'],'line',key,'opportunity_change',meta);sent['line']+=1
                                except Exception as e:log_event(self.name,f'change LINE {uid}: {e}','warn',run_id)
                if w.get('notify_deadline') and s.get('notify_deadline_reminders',True):
                    opp=opp_map.get(w['opportunity_id'])
                    if opp and isinstance(opp.get('deadline'),str):
                        try:
                            days=(datetime.strptime(opp['deadline'],'%Y-%m-%d').date()-datetime.now(timezone.utc).date()).days
                        except Exception: days=None
                        reminder_days=tuple(global_cfg.get('deadline_days') or [30,14,7,3,1,0])
                        if days in reminder_days:
                            key=f"deadline:{opp['id']}:{opp['deadline']}:{days}"
                            meta={'title':opp.get('title'),'deadline':opp['deadline'],'days_left':days}
                            if s.get('in_app_alerts_enabled',True) and not self.delivery_exists(uid,'in_app',key):
                                self.record(uid,opp['id'],'in_app',key,'deadline_reminder',meta); sent['in_app']+=1
                            if s.get('email_alerts_enabled') and email and not self.delivery_exists(uid,'email',key):
                                try:
                                    provider=EMAIL.send(email,f"Deadline reminder: {opp.get('title')}",f"<h2>{days} day{'s' if days!=1 else ''} left</h2><p>{opp.get('title')}</p><p>Deadline: {opp.get('deadline')}</p><p><a href='{SITE}/applications'>Open applications</a></p>")
                                    self.record(uid,opp['id'],'email',key,'deadline_reminder',{'provider':provider,**meta});sent['email']+=1
                                except Exception as e:log_event(self.name,f'deadline email {uid}: {e}','warn',run_id)
                            if s.get('line_alerts_enabled') and s.get('line_user_id') and not self.delivery_exists(uid,'line',key):
                                try:
                                    line_send(s['line_user_id'],f"⏰ ScholarPortal deadline reminder\n{opp.get('title')}\n{days} day{'s' if days!=1 else ''} left · {opp.get('deadline')}\n{SITE}/applications")
                                    self.record(uid,opp['id'],'line',key,'deadline_reminder',meta);sent['line']+=1
                                except Exception as e:log_event(self.name,f'deadline LINE {uid}: {e}','warn',run_id)
        return sent

    def notify_admins(self,workflow,summary,run_id=None,status='success'):
        """Send an operational workflow summary to every platform admin.

        In-app delivery is always attempted. Email uses the admin account email and
        also supports ADMIN_NOTIFICATION_EMAIL for an external operations inbox.
        Failures are logged without hiding the workflow's real result.
        """
        key=f"workflow:{workflow}:{run_id or datetime.now(timezone.utc).strftime('%Y-%m-%d')}:{status}"
        meta={'title':f'{workflow} workflow {status}','workflow':workflow,'status':status,'summary':summary}
        recipients=set()
        admins=[]
        try:
            response=supabase.auth.admin.list_users(page=1,per_page=1000)
            admins=[u for u in (getattr(response,'users',None) or []) if (getattr(u,'app_metadata',None) or {}).get('role')=='admin']
        except Exception as e:log_event(self.name,f'admin lookup: {e}','warn',run_id)
        for admin in admins:
            uid=str(admin.id)
            if not self.delivery_exists(uid,'in_app',key):
                self.record(uid,None,'in_app',key,'workflow_summary',meta)
            if getattr(admin,'email',None):recipients.add(admin.email)
        configured=os.getenv('ADMIN_NOTIFICATION_EMAIL')
        if configured:recipients.update(x.strip() for x in configured.split(',') if x.strip())
        sent=0
        subject=f"ScholarPortal {workflow}: {status}"
        html=f"<h2>{subject}</h2><pre>{json.dumps(summary,indent=2,default=str)}</pre>"
        for email in recipients:
            try:EMAIL.send(email,subject,html);sent+=1
            except Exception as e:log_event(self.name,f'admin email {email}: {e}','warn',run_id)
        return {'in_app':len(admins),'email':sent,'recipients':len(recipients)}
