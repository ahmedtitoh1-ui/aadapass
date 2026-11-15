import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/server/db';
import { appendAuditLog, enforcePolicy } from '@/lib/server/policy';
import { SupportTicket } from '@/lib/types';

export async function POST(req: NextRequest) {
  const guard = enforcePolicy(req, 'public.contact.submit');
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  // Anti-spam honeypot
  if (typeof body.website === 'string' && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true });
  }

  const name = String(body.name || '').trim();
  const contactInfo = String(body.contactInfo || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (!name || !contactInfo || !subject || !message) {
    return NextResponse.json(
      { error: 'يرجى تعبئة الاسم ووسيلة التواصل والموضوع والرسالة.' },
      { status: 400 }
    );
  }

  const db = getDb();
  const ticket: SupportTicket = {
    id: `tkt-${crypto.randomUUID().slice(0, 6)}`,
    userType: 'عميل',
    userName: `${name} (${contactInfo})`,
    subject: `تواصل زائر: ${subject}`,
    message,
    status: 'مفتوحة',
    createdAt: 'الآن',
  };
  db.tickets.unshift(ticket);

  appendAuditLog({
    actorName: name,
    actorRole: 'SYSTEM',
    action: 'استقبال رسالة تواصل من زائر',
    target: subject,
    oldValue: '-',
    newValue: contactInfo,
    ip: guard.ctx.ip,
  });

  return NextResponse.json({ ok: true, reference: ticket.id }, { status: 201 });
}
