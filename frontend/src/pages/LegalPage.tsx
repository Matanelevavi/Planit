import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/context'
import type { Lang } from '../i18n/strings'

type Section = { h: string; p: string[] }
type Doc = { title: string; sections: Section[] }

const UPDATED = '2026-11-17'

const privacy: Record<Lang, Doc> = {
  he: {
    title: 'מדיניות פרטיות',
    sections: [
      { h: 'איזה מידע אנחנו שומרים', p: ['כתובת אימייל, סיסמה (נשמרת רק כגיבוב Argon2, לא ניתנת לשחזור), והיעדים וההפקדות שהזנתם: שמות, סכומים, תאריכים והערות.', 'איננו מבקשים או שומרים פרטי חשבון בנק, כרטיס אשראי, תעודת זהות או גישה לחשבונות פיננסיים.'] },
      { h: 'למה', p: ['כדי להפעיל את החשבון שלכם, לחשב תחזיות ולהציג אותן. איננו מוכרים מידע, איננו מציגים פרסומות ואיננו משתמשים במידע לפרסום.'] },
      { h: 'עוגיות ואחסון בדפדפן', p: ['עוגיית התחברות אחת (httpOnly) שמשמרת את ההתחברות עד 14 יום, ובחירת שפה בדפדפן. אין עוגיות מעקב או אנליטיקה של צד שלישי.'] },
      { h: 'ספקים', p: ['האתר מאוחסן אצל Render, מסד הנתונים אצל Neon (Postgres), ומיילים לאיפוס סיסמה נשלחים דרך Resend. כל אחד מהם מקבל רק את מה שנדרש לתפקידו.'] },
      { h: 'הזכויות שלכם', p: ['בהגדרות החשבון אפשר להוריד עותק של כל המידע (JSON) ולמחוק את החשבון. המחיקה מסירה את החשבון, היעדים וההפקדות מהמערכת.', 'לבקשות נוספות בנושא פרטיות: פנו לכתובת הקשר שתפורסם באתר.'] },
      { h: 'אבטחה', p: ['סיסמאות מוצפנות בגיבוב חזק, התקשורת מוצפנת (HTTPS) ויש הגבלת ניסיונות התחברות. אין מערכת מאובטחת לחלוטין, ואנו ממליצים על סיסמה ייחודית.'] },
    ],
  },
  en: {
    title: 'Privacy policy',
    sections: [
      { h: 'What we store', p: ['Your e-mail address, your password (only as an Argon2 hash – it cannot be recovered), and the goals and deposits you enter: names, amounts, dates and notes.', 'We do not ask for or store bank details, card numbers, ID numbers or access to financial accounts.'] },
      { h: 'Why', p: ['To run your account and calculate and show your projections. We do not sell data, show ads, or use it for advertising.'] },
      { h: 'Cookies and browser storage', p: ['One sign-in cookie (httpOnly) that keeps you signed in for up to 14 days, and your language choice in the browser. No third-party tracking or analytics cookies.'] },
      { h: 'Providers', p: ['The site is hosted on Render, the database is on Neon (Postgres), and password-reset e-mails are sent through Resend. Each receives only what its role requires.'] },
      { h: 'Your rights', p: ['In account settings you can download a copy of all your data (JSON) and delete your account. Deletion removes your account, goals and deposits from the system.', 'For other privacy requests, use the contact address that will be published on the site.'] },
      { h: 'Security', p: ['Passwords are hashed with a strong algorithm, traffic is encrypted (HTTPS) and sign-in attempts are rate-limited. No system is perfectly secure, so please use a unique password.'] },
    ],
  },
}

const terms: Record<Lang, Doc> = {
  he: {
    title: 'תנאי שימוש',
    sections: [
      { h: 'מה זה Planit', p: ['Planit הוא כלי תכנון אישי למעקב אחרי יעדי חיסכון. החישובים הם הערכות מתמטיות לפי הנתונים והתשואה שהזנתם.'] },
      { h: 'אין ייעוץ', p: ['השירות אינו ייעוץ השקעות, ייעוץ מס או ייעוץ משפטי, ואינו תחליף ליועץ מורשה. תחזיות אינן מבטיחות תוצאות, ותשואות בפועל עשויות להיות שונות ואף שליליות.'] },
      { h: 'החשבון שלכם', p: ['אתם אחראים לשמור על סיסמה ייחודית ועל סודיות פרטי ההתחברות. אסור להשתמש בשירות בצורה שפוגעת בו או במשתמשים אחרים, או לנסות לגשת לנתונים של אחרים.'] },
      { h: 'זמינות ואחריות', p: ['השירות ניתן "כמות שהוא" ובלי התחייבות לזמינות רציפה. ככל שהחוק מתיר, איננו אחראים לנזק הנובע משימוש בשירות או מהסתמכות על התחזיות. מומלץ לשמור גיבוי של המידע החשוב לכם (ניתן לייצא מההגדרות).'] },
      { h: 'שינויים', p: ['אפשר שנעדכן את התנאים והמדיניות. שינוי מהותי יפורסם באתר.'] },
    ],
  },
  en: {
    title: 'Terms of use',
    sections: [
      { h: 'What Planit is', p: ['Planit is a personal planning tool for tracking savings goals. Calculations are mathematical estimates based on the data and return you enter.'] },
      { h: 'No advice', p: ['The service is not investment, tax or legal advice and is no substitute for a licensed adviser. Projections do not guarantee results; real returns may differ and may be negative.'] },
      { h: 'Your account', p: ['You are responsible for keeping a unique password and your sign-in details private. You must not misuse the service, harm other users, or try to access anyone else’s data.'] },
      { h: 'Availability and liability', p: ['The service is provided “as is” without any guarantee of uninterrupted availability. To the extent the law allows, we are not liable for damage arising from use of the service or reliance on its projections. Keep a backup of data that matters to you (you can export it from settings).'] },
      { h: 'Changes', p: ['We may update these terms and the privacy policy. Material changes will be announced on the site.'] },
    ],
  },
}

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { t, lang } = useI18n()
  const doc = (kind === 'privacy' ? privacy : terms)[lang]
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-extrabold">{doc.title}</h1>
      <p role="note" className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
        {t('legalDraft')}
      </p>
      <p className="text-sm text-slate-500">
        {t('lastUpdated')}: {UPDATED}
      </p>
      {doc.sections.map((s) => (
        <section key={s.h} className="space-y-2">
          <h2 className="text-xl font-semibold">{s.h}</h2>
          {s.p.map((para) => (
            <p key={para} className="leading-relaxed text-slate-300">
              {para}
            </p>
          ))}
        </section>
      ))}
      <Link to="/" className="btn-ghost">
        {t('backToLogin')}
      </Link>
    </article>
  )
}
