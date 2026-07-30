/**
 * POST /api/report-issue
 * Public endpoint — anyone can submit a platform issue report.
 * Stores in DB and notifies admin by email.
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { notifyIssueReport } from '../../lib/notifications.js';
import { isValidEmail } from '../../../lib/validate-email.js';

export default async function handler(req: Request, res: Response) {
  const { name, email, issue_type, subject, description, url } = req.body as {
    name?: string;
    email?: string;
    issue_type?: string;
    subject?: string;
    description?: string;
    url?: string;
  };

  if (!name?.trim() || !email?.trim() || !issue_type?.trim() || !description?.trim()) {
    return res.status(400).json({ success: false, error: 'Name, email, issue type and description are required.' });
  }

  // Basic email validation
  if (!isValidEmail(email.trim())) {
    return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
  }

  try {
    const result = await db.prepare(`
      INSERT INTO issue_reports (name, email, issue_type, subject, description, page_url, status)
      VALUES (?, ?, ?, ?, ?, ?, 'open')
    `).run(
      name.trim(),
      email.trim().toLowerCase(),
      issue_type.trim(),
      subject?.trim() || null,
      description.trim(),
      url?.trim() || null,
    );

    // Fire-and-forget admin notification
    notifyIssueReport({
      id: result.lastInsertRowid as number,
      name: name.trim(),
      email: email.trim(),
      issueType: issue_type.trim(),
      subject: subject?.trim() || null,
      description: description.trim(),
      pageUrl: url?.trim() || null,
    });

    return res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[report-issue]', err);
    return res.status(500).json({ success: false, error: 'Failed to submit report. Please try again.' });
  }
}
