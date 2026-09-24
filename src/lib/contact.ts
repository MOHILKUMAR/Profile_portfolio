import type { Translate } from '../i18n/utils';

/**
 * A mailto link that opens a new email already addressed to the site owner,
 * with a subject and opening line filled in so the visitor only has to write.
 * encodeURIComponent writes spaces as %20 and line breaks as %0A, which every
 * mail client reads correctly; a + would show up literally in some of them.
 */
export function mailtoHref(email: string, t: Translate): string {
  const subject = encodeURIComponent(t('contact.emailSubject'));
  const body = encodeURIComponent(t('contact.emailBody'));
  return `mailto:${email}?subject=${subject}&body=${body}`;
}
