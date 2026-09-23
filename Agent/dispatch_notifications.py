import os, smtplib, json
from html import escape
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import requests
from core import supabase, log_event, platform_setting

SITE=(os.getenv('SCHOLARPORTAL_BASE_URL') or 'https://scholarportal.site').rstrip('/')

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

def digest_cutoff(s,last_sent,now=None):
    """Return the oldest opportunity creation time eligible for the next digest."""
    if last_sent:
        try:return datetime.fromisoformat(last_sent.replace('Z','+00:00'))
        except Exception:pass
    now=now or datetime.now(timezone.utc)
    freq=(s.get('alert_frequency') or 'weekly').lower()
    return now-{'daily':timedelta(days=1),'weekly':timedelta(days=7),'monthly':timedelta(days=31)}.get(freq,timedelta(days=7))

def created_after(opportunity,cutoff):
    try:
        created=datetime.fromisoformat(str(opportunity.get('created_at') or '').replace('Z','+00:00'))
        return created > cutoff
    except Exception:return False

def titles(items,limit=30):
    result=[]
    for item in items or []:
        title=compact(item.get('title') if isinstance(item,dict) else item,160)
        if title and title not in result:result.append(title)
    return result if limit is None else result[:limit]

def metric_rows(summary,prefix=''):
    """Flatten operational metrics while excluding verbose/private payloads."""
    rows=[]
    for key,value in (summary or {}).items():
        if key in ('inserted','discovered_titles','published_titles','review_titles','facebook_titles','matched_titles','error'):continue
        label=f'{prefix} / {key}' if prefix else key
        if isinstance(value,dict):rows.extend(metric_rows(value,label))
        elif isinstance(value,(str,int,float,bool)) or value is None:rows.append((label.replace('_',' ').title(),compact(value,220)))
    return rows

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

def portal_url(opportunity):
    return f"{SITE}/opportunity/{opportunity.get('id')}/blog" if opportunity.get('id') else f"{SITE}/"

def official_url(opportunity):
    return opportunity.get('official_source_url') or opportunity.get('source_url') or opportunity.get('url') or SITE

def compact(value,limit=220):
    text=' '.join(str(value or '').split())
    return text if len(text)<=limit else text[:limit-1].rstrip()+'…'

def opportunity_email_card(opportunity):
    title=escape(str(opportunity.get('title') or 'Verified opportunity'))
    organization=escape(str(opportunity.get('organization') or 'Official institution'))
    deadline=escape(str(opportunity.get('deadline') or 'Check official source'))
    summary=escape(compact(opportunity.get('description') or opportunity.get('funding_details') or 'Review eligibility, funding and application requirements on ScholarPortal.'))
    details=escape(portal_url(opportunity))
    return f'''<div style="margin:18px 0;padding:20px;border:1px solid #e2e8f0;border-radius:14px;background:#ffffff">
      <h3 style="margin:0 0 6px;color:#172554;font-size:18px">{title}</h3>
      <p style="margin:0 0 8px;color:#475569"><b>{organization}</b> · Deadline: {deadline}</p>
      <p style="margin:0 0 16px;color:#475569;line-height:1.55">{summary}</p>
      <a href="{details}" style="display:inline-block;padding:11px 16px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Review on ScholarPortal</a>
      <p style="margin:12px 0 0;color:#64748b;font-size:12px">The authentic official source and application link are available inside the ScholarPortal guide.</p>
    </div>'''

def opportunity_line_block(opportunity):
    return '\n'.join([
        f"🎓 {opportunity.get('title') or 'Verified opportunity'}",
        f"🏛 {opportunity.get('organization') or 'Official institution'} · Deadline: {opportunity.get('deadline') or 'Check official source'}",
        f"📖 Review on ScholarPortal: {portal_url(opportunity)}",
        "🔎 The authentic official source is available inside the guide.",
    ])

