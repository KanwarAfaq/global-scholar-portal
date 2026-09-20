import nodemailer from 'npm:nodemailer@6.9.16';

export async function sendSmtpMail(to: string, subject: string, html: string) {
  const host=Deno.env.get('SMTP_SERVER'); const port=Number(Deno.env.get('SMTP_PORT')||'587');
  const user=Deno.env.get('SMTP_USERNAME'); const pass=Deno.env.get('SMTP_PASSWORD');
  const from=Deno.env.get('SENDER_EMAIL');
  if(!host || !user || !pass || !from) throw new Error('SMTP is not configured');
  const transporter=nodemailer.createTransport({host,port,secure:port===465,auth:{user,pass},requireTLS:port!==465});
  await transporter.sendMail({from:`ScholarPortal <${from}>`,to,subject,html});
}
