/**
 * Admin — Points & Rewards management endpoints
 */
import { type Request, type Response } from 'express';
import db from '../../db.js';
import { awardPoints, deductPoints, getBalance } from '../../lib/points.js';

// ── Rules ─────────────────────────────────────────────────────────────────

export async function adminGetRules(req: Request, res: Response) {
  try {
    const rules = await db.prepare('SELECT * FROM points_rules ORDER BY id ASC').all();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminUpdateRule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { points, is_active, description } = req.body;
    await db.prepare(`
      UPDATE points_rules SET points = ?, is_active = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(points, is_active ? 1 : 0, description ?? null, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Rewards ───────────────────────────────────────────────────────────────

export async function adminGetRewards(req: Request, res: Response) {
  try {
    const rewards = await db.prepare('SELECT * FROM rewards ORDER BY points_cost ASC').all();
    res.json({ success: true, data: rewards });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminCreateReward(req: Request, res: Response) {
  try {
    const { name, description, type, value, points_cost, stock } = req.body;
    if (!name || !type || !value || points_cost == null) {
      return res.status(400).json({ success: false, error: 'name, type, value and points_cost are required' });
    }
    const result = db.prepare(`
      INSERT INTO rewards (name, description, type, value, points_cost, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, description ?? null, type, value, points_cost, stock ?? -1);
    res.status(201).json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminUpdateReward(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, description, type, value, points_cost, is_active, stock } = req.body;
    await db.prepare(`
      UPDATE rewards SET name=?, description=?, type=?, value=?, points_cost=?, is_active=?, stock=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, description ?? null, type, value, points_cost, is_active ? 1 : 0, stock ?? -1, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminDeleteReward(req: Request, res: Response) {
  try {
    await db.prepare('DELETE FROM rewards WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Member balances ───────────────────────────────────────────────────────

export async function adminGetMemberBalances(req: Request, res: Response) {
  try {
    const members = await db.prepare(`
      SELECT u.id, u.name, u.email, u.created_at,
        COALESCE((SELECT balance_after FROM points_ledger pl WHERE pl.user_id = u.id ORDER BY pl.id DESC LIMIT 1), 0) as balance,
        COALESCE((SELECT SUM(delta) FROM points_ledger pl WHERE pl.user_id = u.id AND delta > 0), 0) as lifetime_earned,
        COALESCE(ABS((SELECT SUM(delta) FROM points_ledger pl WHERE pl.user_id = u.id AND delta < 0)), 0) as lifetime_redeemed,
        (SELECT code FROM referral_codes rc WHERE rc.user_id = u.id) as referral_code,
        (SELECT COUNT(*) FROM users ru WHERE ru.referred_by_code = (SELECT code FROM referral_codes rc WHERE rc.user_id = u.id)) as referral_count
      FROM users u
      ORDER BY balance DESC
      LIMIT 500
    `).all();
    res.json({ success: true, data: members });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Manual adjustment ─────────────────────────────────────────────────────

export async function adminAdjustPoints(req: Request, res: Response) {
  try {
    const { user_id, delta, description, action } = req.body;
    if (!user_id || delta == null) {
      return res.status(400).json({ success: false, error: 'user_id and delta are required' });
    }
    const actionKey = action || (delta > 0 ? 'promo_bonus' : 'manual_adjustment');
    let newBalance: number;
    if (delta > 0) {
      newBalance = (await awardPoints(user_id, actionKey, description, undefined, delta)) ?? (await getBalance(user_id));
    } else {
      newBalance = await deductPoints(user_id, Math.abs(delta), actionKey, description);
    }
    res.json({ success: true, new_balance: newBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Redemptions ───────────────────────────────────────────────────────────

export async function adminGetRedemptions(req: Request, res: Response) {
  try {
    const rows = await db.prepare(`
      SELECT rr.*, u.name as user_name, u.email as user_email,
        r.name as reward_name, r.type as reward_type, r.value as reward_value
      FROM reward_redemptions rr
      JOIN users u ON rr.user_id = u.id
      JOIN rewards r ON rr.reward_id = r.id
      ORDER BY rr.created_at DESC
      LIMIT 500
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

export async function adminFulfillRedemption(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { status, notes, code } = req.body;
    if (!['fulfilled', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    await db.prepare(`
      UPDATE reward_redemptions SET status=?, notes=?, code=?, fulfilled_at=CASE WHEN ? = 'fulfilled' THEN CURRENT_TIMESTAMP ELSE fulfilled_at END
      WHERE id=?
    `).run(status, notes ?? null, code ?? null, status, id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}

// ── Referral activity ─────────────────────────────────────────────────────

export async function adminGetReferralActivity(req: Request, res: Response) {
  try {
    const rows = await db.prepare(`
      SELECT rc.code, u.name as owner_name, u.email as owner_email,
        COUNT(ru.id) as signup_count,
        COALESCE(SUM(CASE WHEN pl.action = 'referral_purchase' THEN 1 ELSE 0 END), 0) as purchase_count,
        COALESCE(SUM(CASE WHEN pl.action IN ('referral_signup','referral_purchase') THEN pl.delta ELSE 0 END), 0) as points_awarded
      FROM referral_codes rc
      JOIN users u ON rc.user_id = u.id
      LEFT JOIN users ru ON ru.referred_by_code = rc.code
      LEFT JOIN points_ledger pl ON pl.user_id = rc.user_id AND pl.action IN ('referral_signup','referral_purchase')
      GROUP BY rc.id
      ORDER BY signup_count DESC
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: String(err) });
  }
}
