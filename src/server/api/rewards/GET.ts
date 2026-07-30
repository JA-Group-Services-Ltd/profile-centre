/**
 * GET /api/rewards
 * Returns the user's profile completion score and 150+ achievements.
 * Achievements are available to all paid-plan users; free users see them
 * but most are locked behind plan features.
 */
import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import db from '../../db.js';

interface ProfileRow {
  id: number;
  profile_type: string | null;
  display_name: string | null;
  bio: string | null;
  bio_html: string | null;
  job_title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  avatar_url: string | null;
  profile_photo: string | null;
  cover_url: string | null;
  cover_image: string | null;
  social_links: string | null;
  gallery: string | null;
  whatsapp_url: string | null;
  whatsapp_enabled: number;
  is_published: number;
  enquiry_enabled: number;
  gallery_enabled: number;
  social_links_enabled: number;
  username: string | null;
  biz_slug: string | null;
  business_name: string | null;
  business_description: string | null;
  business_email: string | null;
  business_phone: string | null;
  business_website: string | null;
  business_address: string | null;
  business_category: string | null;
  business_tagline: string | null;
  logo_url: string | null;
  opening_hours: string | null;
  services: string | null;
  team_members: string | null;
  announcements: string | null;
  theme_id: number | null;
  pdf_enabled: number;
  public_pin_enabled: number;
  created_at: string | null;
}

interface CountRow { c: number }
interface UserRow {
  plan_id: number | null;
  account_status: string | null;
  created_at: string | null;
  name: string | null;
  email: string | null;
}
interface PlanRow { slug: string; price_monthly: number }
interface SeatRow { c: number }
interface ThemeRow { c: number }
interface LinkTypeRow { type: string; c: number }
interface ViewRow { c: number }
interface ClickRow { c: number }
interface QrRow { c: number }

function parseArr(s: string | null): unknown[] {
  if (!s) return [];
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; }
}