def line_message_chunks(text,limit=4800,max_messages=5):
    chunks=[];current=''
    for block in str(text or '').split('\n'):
        candidate=f'{current}\n{block}'.strip() if current else block
        if len(candidate)<=limit:current=candidate;continue
        if current:chunks.append(current)
        while len(block)>limit and len(chunks)<max_messages:
            chunks.append(block[:limit]);block=block[limit:]
        current=block
        if len(chunks)>=max_messages:break
    if current and len(chunks)<max_messages:chunks.append(current)
    return chunks[:max_messages]

def line_send(line_id,text,token=None):
    token=token or os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
    if not token: raise RuntimeError('LINE not configured')
    messages=[{'type':'text','text':chunk} for chunk in line_message_chunks(text)]
    r=requests.post('https://api.line.me/v2/bot/message/push',headers={'Authorization':f'Bearer {token}','Content-Type':'application/json'},json={'to':line_id,'messages':messages},timeout=25)
    if not r.ok:
        try: detail=(r.json() or {}).get('message') or r.text
        except Exception: detail=r.text
        raise RuntimeError(f'LINE push HTTP {r.status_code}: {compact(detail,240)}')
    return 'line'

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
    def run(self,run_id=None,changes=None,new_opportunities=None):
        global_cfg=platform_setting('notifications',{})
        settings=supabase.table('user_settings').select('*').execute().data or []
        recent_opps=supabase.table('global_opportunities').select('*').eq('verified',True).order('created_at',desc=True).limit(200).execute().data or []
        # New-match digests are scoped to opportunities created by this run.
        # Existing rows remain available only for watchlist/deadline processing.
        digest_opps=[o for o in (new_opportunities or []) if o.get('verified')]
        recent_map={o['id']:o for o in recent_opps}
        sent={'email':0,'line':0,'in_app':0,'email_users':0,'line_users':0,'matched_users':0,'matched_opportunities':0,'matched_titles':[]}
        change_map={x['opportunity_id']:x for x in (changes or [])}
        for s in settings:
            uid=s.get('user_id')
            if not uid:continue

            # Digest frequency applies only to digest deliveries. Watchlist change/deadline
            # notifications are evaluated every run regardless of daily/weekly/monthly digest cadence.
            try:u=supabase.auth.admin.get_user_by_id(uid); email=u.user.email if u and u.user else None
            except Exception:email=None
            email_last=self.last_digest(uid,'email')
            line_last=self.last_digest(uid,'line')
            email_due=bool(global_cfg.get('email_enabled',True)) and bool(s.get('email_alerts_enabled')) and bool(s.get('notify_new_matches',True)) and due(s,email_last)
            line_due=bool(global_cfg.get('line_enabled',True)) and bool(s.get('line_alerts_enabled')) and bool(s.get('notify_new_matches',True)) and due(s,line_last)
            if email_due or line_due:
                channel_matches={}
                if email_due:channel_matches['email']=[o for o in digest_opps if match_rules(o,s)]
                if line_due:channel_matches['line']=[o for o in digest_opps if match_rules(o,s)]
                all_matches=[]
                for matches in channel_matches.values():
                    for o in matches:
                        if o.get('id') not in {x.get('id') for x in all_matches}:all_matches.append(o)
                if all_matches:
                    sent['matched_users']+=1;sent['matched_opportunities']+=len(all_matches)
                    sent['matched_titles']=titles(list(sent['matched_titles'])+all_matches)
                matched=channel_matches.get('email') or []
                if matched:
                    html='''<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;background:#f8fafc;padding:24px;color:#0f172a">
                      <div style="padding:22px;border-radius:16px;background:linear-gradient(135deg,#312e81,#0891b2);color:#fff">
                        <div style="font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85">ScholarPortal</div>
                        <h2 style="margin:8px 0 4px">Verified opportunities for you</h2>
                        <p style="margin:0;opacity:.9">Review the details on ScholarPortal first, then continue to the official application.</p>
                      </div>
                      <p style="color:#475569">We found <b>'''+str(len(matched))+''' new opportunities</b> matching your alert preferences. Official sources remain authoritative.</p>'''+''.join(opportunity_email_card(o) for o in matched)+'''<p style="font-size:12px;color:#64748b">You can update alert preferences in ScholarPortal Settings.</p></div>'''
                    digest_key='digest:'+datetime.now(timezone.utc).strftime('%Y-%m-%d')+':'+':'.join(str(o['id'])[:8] for o in matched)
                    if email_due and email and not self.delivery_exists(uid,'email',digest_key):
                        try:provider=EMAIL.send(email,f"ScholarPortal: {len(matched)} new opportunities for you",html);self.record(uid,matched[0]['id'],'email',digest_key,'match_digest',{'provider':provider,'count':len(matched),'opportunity_ids':[o['id'] for o in matched]});sent['email']+=1;sent['email_users']+=1
                        except Exception as e:log_event(self.name,f'email {uid}: {e}','warn',run_id)
                matched=channel_matches.get('line') or []
                if matched:
                    digest_key='digest:'+datetime.now(timezone.utc).strftime('%Y-%m-%d')+':'+':'.join(str(o['id'])[:8] for o in matched)
                    if line_due and s.get('line_user_id') and not self.delivery_exists(uid,'line',digest_key):
                        text=f'🎓 ScholarPortal found {len(matched)} new opportunities for you\nMatched to your saved interests. Review each guide on ScholarPortal.\n\n'+'\n\n'.join(opportunity_line_block(o) for o in matched)
                        try:line_send(s['line_user_id'],text);self.record(uid,matched[0]['id'],'line',digest_key,'match_digest',{'count':len(matched),'opportunity_ids':[o['id'] for o in matched]});sent['line']+=1;sent['line_users']+=1
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
                                    watched=opp_map.get(w['opportunity_id']) or {'id':w['opportunity_id'],'title':meta.get('title')}
                                    provider=EMAIL.send(email,f"ScholarPortal update: {meta.get('title') or 'watched opportunity'}",f"<div style='font-family:Arial,sans-serif;max-width:620px'><h2>Watched opportunity updated</h2><p>{escape(str(meta.get('title') or ''))}</p><p>Changed fields: {escape(', '.join(meta.get('changed_fields') or []) or 'See portal for details')}</p><p><a href='{escape(portal_url(watched))}'>Review the update on ScholarPortal</a></p><p style='font-size:12px;color:#64748b'>The authentic official source is available inside the guide.</p></div>")
                                    self.record(uid,w['opportunity_id'],'email',key,'opportunity_change',{'provider':provider,**meta});sent['email']+=1
                                except Exception as e:log_event(self.name,f'change email {uid}: {e}','warn',run_id)
                            if s.get('line_alerts_enabled') and s.get('line_user_id') and not self.delivery_exists(uid,'line',key):
                                try:
                                    watched=opp_map.get(w['opportunity_id']) or {'id':w['opportunity_id'],'title':meta.get('title')}
                                    line_send(s['line_user_id'],f"🔔 ScholarPortal watchlist update\n{meta.get('title') or 'Opportunity changed'}\nChanged: {', '.join(meta.get('changed_fields') or []) or 'details updated'}\n📖 Review: {portal_url(watched)}\n🔎 Official source available inside the guide.")
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
                                    provider=EMAIL.send(email,f"Deadline reminder: {opp.get('title')}",f"<div style='font-family:Arial,sans-serif;max-width:620px'><h2>{days} day{'s' if days!=1 else ''} left</h2><p>{escape(str(opp.get('title') or ''))}</p><p>Deadline: {escape(str(opp.get('deadline') or ''))}</p><p><a href='{escape(portal_url(opp))}'>Review on ScholarPortal</a></p><p style='font-size:12px;color:#64748b'>The authentic official application link is available inside the guide.</p></div>")
                                    self.record(uid,opp['id'],'email',key,'deadline_reminder',{'provider':provider,**meta});sent['email']+=1
                                except Exception as e:log_event(self.name,f'deadline email {uid}: {e}','warn',run_id)
                            if s.get('line_alerts_enabled') and s.get('line_user_id') and not self.delivery_exists(uid,'line',key):
                                try:
                                    line_send(s['line_user_id'],f"⏰ ScholarPortal deadline reminder\n{opp.get('title')}\n{days} day{'s' if days!=1 else ''} left · {opp.get('deadline')}\n📖 Review: {portal_url(opp)}\n🔎 Official application link available inside the guide.")
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
        configured=os.getenv('ADMIN_NOTIFICATION_EMAIL') or os.getenv('SENDER_EMAIL') or ''
        configured_emails={x.strip().lower() for x in configured.split(',') if x.strip()}
        recipients=set(configured_emails)
        admins=[]
        try:
            response=supabase.auth.admin.list_users(page=1,per_page=1000)
            # supabase-py 2.x returns a list directly; older clients wrapped it
            # in an object with a ``users`` attribute. Support both shapes.
            users=getattr(response,'users',None) or (response if isinstance(response,list) else [])
            admins=[u for u in users if (getattr(u,'app_metadata',None) or {}).get('role')=='admin' or str(getattr(u,'email','')).lower() in configured_emails]
        except Exception as e:log_event(self.name,f'admin lookup: {e}','warn',run_id)
        for admin in admins:
            uid=str(admin.id)
            if not self.delivery_exists(uid,'in_app',key):
                self.record(uid,None,'in_app',key,'workflow_summary',meta)
            if getattr(admin,'email',None):recipients.add(admin.email)
        sent=0; line_sent=0
        subject=f"ScholarPortal {workflow}: {status}"
        report=summary.get('metrics') if isinstance(summary.get('metrics'),dict) else summary
        opportunities=report.get('opportunities') or {}; articles=report.get('opportunity_articles') or {}
        social=report.get('social_publications') or {}; user_alerts=report.get('notifications') or {}
        facts=[
            ('Status',status.upper()),
            ('Opportunities',f"{opportunities.get('verified_inserted',0)} published · {opportunities.get('needs_review',0)} sent to review · {opportunities.get('discovered',0)} discovered"),
            ('Articles',f"{articles.get('created',0)} created · {articles.get('failed',0)} failed"),
            ('Facebook',f"{social.get('published',0)} published · {social.get('errors',0)} errors"),
            ('User delivery',f"{user_alerts.get('email_users',user_alerts.get('email',0))} users by email · {user_alerts.get('line_users',user_alerts.get('line',0))} users by LINE · {user_alerts.get('in_app',0)} in-app"),
            ('Matched users/opportunities',f"{user_alerts.get('matched_users',0)} users · {user_alerts.get('matched_opportunities',0)} opportunity matches"),
            ('Source changes',str(report.get('changes',0))),
        ]
        if summary.get('error'): facts.append(('Error',compact(summary['error'],240)))
        facts.extend(metric_rows(report))
        seen=set(); facts=[x for x in facts if not (x[0] in seen or seen.add(x[0]))]
        rows=''.join(f"<tr><td style='padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;vertical-align:top'>{escape(label)}</td><td style='padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a'>{escape(value)}</td></tr>" for label,value in facts)
        sections=[]
        for heading,key_name in (('Fetched opportunities','discovered_titles'),('Published to database','published_titles'),('Sent to admin review','review_titles'),('Posted to Facebook','facebook_titles'),('Matched user opportunities','matched_titles'),('Standalone blogs published','article_titles')):
            values=titles(opportunities.get(key_name) or social.get(key_name) or user_alerts.get(key_name) or report.get(key_name),None)
            if values:sections.append(f"<div style='margin-top:16px;padding:16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px'><h3 style='margin:0 0 8px'>{escape(heading)} ({len(values)})</h3><ul style='margin:0;padding-left:20px;color:#334155'>"+''.join(f'<li>{escape(x)}</li>' for x in values)+'</ul></div>')
        html=f"<div style='font-family:Arial,sans-serif;max-width:680px;margin:auto;padding:24px;background:#f8fafc;color:#0f172a'><div style='padding:22px;border-radius:16px;background:linear-gradient(135deg,#172554,#0e7490);color:#fff'><div style='font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:.82'>ScholarPortal Operations</div><h2 style='margin:8px 0 3px'>{escape(workflow.title())} workflow</h2><p style='margin:0;opacity:.9'>Completed with status: {escape(status)}</p></div><table role='presentation' style='width:100%;margin-top:16px;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden'>{rows}</table>{''.join(sections)}<p style='margin:18px 0 0'><a href='{escape(SITE)}/admin' style='display:inline-block;padding:11px 16px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:700'>Open Admin Control</a></p></div>"
        for email in recipients:
            try:
                EMAIL.send(email,subject,html);sent+=1
                admin_user=next((u for u in admins if str(getattr(u,'email','')).lower()==email.lower()),None)
                if admin_user:self.record(str(admin_user.id),None,'email',key,'workflow_summary',meta)
            except Exception as e:log_event(self.name,f'admin email {email}: {e}','warn',run_id)
        admin_ids=[str(a.id) for a in admins]
        line_settings=[]
        admin_token=os.getenv('ADMIN_LINE_CHANNEL_ACCESS_TOKEN')
        admin_recipient=os.getenv('ADMIN_LINE_RECIPIENT_ID')
        if not (admin_token and admin_recipient) and admin_ids:
            try:line_settings=supabase.table('user_settings').select('user_id,line_user_id,line_alerts_enabled').in_('user_id',admin_ids).execute().data or []
            except Exception as e:log_event(self.name,f'admin LINE lookup: {e}','warn',run_id)
        line_titles=[]
        for label,vals in (('Fetched',opportunities.get('discovered_titles')),('Published',opportunities.get('published_titles')),('Review',opportunities.get('review_titles')),('Facebook',social.get('facebook_titles')),('Standalone blogs',report.get('article_titles'))):
            selected=titles(vals,None)
            if selected:line_titles.append(f"{label}:\n"+'\n'.join(f'• {x}' for x in selected))
        line_text='\n'.join([
            f"📊 ScholarPortal {workflow} — {status.upper()}",
            f"🎓 Opportunities: {opportunities.get('verified_inserted',0)} published · {opportunities.get('needs_review',0)} review",
            f"📝 Articles: {articles.get('created',0)} created · {articles.get('failed',0)} failed",
            f"📰 Standalone blogs: {report.get('standalone_articles_created',0)} published",
            f"📘 Facebook: {social.get('published',0)} published · {social.get('errors',0)} errors",
            f"🔔 Users notified: {user_alerts.get('email_users',user_alerts.get('email',0))} email · {user_alerts.get('line_users',user_alerts.get('line',0))} LINE · {user_alerts.get('in_app',0)} in-app",
            f"🛡 Admin: {SITE}/admin",
        ]+line_titles+( [f"⚠️ Error: {compact(summary.get('error'),180)}"] if summary.get('error') else []))
        if admin_token and admin_recipient:
            try:line_send(admin_recipient,line_text,admin_token);line_sent=1
            except Exception as e:log_event(self.name,f'admin LINE backend bot: {e}','warn',run_id)
        else:
            for setting in line_settings:
                if not setting.get('line_user_id') or setting.get('line_alerts_enabled') is False:continue
                uid=str(setting['user_id'])
                if self.delivery_exists(uid,'line',key):continue
                try:line_send(setting['line_user_id'],line_text);self.record(uid,None,'line',key,'workflow_summary',meta);line_sent+=1
                except Exception as e:log_event(self.name,f'admin LINE {uid}: {e}','warn',run_id)
        return {'in_app':len(admins),'email':sent,'line':line_sent,'recipients':len(recipients)}