export default async function handler(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    // ── Load all profiles ─────────────────────────────────────────────────
    const profiles = db.prepare(
      `SELECT id, profile_type, display_name, bio, bio_html, job_title, company, phone, email,
              website, address, avatar_url, profile_photo, cover_url, cover_image, social_links,
              gallery, whatsapp_url, whatsapp_enabled, is_published, enquiry_enabled,
              gallery_enabled, social_links_enabled, username, biz_slug, business_name,
              business_description, business_email, business_phone, business_website,
              business_address, business_category, business_tagline, logo_url, opening_hours,
              services, team_members, announcements, theme_id, pdf_enabled, public_pin_enabled,
              created_at
       FROM profiles WHERE user_id = ?`
    ).all(userId) as ProfileRow[];

    const personal = profiles.find(p => !p.profile_type || p.profile_type === 'personal') ?? null;
    const orgProfiles = profiles.filter(p => p.profile_type === 'business');

    // ── User row ──────────────────────────────────────────────────────────
    const userRow = db.prepare(
      'SELECT plan_id, account_status, created_at, name, email FROM users WHERE id = ?'
    ).get(userId) as UserRow | undefined;

    const planRow = userRow?.plan_id
      ? db.prepare('SELECT slug, price_monthly FROM plans WHERE id = ?').get(userRow.plan_id) as PlanRow | undefined
      : undefined;
    const planSlug = planRow?.slug ?? 'free';
    const isPaid = (planRow?.price_monthly ?? 0) > 0 || planSlug === 'lifetime';

    // ── Aggregate counts ──────────────────────────────────────────────────
    const profileIds = profiles.map(p => p.id);
    const idList = profileIds.length ? profileIds.join(',') : '0';

    const enquiryCount = (db.prepare(
      `SELECT COUNT(*) as c FROM contact_enquiries WHERE profile_id IN (${idList})`
    ).get() as CountRow).c;

    const unreadEnquiries = (db.prepare(
      `SELECT COUNT(*) as c FROM contact_enquiries WHERE profile_id IN (${idList}) AND is_read = 0`
    ).get() as CountRow).c;

    const linkCount = (db.prepare(
      `SELECT COUNT(*) as c FROM profile_links WHERE profile_id IN (${idList})`
    ).get() as CountRow).c;

    const enabledLinkCount = (db.prepare(
      `SELECT COUNT(*) as c FROM profile_links WHERE profile_id IN (${idList}) AND is_enabled = 1`
    ).get() as CountRow).c;

    const linkTypes = db.prepare(
      `SELECT type, COUNT(*) as c FROM profile_links WHERE profile_id IN (${idList}) GROUP BY type`
    ).all() as LinkTypeRow[];
    const linkTypeSet = new Set(linkTypes.map(l => l.type));

    const pageViewCount = (db.prepare(
      `SELECT COUNT(*) as c FROM page_views WHERE profile_id IN (${idList})`
    ).get() as ViewRow).c;

    const linkClickCount = (db.prepare(
      `SELECT COUNT(*) as c FROM link_clicks WHERE profile_id IN (${idList})`
    ).get() as ClickRow).c;

    const qrCount = (db.prepare(
      `SELECT COUNT(*) as c FROM qr_codes WHERE profile_id IN (${idList})`
    ).get() as QrRow).c;

    const seatCount = (db.prepare(
      `SELECT COUNT(*) as c FROM business_seats WHERE profile_id IN (${idList}) AND status = 'active'`
    ).get() as SeatRow).c;

    const inviteCount = (db.prepare(
      `SELECT COUNT(*) as c FROM business_seat_invites WHERE profile_id IN (${idList})`
    ).get() as CountRow).c;

    const publishedOrgCount = orgProfiles.filter(p => p.is_published).length;
    const orgCount = orgProfiles.length;

    // ── Days since account created ────────────────────────────────────────
    const createdAt = userRow?.created_at ? new Date(userRow.created_at) : new Date();
    const daysSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / 86400000);

    // ── Personal profile checks ───────────────────────────────────────────
    const hasPhoto        = !!(personal?.avatar_url || personal?.profile_photo);
    const hasBio          = !!(personal?.bio && personal.bio.trim().length > 10);
    const hasLongBio      = !!(personal?.bio && personal.bio.trim().length > 100);
    const hasJobTitle     = !!(personal?.job_title);
    const hasCompany      = !!(personal?.company);
    const hasPhone        = !!(personal?.phone);
    const hasEmail        = !!(personal?.email);
    const hasWebsite      = !!(personal?.website);
    const hasAddress      = !!(personal?.address);
    const hasContact      = hasPhone || hasEmail || hasWebsite;
    const hasAllContact   = hasPhone && hasEmail && hasWebsite;
    const hasSocialLinks  = parseArr(personal?.social_links).length > 0;
    const hasManyLinks    = parseArr(personal?.social_links).length >= 5;
    const hasGallery      = parseArr(personal?.gallery).length > 0;
    const hasGallery3     = parseArr(personal?.gallery).length >= 3;
    const hasGallery6     = parseArr(personal?.gallery).length >= 6;
    const hasWhatsApp     = !!(personal?.whatsapp_url && personal.whatsapp_enabled);
    const isPublished     = !!(personal?.is_published);
    const hasCover        = !!(personal?.cover_url || personal?.cover_image);
    const hasPdf          = !!(personal?.pdf_enabled);
    const hasPin          = !!(personal?.public_pin_enabled);
    const hasCustomTheme  = !!(personal?.theme_id && personal.theme_id > 1);
    const hasAddress2     = !!(personal?.address);
    const hasDisplayName  = !!(personal?.display_name && personal.display_name.trim().length > 1);
    const hasUsername     = !!(personal?.username && personal.username.trim().length > 2);

    // ── Organisation checks ───────────────────────────────────────────────
    const hasOrg          = orgCount > 0;
    const hasOrg2         = orgCount >= 2;
    const hasOrg4         = orgCount >= 4;
    const orgPublished    = publishedOrgCount > 0;
    const orgAllPublished = orgCount > 0 && publishedOrgCount === orgCount;
    const orgHasLogo      = orgProfiles.some(p => p.logo_url);
    const orgHasDesc      = orgProfiles.some(p => p.business_description && p.business_description.trim().length > 10);
    const orgHasLongDesc  = orgProfiles.some(p => p.business_description && p.business_description.trim().length > 150);
    const orgHasHours     = orgProfiles.some(p => p.opening_hours);
    const orgHasServices  = orgProfiles.some(p => parseArr(p.services).length > 0);
    const orgHas3Services = orgProfiles.some(p => parseArr(p.services).length >= 3);
    const orgHas5Services = orgProfiles.some(p => parseArr(p.services).length >= 5);
    const orgHasTeam      = orgProfiles.some(p => parseArr(p.team_members).length > 0);
    const orgHas3Team     = orgProfiles.some(p => parseArr(p.team_members).length >= 3);
    const orgHas5Team     = orgProfiles.some(p => parseArr(p.team_members).length >= 5);
    const orgHasAnnounce  = orgProfiles.some(p => parseArr(p.announcements).length > 0);
    const orgHasTagline   = orgProfiles.some(p => p.business_tagline && p.business_tagline.trim().length > 2);
    const orgHasCategory  = orgProfiles.some(p => p.business_category);
    const orgHasEmail     = orgProfiles.some(p => p.business_email);
    const orgHasPhone     = orgProfiles.some(p => p.business_phone);
    const orgHasWebsite   = orgProfiles.some(p => p.business_website);
    const orgHasAddress   = orgProfiles.some(p => p.business_address);
    const orgHasCover     = orgProfiles.some(p => p.cover_url || p.cover_image);
    const orgHasAllContact= orgProfiles.some(p => p.business_email && p.business_phone && p.business_website);
    const orgHasName      = orgProfiles.some(p => p.business_name && p.business_name.trim().length > 1);
    const orgHasBizSlug   = orgProfiles.some(p => p.biz_slug && p.biz_slug.trim().length > 1);

    // ── Link / engagement checks ──────────────────────────────────────────
    const hasLinks1       = linkCount >= 1;
    const hasLinks3       = linkCount >= 3;
    const hasLinks5       = linkCount >= 5;
    const hasLinks10      = linkCount >= 10;
    const hasLinks20      = linkCount >= 20;
    const hasLinks50      = linkCount >= 50;
    const hasSocialType   = linkTypeSet.has('social');
    const hasVideoType    = linkTypeSet.has('video');
    const hasDocType      = linkTypeSet.has('document') || linkTypeSet.has('pdf');
    const hasShopType     = linkTypeSet.has('shop') || linkTypeSet.has('ecommerce');
    const hasCalType      = linkTypeSet.has('calendar') || linkTypeSet.has('booking');
    const hasMusicType    = linkTypeSet.has('music') || linkTypeSet.has('audio');
    const hasPortfolioType= linkTypeSet.has('portfolio') || linkTypeSet.has('website');
    const hasMultiTypes   = linkTypes.length >= 3;
    const hasAllEnabled   = enabledLinkCount === linkCount && linkCount > 0;

    // ── Enquiry checks ────────────────────────────────────────────────────
    const hasEnquiry1     = enquiryCount >= 1;
    const hasEnquiry5     = enquiryCount >= 5;
    const hasEnquiry10    = enquiryCount >= 10;
    const hasEnquiry25    = enquiryCount >= 25;
    const hasEnquiry50    = enquiryCount >= 50;
    const hasEnquiry100   = enquiryCount >= 100;
    const hasReadAll      = enquiryCount > 0 && unreadEnquiries === 0;

    // ── Analytics / views ─────────────────────────────────────────────────
    const hasViews10      = pageViewCount >= 10;
    const hasViews50      = pageViewCount >= 50;
    const hasViews100     = pageViewCount >= 100;
    const hasViews500     = pageViewCount >= 500;
    const hasViews1000    = pageViewCount >= 1000;
    const hasClicks10     = linkClickCount >= 10;
    const hasClicks50     = linkClickCount >= 50;
    const hasClicks100    = linkClickCount >= 100;
    const hasClicks500    = linkClickCount >= 500;
    const hasQr           = qrCount > 0;

    // ── Seat / team checks ────────────────────────────────────────────────
    const hasSeat1        = seatCount >= 1;
    const hasSeat5        = seatCount >= 5;
    const hasSeat10       = seatCount >= 10;
    const hasSeat20       = seatCount >= 20;
    const hasInvite       = inviteCount >= 1;

    // ── Tenure checks ─────────────────────────────────────────────────────
    const has7days        = daysSinceCreated >= 7;
    const has30days       = daysSinceCreated >= 30;
    const has90days       = daysSinceCreated >= 90;
    const has180days      = daysSinceCreated >= 180;
    const has365days      = daysSinceCreated >= 365;

    // ── Completion score ──────────────────────────────────────────────────
    const completionItems = [
      { key: 'photo',       done: hasPhoto,       label: 'Profile photo',          points: 10 },
      { key: 'bio',         done: hasBio,          label: 'Bio / about me',         points: 10 },
      { key: 'job_title',   done: hasJobTitle,     label: 'Job title',              points: 5  },
      { key: 'company',     done: hasCompany,      label: 'Company',                points: 5  },
      { key: 'contact',     done: hasContact,      label: 'Contact details',        points: 10 },
      { key: 'social',      done: hasSocialLinks,  label: 'Social links',           points: 10 },
      { key: 'gallery',     done: hasGallery,      label: 'Gallery images',         points: 10 },
      { key: 'whatsapp',    done: hasWhatsApp,     label: 'WhatsApp button',        points: 5  },
      { key: 'cover',       done: hasCover,        label: 'Cover image',            points: 5  },
      { key: 'published',   done: isPublished,     label: 'Profile published',      points: 10 },
      { key: 'links',       done: hasLinks3,       label: '3+ links added',         points: 10 },
    ];
    const totalPoints   = completionItems.reduce((s, i) => s + i.points, 0);
    const earnedPoints  = completionItems.filter(i => i.done).reduce((s, i) => s + i.points, 0);
    const completionScore = Math.round((earnedPoints / totalPoints) * 100);

    // ── 150+ Achievements ─────────────────────────────────────────────────
    // Categories: profile | identity | content | connections | engagement | analytics | organisation | team | tenure | mastery
    const achievements = [

      // ── PROFILE SETUP (20) ───────────────────────────────────────────────
      { id: 'profile_created',      title: 'First Steps',            desc: 'Created your first profile',                             icon: 'user',        earned: !!personal,           category: 'profile',      difficulty: 'easy'   },
      { id: 'photo_added',          title: 'Face to a Name',         desc: 'Added a profile photo',                                  icon: 'camera',      earned: hasPhoto,             category: 'profile',      difficulty: 'easy'   },
      { id: 'bio_written',          title: 'Tell Your Story',        desc: 'Wrote a bio of 10+ characters',                          icon: 'pen',         earned: hasBio,               category: 'profile',      difficulty: 'easy'   },
      { id: 'bio_long',             title: 'Storyteller',            desc: 'Wrote a detailed bio of 100+ characters',                icon: 'pen',         earned: hasLongBio,           category: 'profile',      difficulty: 'medium' },
      { id: 'job_title_added',      title: 'Titled',                 desc: 'Added your job title',                                   icon: 'briefcase',   earned: hasJobTitle,          category: 'profile',      difficulty: 'easy'   },
      { id: 'company_added',        title: 'Company Rep',            desc: 'Added your company name',                                icon: 'building',    earned: hasCompany,           category: 'profile',      difficulty: 'easy'   },
      { id: 'cover_added',          title: 'Cover Star',             desc: 'Added a cover image',                                    icon: 'image',       earned: hasCover,             category: 'profile',      difficulty: 'easy'   },
      { id: 'published',            title: 'Gone Live',              desc: 'Published your profile to the world',                    icon: 'globe',       earned: isPublished,          category: 'profile',      difficulty: 'easy'   },
      { id: 'display_name',         title: 'Named',                  desc: 'Set your display name',                                  icon: 'user',        earned: hasDisplayName,       category: 'profile',      difficulty: 'easy'   },
      { id: 'username_set',         title: 'Handle Claimed',         desc: 'Chose your custom username',                             icon: 'at-sign',     earned: hasUsername,          category: 'profile',      difficulty: 'easy'   },
      { id: 'phone_added',          title: 'Call Me',                desc: 'Added a phone number',                                   icon: 'phone',       earned: hasPhone,             category: 'profile',      difficulty: 'easy'   },
      { id: 'email_added',          title: 'Inbox Open',             desc: 'Added an email address',                                 icon: 'mail',        earned: hasEmail,             category: 'profile',      difficulty: 'easy'   },
      { id: 'website_added',        title: 'Web Presence',           desc: 'Added a website URL',                                    icon: 'globe',       earned: hasWebsite,           category: 'profile',      difficulty: 'easy'   },
      { id: 'address_added',        title: 'On the Map',             desc: 'Added your address',                                     icon: 'map-pin',     earned: hasAddress,           category: 'profile',      difficulty: 'easy'   },
      { id: 'all_contact',          title: 'Fully Reachable',        desc: 'Added phone, email and website',                         icon: 'check-circle',earned: hasAllContact,        category: 'profile',      difficulty: 'medium' },
      { id: 'pdf_enabled',          title: 'PDF Ready',              desc: 'Enabled PDF profile attachments',                        icon: 'file-text',   earned: hasPdf,               category: 'profile',      difficulty: 'medium' },
      { id: 'pin_enabled',          title: 'Locked In',              desc: 'Enabled public PIN protection',                          icon: 'lock',        earned: hasPin,               category: 'profile',      difficulty: 'medium' },
      { id: 'custom_theme',         title: 'Styled Up',              desc: 'Applied a custom theme',                                 icon: 'palette',     earned: hasCustomTheme,       category: 'profile',      difficulty: 'medium' },
      { id: 'completion_80',        title: 'Profile Pro',            desc: 'Reached 80% profile completion',                         icon: 'star',        earned: completionScore >= 80, category: 'profile',     difficulty: 'medium' },
      { id: 'completion_100',       title: 'Perfection',             desc: 'Reached 100% profile completion',                        icon: 'award',       earned: completionScore >= 100,category: 'profile',     difficulty: 'hard'   },

      // ── CONTENT & GALLERY (15) ────────────────────────────────────────────
      { id: 'gallery_1',            title: 'Show & Tell',            desc: 'Added your first gallery image',                         icon: 'photo',       earned: hasGallery,           category: 'content',      difficulty: 'easy'   },
      { id: 'gallery_3',            title: 'Gallery Curator',        desc: 'Added 3 or more gallery images',                         icon: 'photo',       earned: hasGallery3,          category: 'content',      difficulty: 'medium' },
      { id: 'gallery_6',            title: 'Visual Storyteller',     desc: 'Added 6 or more gallery images',                         icon: 'photo',       earned: hasGallery6,          category: 'content',      difficulty: 'hard'   },
      { id: 'whatsapp_added',       title: 'On WhatsApp',            desc: 'Added and enabled a WhatsApp button',                    icon: 'message',     earned: hasWhatsApp,          category: 'content',      difficulty: 'easy'   },
      { id: 'qr_generated',         title: 'QR Pioneer',             desc: 'Generated your first QR code',                           icon: 'qr-code',     earned: hasQr,                category: 'content',      difficulty: 'easy'   },
      { id: 'links_1',              title: 'First Link',             desc: 'Added your first link',                                  icon: 'link',        earned: hasLinks1,            category: 'content',      difficulty: 'easy'   },
      { id: 'links_3',              title: 'Link Builder',           desc: 'Added 3 or more links',                                  icon: 'layers',      earned: hasLinks3,            category: 'content',      difficulty: 'easy'   },
      { id: 'links_5',              title: 'Link Collector',         desc: 'Added 5 or more links',                                  icon: 'layers',      earned: hasLinks5,            category: 'content',      difficulty: 'medium' },
      { id: 'links_10',             title: 'Link Master',            desc: 'Added 10 or more links',                                 icon: 'layers',      earned: hasLinks10,           category: 'content',      difficulty: 'medium' },
      { id: 'links_20',             title: 'Link Legend',            desc: 'Added 20 or more links',                                 icon: 'layers',      earned: hasLinks20,           category: 'content',      difficulty: 'hard'   },
      { id: 'links_50',             title: 'Link Empire',            desc: 'Added 50 or more links',                                 icon: 'layers',      earned: hasLinks50,           category: 'content',      difficulty: 'elite'  },
      { id: 'social_link',          title: 'Social Butterfly',       desc: 'Added a social media link',                              icon: 'share',       earned: hasSocialType,        category: 'content',      difficulty: 'easy'   },
      { id: 'video_link',           title: 'Lights, Camera',         desc: 'Added a video link',                                     icon: 'video',       earned: hasVideoType,         category: 'content',      difficulty: 'medium' },
      { id: 'multi_types',          title: 'Diverse Portfolio',      desc: 'Added links of 3 or more different types',               icon: 'grid',        earned: hasMultiTypes,        category: 'content',      difficulty: 'medium' },
      { id: 'all_enabled',          title: 'All Systems Go',         desc: 'All your links are enabled',                             icon: 'check-circle',earned: hasAllEnabled,        category: 'content',      difficulty: 'medium' },

      // ── CONNECTIONS & SOCIAL (15) ─────────────────────────────────────────
      { id: 'social_links_1',       title: 'Connected',              desc: 'Added at least one social link',                         icon: 'link',        earned: hasSocialLinks,       category: 'connections',  difficulty: 'easy'   },
      { id: 'social_links_5',       title: 'Social Network',         desc: 'Added 5 or more social links',                           icon: 'share',       earned: hasManyLinks,         category: 'connections',  difficulty: 'medium' },
      { id: 'doc_link',             title: 'Document Sharer',        desc: 'Added a document or PDF link',                           icon: 'file-text',   earned: hasDocType,           category: 'connections',  difficulty: 'medium' },
      { id: 'shop_link',            title: 'Open for Business',      desc: 'Added a shop or e-commerce link',                        icon: 'shopping-bag',earned: hasShopType,          category: 'connections',  difficulty: 'medium' },
      { id: 'cal_link',             title: 'Book Me',                desc: 'Added a calendar or booking link',                       icon: 'calendar',    earned: hasCalType,           category: 'connections',  difficulty: 'medium' },
      { id: 'music_link',           title: 'Tune In',                desc: 'Added a music or audio link',                            icon: 'music',       earned: hasMusicType,         category: 'connections',  difficulty: 'medium' },
      { id: 'portfolio_link',       title: 'Portfolio Ready',        desc: 'Added a portfolio or website link',                      icon: 'globe',       earned: hasPortfolioType,     category: 'connections',  difficulty: 'easy'   },
      { id: 'enquiry_enabled',      title: 'Open to Enquiries',      desc: 'Enabled the contact / enquiry form',                     icon: 'mail',        earned: !!(personal?.enquiry_enabled), category: 'connections', difficulty: 'easy' },
      { id: 'gallery_enabled',      title: 'Gallery On',             desc: 'Enabled the gallery section',                            icon: 'photo',       earned: !!(personal?.gallery_enabled), category: 'connections', difficulty: 'easy' },
      { id: 'social_enabled',       title: 'Socials On',             desc: 'Enabled the social links section',                       icon: 'share',       earned: !!(personal?.social_links_enabled), category: 'connections', difficulty: 'easy' },
      { id: 'whatsapp_enabled',     title: 'WhatsApp Live',          desc: 'WhatsApp button is enabled on your profile',             icon: 'message',     earned: !!(personal?.whatsapp_enabled), category: 'connections', difficulty: 'easy' },
      { id: 'multi_profiles',       title: 'Multi-Profile',          desc: 'Have both a personal and organisation profile',           icon: 'users',       earned: hasOrg && isPublished,category: 'connections',  difficulty: 'medium' },
      { id: 'all_profiles_live',    title: 'All Live',               desc: 'All your profiles are published',                        icon: 'globe',       earned: isPublished && orgAllPublished && orgCount > 0, category: 'connections', difficulty: 'hard' },
      { id: 'pdf_shared',           title: 'PDF Sharer',             desc: 'Enabled PDF on your profile',                            icon: 'file-text',   earned: hasPdf,               category: 'connections',  difficulty: 'medium' },
      { id: 'pin_protected',        title: 'Privacy First',          desc: 'Protected your profile with a PIN',                      icon: 'lock',        earned: hasPin,               category: 'connections',  difficulty: 'medium' },

      // ── ENGAGEMENT (20) ───────────────────────────────────────────────────
      { id: 'enquiry_1',            title: 'First Contact',          desc: 'Received your first enquiry',                            icon: 'mail',        earned: hasEnquiry1,          category: 'engagement',   difficulty: 'easy'   },
      { id: 'enquiry_5',            title: 'In Demand',              desc: 'Received 5 or more enquiries',                           icon: 'inbox',       earned: hasEnquiry5,          category: 'engagement',   difficulty: 'medium' },
      { id: 'enquiry_10',           title: 'Popular',                desc: 'Received 10 or more enquiries',                          icon: 'inbox',       earned: hasEnquiry10,         category: 'engagement',   difficulty: 'medium' },
      { id: 'enquiry_25',           title: 'Networking Pro',         desc: 'Received 25 or more enquiries',                          icon: 'inbox',       earned: hasEnquiry25,         category: 'engagement',   difficulty: 'hard'   },
      { id: 'enquiry_50',           title: 'Inbox Hero',             desc: 'Received 50 or more enquiries',                          icon: 'inbox',       earned: hasEnquiry50,         category: 'engagement',   difficulty: 'hard'   },
      { id: 'enquiry_100',          title: 'Century Club',           desc: 'Received 100 or more enquiries',                         icon: 'trophy',      earned: hasEnquiry100,        category: 'engagement',   difficulty: 'elite'  },
      { id: 'read_all',             title: 'Inbox Zero',             desc: 'Read all your enquiries',                                icon: 'check-circle',earned: hasReadAll,           category: 'engagement',   difficulty: 'medium' },
      { id: 'views_10',             title: 'First Visitors',         desc: 'Your profile has been viewed 10 times',                  icon: 'eye',         earned: hasViews10,           category: 'engagement',   difficulty: 'easy'   },
      { id: 'views_50',             title: 'Growing Audience',       desc: 'Your profile has been viewed 50 times',                  icon: 'eye',         earned: hasViews50,           category: 'engagement',   difficulty: 'medium' },
      { id: 'views_100',            title: 'Triple Digits',          desc: 'Your profile has been viewed 100 times',                 icon: 'eye',         earned: hasViews100,          category: 'engagement',   difficulty: 'medium' },
      { id: 'views_500',            title: 'Going Viral',            desc: 'Your profile has been viewed 500 times',                 icon: 'trending-up', earned: hasViews500,          category: 'engagement',   difficulty: 'hard'   },
      { id: 'views_1000',           title: 'Thousand Eyes',          desc: 'Your profile has been viewed 1,000 times',               icon: 'trending-up', earned: hasViews1000,         category: 'engagement',   difficulty: 'elite'  },
      { id: 'clicks_10',            title: 'Click Starter',          desc: 'Your links have been clicked 10 times',                  icon: 'mouse-pointer',earned: hasClicks10,         category: 'engagement',   difficulty: 'easy'   },
      { id: 'clicks_50',            title: 'Click Magnet',           desc: 'Your links have been clicked 50 times',                  icon: 'mouse-pointer',earned: hasClicks50,         category: 'engagement',   difficulty: 'medium' },
      { id: 'clicks_100',           title: 'Click Champion',         desc: 'Your links have been clicked 100 times',                 icon: 'mouse-pointer',earned: hasClicks100,        category: 'engagement',   difficulty: 'hard'   },
      { id: 'clicks_500',           title: 'Click Legend',           desc: 'Your links have been clicked 500 times',                 icon: 'mouse-pointer',earned: hasClicks500,        category: 'engagement',   difficulty: 'elite'  },
      { id: 'qr_used',              title: 'QR Pioneer',             desc: 'Generated a QR code for your profile',                   icon: 'qr-code',     earned: hasQr,                category: 'engagement',   difficulty: 'easy'   },
      { id: 'views_and_enquiry',    title: 'Converting',             desc: 'Got views and at least one enquiry',                     icon: 'zap',         earned: hasViews10 && hasEnquiry1, category: 'engagement', difficulty: 'medium' },
      { id: 'high_conversion',      title: 'High Converter',         desc: 'Got 100+ views and 10+ enquiries',                       icon: 'zap',         earned: hasViews100 && hasEnquiry10, category: 'engagement', difficulty: 'hard' },
      { id: 'click_and_enquiry',    title: 'Full Funnel',            desc: 'Got link clicks and enquiries',                          icon: 'zap',         earned: hasClicks10 && hasEnquiry5, category: 'engagement', difficulty: 'hard' },

      // ── ORGANISATION (25) ─────────────────────────────────────────────────
      { id: 'org_created',          title: 'Organisation Builder',   desc: 'Created your first organisation profile',                icon: 'building',    earned: hasOrg,               category: 'organisation', difficulty: 'easy'   },
      { id: 'org_published',        title: 'Open for Business',      desc: 'Published an organisation profile',                      icon: 'briefcase',   earned: orgPublished,         category: 'organisation', difficulty: 'easy'   },
      { id: 'org_logo',             title: 'Branded Up',             desc: 'Added a logo to your organisation profile',              icon: 'badge',       earned: orgHasLogo,           category: 'organisation', difficulty: 'easy'   },
      { id: 'org_description',      title: 'About Us',               desc: 'Wrote an organisation description',                      icon: 'file-text',   earned: orgHasDesc,           category: 'organisation', difficulty: 'easy'   },
      { id: 'org_long_desc',        title: 'Deep Dive',              desc: 'Wrote a detailed organisation description (150+ chars)', icon: 'file-text',   earned: orgHasLongDesc,       category: 'organisation', difficulty: 'medium' },
      { id: 'org_hours',            title: 'Open Hours',             desc: 'Added opening hours to your organisation',               icon: 'clock',       earned: orgHasHours,          category: 'organisation', difficulty: 'easy'   },
      { id: 'org_services_1',       title: 'Service Listing',        desc: 'Added at least one service',                             icon: 'list',        earned: orgHasServices,       category: 'organisation', difficulty: 'easy'   },
      { id: 'org_services_3',       title: 'Service Range',          desc: 'Added 3 or more services',                               icon: 'list',        earned: orgHas3Services,      category: 'organisation', difficulty: 'medium' },
      { id: 'org_services_5',       title: 'Full Service',           desc: 'Added 5 or more services',                               icon: 'list',        earned: orgHas5Services,      category: 'organisation', difficulty: 'hard'   },
      { id: 'org_team_1',           title: 'Team Player',            desc: 'Added a team member to your organisation',               icon: 'users',       earned: orgHasTeam,           category: 'organisation', difficulty: 'easy'   },
      { id: 'org_team_3',           title: 'Growing Team',           desc: 'Added 3 or more team members',                           icon: 'users',       earned: orgHas3Team,          category: 'organisation', difficulty: 'medium' },
      { id: 'org_team_5',           title: 'Full Team',              desc: 'Added 5 or more team members',                           icon: 'users',       earned: orgHas5Team,          category: 'organisation', difficulty: 'hard'   },
      { id: 'org_announcement',     title: 'Announcement Made',      desc: 'Posted an announcement on your organisation',            icon: 'bell',        earned: orgHasAnnounce,       category: 'organisation', difficulty: 'medium' },
      { id: 'org_tagline',          title: 'Tagline Set',            desc: 'Added a tagline to your organisation',                   icon: 'pen',         earned: orgHasTagline,        category: 'organisation', difficulty: 'easy'   },
      { id: 'org_category',         title: 'Categorised',            desc: 'Set a category for your organisation',                   icon: 'tag',         earned: orgHasCategory,       category: 'organisation', difficulty: 'easy'   },
      { id: 'org_email',            title: 'Org Email',              desc: 'Added an email to your organisation profile',            icon: 'mail',        earned: orgHasEmail,          category: 'organisation', difficulty: 'easy'   },
      { id: 'org_phone',            title: 'Org Phone',              desc: 'Added a phone to your organisation profile',             icon: 'phone',       earned: orgHasPhone,          category: 'organisation', difficulty: 'easy'   },
      { id: 'org_website',          title: 'Org Website',            desc: 'Added a website to your organisation profile',           icon: 'globe',       earned: orgHasWebsite,        category: 'organisation', difficulty: 'easy'   },
      { id: 'org_address',          title: 'Org Address',            desc: 'Added an address to your organisation profile',          icon: 'map-pin',     earned: orgHasAddress,        category: 'organisation', difficulty: 'easy'   },
      { id: 'org_cover',            title: 'Org Cover Star',         desc: 'Added a cover image to your organisation',               icon: 'image',       earned: orgHasCover,          category: 'organisation', difficulty: 'easy'   },
      { id: 'org_all_contact',      title: 'Org Fully Reachable',    desc: 'Added email, phone and website to your organisation',    icon: 'check-circle',earned: orgHasAllContact,     category: 'organisation', difficulty: 'medium' },
      { id: 'org_slug',             title: 'Org URL Set',            desc: 'Set a custom URL slug for your organisation',            icon: 'link',        earned: orgHasBizSlug,        category: 'organisation', difficulty: 'easy'   },
      { id: 'org_name',             title: 'Named Organisation',     desc: 'Set your organisation name',                             icon: 'building',    earned: orgHasName,           category: 'organisation', difficulty: 'easy'   },
      { id: 'org_2',                title: 'Dual Brand',             desc: 'Created 2 or more organisation profiles',                icon: 'building',    earned: hasOrg2,              category: 'organisation', difficulty: 'hard'   },
      { id: 'org_4',                title: 'Brand Portfolio',        desc: 'Created 4 or more organisation profiles',                icon: 'building',    earned: hasOrg4,              category: 'organisation', difficulty: 'elite'  },

      // ── TEAM & SEATS (15) ─────────────────────────────────────────────────
      { id: 'seat_invited',         title: 'First Invite',           desc: 'Sent your first team seat invitation',                   icon: 'user-plus',   earned: hasInvite,            category: 'team',         difficulty: 'easy'   },
      { id: 'seat_1',               title: 'Team of Two',            desc: 'Have 1 active team seat member',                         icon: 'users',       earned: hasSeat1,             category: 'team',         difficulty: 'easy'   },
      { id: 'seat_5',               title: 'Small Team',             desc: 'Have 5 active team seat members',                        icon: 'users',       earned: hasSeat5,             category: 'team',         difficulty: 'medium' },
      { id: 'seat_10',              title: 'Growing Organisation',   desc: 'Have 10 active team seat members',                       icon: 'users',       earned: hasSeat10,            category: 'team',         difficulty: 'hard'   },
      { id: 'seat_20',              title: 'Full House',             desc: 'Have 20 active team seat members',                       icon: 'users',       earned: hasSeat20,            category: 'team',         difficulty: 'elite'  },
      { id: 'team_and_org',         title: 'Organised',              desc: 'Have a team seat and an organisation profile',           icon: 'building',    earned: hasSeat1 && hasOrg,   category: 'team',         difficulty: 'medium' },
      { id: 'team_and_services',    title: 'Service Team',           desc: 'Have team members and services listed',                  icon: 'list',        earned: hasSeat1 && orgHasServices, category: 'team',   difficulty: 'medium' },
      { id: 'team_and_published',   title: 'Team Live',              desc: 'Have a team and your org profile is published',          icon: 'globe',       earned: hasSeat1 && orgPublished, category: 'team',     difficulty: 'medium' },
      { id: 'team_and_logo',        title: 'Branded Team',           desc: 'Have a team and a logo on your organisation',            icon: 'badge',       earned: hasSeat1 && orgHasLogo, category: 'team',       difficulty: 'medium' },
      { id: 'team_and_hours',       title: 'Team Hours',             desc: 'Have a team and opening hours set',                      icon: 'clock',       earned: hasSeat1 && orgHasHours, category: 'team',      difficulty: 'medium' },
      { id: 'team_and_announce',    title: 'Team Announcement',      desc: 'Have a team and posted an announcement',                 icon: 'bell',        earned: hasSeat1 && orgHasAnnounce, category: 'team',   difficulty: 'hard'   },
      { id: 'team_and_enquiries',   title: 'Team Inbox',             desc: 'Have a team and received 5+ enquiries',                  icon: 'inbox',       earned: hasSeat1 && hasEnquiry5, category: 'team',      difficulty: 'hard'   },
      { id: 'team_full_profile',    title: 'Team Complete',          desc: 'Have a team, logo, services and published org',          icon: 'check-circle',earned: hasSeat1 && orgHasLogo && orgHasServices && orgPublished, category: 'team', difficulty: 'hard' },
      { id: 'team_and_cover',       title: 'Team Cover',             desc: 'Have a team and a cover image on your organisation',     icon: 'image',       earned: hasSeat1 && orgHasCover, category: 'team',       difficulty: 'medium' },
      { id: 'team_and_category',    title: 'Team Category',          desc: 'Have a team and a category set on your organisation',    icon: 'tag',         earned: hasSeat1 && orgHasCategory, category: 'team',    difficulty: 'medium' },

      // ── TENURE (10) ───────────────────────────────────────────────────────
      { id: 'tenure_7',             title: 'One Week In',            desc: 'Been a member for 7 days',                               icon: 'calendar',    earned: has7days,             category: 'tenure',       difficulty: 'easy'   },
      { id: 'tenure_30',            title: 'One Month Strong',       desc: 'Been a member for 30 days',                              icon: 'calendar',    earned: has30days,            category: 'tenure',       difficulty: 'easy'   },
      { id: 'tenure_90',            title: 'Three Months In',        desc: 'Been a member for 90 days',                              icon: 'calendar',    earned: has90days,            category: 'tenure',       difficulty: 'medium' },
      { id: 'tenure_180',           title: 'Half Year Hero',         desc: 'Been a member for 180 days',                             icon: 'calendar',    earned: has180days,           category: 'tenure',       difficulty: 'medium' },
      { id: 'tenure_365',           title: 'One Year Anniversary',   desc: 'Been a member for a full year',                          icon: 'award',       earned: has365days,           category: 'tenure',       difficulty: 'hard'   },
      { id: 'tenure_and_published', title: 'Loyal & Live',           desc: 'Been a member for 30 days with a published profile',     icon: 'globe',       earned: has30days && isPublished, category: 'tenure',   difficulty: 'medium' },
      { id: 'tenure_and_enquiry',   title: 'Established',            desc: 'Been a member for 90 days and received enquiries',       icon: 'inbox',       earned: has90days && hasEnquiry1, category: 'tenure',   difficulty: 'medium' },
      { id: 'tenure_and_org',       title: 'Long-Term Builder',      desc: 'Been a member for 90 days with an org profile',          icon: 'building',    earned: has90days && hasOrg,  category: 'tenure',       difficulty: 'hard'   },
      { id: 'tenure_and_team',      title: 'Veteran Leader',         desc: 'Been a member for 180 days with a team',                 icon: 'users',       earned: has180days && hasSeat1, category: 'tenure',     difficulty: 'hard'   },
      { id: 'tenure_year_complete', title: 'Year-Round Pro',         desc: 'One year in with 80%+ profile completion',               icon: 'award',       earned: has365days && completionScore >= 80, category: 'tenure', difficulty: 'elite' },

      // ── MASTERY (30) ─────────────────────────────────────────────────────
      { id: 'mastery_all_personal', title: 'Personal Master',        desc: 'Completed all personal profile fields',                  icon: 'star',        earned: hasPhoto && hasBio && hasJobTitle && hasCompany && hasAllContact && hasCover, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_all_org',      title: 'Organisation Master',    desc: 'Completed all key organisation fields',                  icon: 'building',    earned: orgHasLogo && orgHasDesc && orgHasHours && orgHasServices && orgHasTeam && orgPublished, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_engagement',   title: 'Engagement Master',      desc: 'Got 100+ views, 10+ enquiries and 50+ link clicks',      icon: 'zap',         earned: hasViews100 && hasEnquiry10 && hasClicks50, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_content',      title: 'Content Master',         desc: 'Have 10+ links, gallery, WhatsApp and PDF enabled',      icon: 'layers',      earned: hasLinks10 && hasGallery && hasWhatsApp && hasPdf, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_team',         title: 'Team Master',            desc: 'Have 5+ seats, org published, logo and services',        icon: 'users',       earned: hasSeat5 && orgPublished && orgHasLogo && orgHasServices, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_social',       title: 'Social Master',          desc: 'Have 5+ social links and 50+ profile views',             icon: 'share',       earned: hasManyLinks && hasViews50, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_org_complete', title: 'Org Completionist',      desc: 'Org has logo, cover, tagline, category, hours, services, team and announcement', icon: 'award', earned: orgHasLogo && orgHasCover && orgHasTagline && orgHasCategory && orgHasHours && orgHasServices && orgHasTeam && orgHasAnnounce, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_multi_org',    title: 'Multi-Brand Master',     desc: 'Have 2+ org profiles all published',                     icon: 'building',    earned: hasOrg2 && orgAllPublished, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_links_types',  title: 'Link Variety Master',    desc: 'Have links of 5+ different types',                       icon: 'grid',        earned: linkTypes.length >= 5, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_enquiry_read', title: 'Inbox Master',           desc: 'Received 25+ enquiries and read them all',               icon: 'inbox',       earned: hasEnquiry25 && hasReadAll, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_views_clicks', title: 'Traffic Master',         desc: 'Got 500+ views and 100+ link clicks',                    icon: 'trending-up', earned: hasViews500 && hasClicks100, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_paid',         title: 'Paid Member',            desc: 'Upgraded to a paid plan',                                icon: 'credit-card', earned: isPaid,               category: 'mastery',      difficulty: 'easy'   },
      { id: 'mastery_tenure_full',  title: 'Veteran',                desc: 'Been a member for a year with 10+ enquiries',            icon: 'award',       earned: has365days && hasEnquiry10, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_all_sections', title: 'All Sections Active',    desc: 'Gallery, social links, WhatsApp and enquiry all enabled',icon: 'check-circle',earned: !!(personal?.gallery_enabled) && !!(personal?.social_links_enabled) && !!(personal?.whatsapp_enabled) && !!(personal?.enquiry_enabled), category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_org_contact',  title: 'Org Contact Complete',   desc: 'Org has email, phone, website and address',              icon: 'check-circle',earned: orgHasEmail && orgHasPhone && orgHasWebsite && orgHasAddress, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_qr_views',     title: 'QR Driven',              desc: 'Generated a QR code and got 50+ views',                  icon: 'qr-code',     earned: hasQr && hasViews50,  category: 'mastery',      difficulty: 'hard'   },
      { id: 'mastery_team_org',     title: 'Full Organisation',      desc: 'Have team, org profile, logo, services and 10+ enquiries',icon: 'building',   earned: hasSeat1 && hasOrg && orgHasLogo && orgHasServices && hasEnquiry10, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_gallery_links',title: 'Rich Profile',           desc: 'Have 6+ gallery images and 10+ links',                   icon: 'star',        earned: hasGallery6 && hasLinks10, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_bio_contact',  title: 'Fully Introduced',       desc: 'Have a long bio, all contact details and a cover image', icon: 'user',        earned: hasLongBio && hasAllContact && hasCover, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_org_team_pub', title: 'Published & Staffed',    desc: 'Org profile published with team members',                icon: 'briefcase',   earned: orgPublished && orgHasTeam, category: 'mastery', difficulty: 'medium' },
      { id: 'mastery_100_views_org',title: 'Org Visibility',         desc: 'Org profile published and 100+ total views',             icon: 'eye',         earned: orgPublished && hasViews100, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_link_click_enq',title: 'Triple Threat',         desc: 'Have 10+ links, 50+ clicks and 5+ enquiries',            icon: 'zap',         earned: hasLinks10 && hasClicks50 && hasEnquiry5, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_org_announce', title: 'Org Communicator',       desc: 'Org has announcement, tagline and description',          icon: 'bell',        earned: orgHasAnnounce && orgHasTagline && orgHasDesc, category: 'mastery', difficulty: 'hard' },
      { id: 'mastery_seat_enquiry', title: 'Team Engagement',        desc: 'Have 5+ seats and 25+ enquiries',                        icon: 'users',       earned: hasSeat5 && hasEnquiry25, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_year_org',     title: 'Year-Round Organisation',desc: 'One year in with an org profile published',              icon: 'building',    earned: has365days && orgPublished, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_all_links',    title: 'Link Completionist',     desc: 'Have 20+ links all enabled',                             icon: 'layers',      earned: hasLinks20 && hasAllEnabled, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_org_services_team', title: 'Service Organisation', desc: 'Org has 5+ services and 5+ team members',             icon: 'briefcase',   earned: orgHas5Services && orgHas5Team, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_full_platform',title: 'Platform Master',        desc: 'Published profile, org, team, 10+ links and 10+ enquiries', icon: 'award',   earned: isPublished && orgPublished && hasSeat1 && hasLinks10 && hasEnquiry10, category: 'mastery', difficulty: 'elite' },
      { id: 'mastery_500_enquiries',title: 'Enquiry Legend',         desc: 'Received 50+ enquiries — you are truly in demand',       icon: 'trophy',      earned: hasEnquiry50,         category: 'mastery',      difficulty: 'elite'  },
      { id: 'mastery_all_org_fields',title: 'Org Field Master',      desc: 'Org has name, tagline, category, email, phone, website, address, logo and cover', icon: 'building', earned: orgHasName && orgHasTagline && orgHasCategory && orgHasEmail && orgHasPhone && orgHasWebsite && orgHasAddress && orgHasLogo && orgHasCover, category: 'mastery', difficulty: 'elite' },
    ];

    const earnedCount = achievements.filter(a => a.earned).length;

    // ── Persist achievements with timestamps ──────────────────────────────
    const ACHIEVEMENT_POINTS: Record<string, number> = {
      profile_created: 10, photo_added: 10, bio_written: 10, bio_long: 15,
      job_title_added: 5, company_added: 5, cover_added: 10, published: 20,
      display_name: 5, username_set: 5, phone_added: 5, email_added: 5,
      website_added: 5, address_added: 5, all_contact: 15, pdf_enabled: 10,
      pin_enabled: 10, custom_theme: 10, completion_80: 25, completion_100: 50,
      gallery_1: 10, gallery_3: 15, gallery_6: 25, whatsapp_added: 10,
      qr_generated: 10, links_1: 5, links_3: 10, links_5: 15, links_10: 25,
      links_20: 40, links_50: 75, social_link: 5, video_link: 10,
      multi_types: 15, all_enabled: 10, social_links_1: 5, social_links_5: 15,
      doc_link: 10, shop_link: 10, cal_link: 10, music_link: 10,
      portfolio_link: 5, enquiry_enabled: 5, gallery_enabled: 5,
      social_enabled: 5, whatsapp_enabled: 5, multi_profiles: 20,
      all_profiles_live: 30, pdf_shared: 10, pin_protected: 10,
      enquiry_1: 15, enquiry_5: 25, enquiry_10: 40, enquiry_25: 60,
      enquiry_50: 100, enquiry_100: 150, read_all: 10,
      views_10: 10, views_50: 20, views_100: 35, views_500: 75, views_1000: 150,
      clicks_10: 10, clicks_50: 20, clicks_100: 35, clicks_500: 75,
      qr_used: 10, views_and_enquiry: 20, high_conversion: 50, click_and_enquiry: 40,
      org_created: 25, org_published: 20, org_logo: 10, org_description: 10,
      org_long_desc: 15, org_hours: 10, org_services_1: 10, org_services_3: 20,
      org_services_5: 30, org_team_1: 15, org_team_3: 25, org_team_5: 40,
      org_announcement: 15, org_tagline: 5, org_category: 5, org_email: 5,
      org_phone: 5, org_website: 5, org_address: 5, org_cover: 10,
      org_all_contact: 20, org_slug: 10, org_name: 5, org_2: 50, org_4: 100,
      seat_invited: 10, seat_1: 15, seat_5: 30, seat_10: 60, seat_20: 100,
      team_and_org: 20, team_and_services: 20, team_and_published: 25,
      team_and_logo: 20, team_and_hours: 20, team_and_announce: 25,
      team_and_enquiries: 30, team_full_profile: 50, team_and_cover: 20,
      team_and_category: 15,
      tenure_7: 10, tenure_30: 20, tenure_90: 40, tenure_180: 75, tenure_365: 150,
      tenure_and_published: 25, tenure_and_enquiry: 30, tenure_and_org: 40,
      tenure_and_team: 60, tenure_year_complete: 100,
      mastery_all_personal: 75, mastery_all_org: 75, mastery_engagement: 100,
      mastery_content: 75, mastery_team: 100, mastery_social: 50,
      mastery_org_complete: 150, mastery_multi_org: 100, mastery_links_types: 50,
      mastery_enquiry_read: 60, mastery_views_clicks: 100, mastery_paid: 25,
      mastery_tenure_full: 150, mastery_all_sections: 50, mastery_org_contact: 40,
      mastery_qr_views: 40, mastery_team_org: 100, mastery_gallery_links: 50,
      mastery_bio_contact: 40, mastery_org_team_pub: 50, mastery_100_views_org: 60,
      mastery_link_click_enq: 60, mastery_org_announce: 40, mastery_seat_enquiry: 100,
      mastery_year_org: 100, mastery_all_links: 75, mastery_org_services_team: 100,
      mastery_full_platform: 200, mastery_500_enquiries: 100, mastery_all_org_fields: 100,
    };

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id         INTEGER NOT NULL,
          achievement_key TEXT    NOT NULL,
          earned          INTEGER NOT NULL DEFAULT 0,
          points          INTEGER NOT NULL DEFAULT 0,
          earned_at       TEXT,
          UNIQUE(user_id, achievement_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      const upsert = db.prepare(`
        INSERT INTO user_achievements (user_id, achievement_key, earned, points, earned_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, achievement_key) DO UPDATE SET
          earned = excluded.earned,
          points = excluded.points,
          earned_at = CASE
            WHEN excluded.earned = 1 AND user_achievements.earned_at IS NULL
            THEN excluded.earned_at
            ELSE user_achievements.earned_at
          END
      `);

      const now = new Date().toISOString();
      const upsertAll = db.transaction(() => {
        for (const a of achievements) {
          const pts = ACHIEVEMENT_POINTS[a.id] ?? 10;
          upsert.run(userId, a.id, a.earned ? 1 : 0, pts, a.earned ? now : null);
        }
      });
      upsertAll();

      interface StoredAch { achievement_key: string; earned_at: string | null }
      const stored = db.prepare(
        `SELECT achievement_key, earned_at FROM user_achievements WHERE user_id = ?`
      ).all(userId) as StoredAch[];
      const storedMap = new Map(stored.map(s => [s.achievement_key, s.earned_at]));

      const achievementsWithTimestamps = achievements.map(a => ({
        ...a,
        points: ACHIEVEMENT_POINTS[a.id] ?? 10,
        earned_at: a.earned ? (storedMap.get(a.id) ?? now) : null,
      }));

      res.json({
        success: true,
        data: {
          completionScore, completionItems, earnedPoints, totalPoints,
          achievements: achievementsWithTimestamps,
          earnedCount, totalAchievements: achievements.length,
          enquiryCount, linkCount, orgProfileCount: orgCount,
          pageViewCount, linkClickCount, seatCount, daysSinceCreated, isPaid, planSlug,
        },
      });
    } catch (persistErr) {
      console.error('[rewards] persist error:', persistErr);
      res.json({
        success: true,
        data: {
          completionScore, completionItems, earnedPoints, totalPoints,
          achievements, earnedCount, totalAchievements: achievements.length,
          enquiryCount, linkCount, orgProfileCount: orgCount,
          pageViewCount, linkClickCount, seatCount, daysSinceCreated, isPaid, planSlug,
        },
      });
    }
  } catch (err) {
    console.error('[rewards] error:', err);
    res.status(500).json({ success: false, error: 'Failed to load rewards' });
  }
}
