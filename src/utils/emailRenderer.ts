/**
 * Browser-safe email template rendering utilities.
 * NO Node.js imports — safe to import in frontend components.
 */

export const ALLOWED_PLACEHOLDERS = [
  '{{guest_name}}',
  '{{event_name}}',
  '{{table_name}}',
  '{{venue_name}}',
  '{{unsubscribe_url}}',
];

export interface RenderContext {
  guest_name: string;
  event_name: string;
  table_name?: string;
  venue_name?: string;
  unsubscribe_url?: string;
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderTextTemplate(templateRaw: string, ctx: RenderContext): string {
  let result = templateRaw;
  result = result.replace(/\{\{guest_name\}\}/g, ctx.guest_name || 'Guest');
  result = result.replace(/\{\{event_name\}\}/g, ctx.event_name || 'the event');
  result = result.replace(/\{\{table_name\}\}/g, ctx.table_name || 'Unassigned');
  result = result.replace(/\{\{venue_name\}\}/g, ctx.venue_name || '');
  result = result.replace(/\{\{unsubscribe_url\}\}/g, ctx.unsubscribe_url || '#');
  return result;
}

export function renderHtmlFromText(templateRaw: string, ctx: RenderContext): string {
  const escapedGuestName = escapeHtml(ctx.guest_name || 'Guest');
  const escapedEventName = escapeHtml(ctx.event_name || 'the event');
  const escapedTableName = escapeHtml(ctx.table_name || 'Unassigned');
  const escapedVenueName = escapeHtml(ctx.venue_name || '');
  const unsubscribeUrl = ctx.unsubscribe_url || '#';

  let text = templateRaw || '';
  text = text.replace(/\{\{guest_name\}\}/g, escapedGuestName);
  text = text.replace(/\{\{event_name\}\}/g, escapedEventName);
  text = text.replace(/\{\{table_name\}\}/g, escapedTableName);
  text = text.replace(/\{\{venue_name\}\}/g, escapedVenueName);
  text = text.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);

  let bodyContent = text;
  // If it's plain text without HTML block tags (<p>, <div>, etc.), format into HTML paragraphs
  if (!/<(p|div|section|article|table)\b/i.test(text)) {
    bodyContent = text
      .split(/\n{2,}/)
      .map((p) => {
        if (/^\s*<img\s+[^>]+>\s*$/i.test(p)) {
          return `<div style="margin-bottom: 16px;">${p}</div>`;
        }
        return `<p style="margin-bottom: 16px; line-height: 1.6; color: #2C2C2C; font-family: Inter, sans-serif;">${p.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');
  } else {
    // Inject default inline paragraph styles into <p> tags missing style attributes
    bodyContent = bodyContent.replace(/<p(\s|>)/gi, (match, suffix) => {
      return `<p style="margin-bottom: 16px; line-height: 1.6; color: #2C2C2C; font-family: Inter, sans-serif;"${suffix.startsWith('>') ? '>' : suffix}`;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          p { margin-bottom: 16px !important; line-height: 1.6 !important; color: #2C2C2C; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body style="background-color: #FAF7F2; margin: 0; padding: 24px; font-family: Inter, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 32px; border: 1px solid rgba(201,169,110,0.25); border-radius: 4px;">
          ${bodyContent}
          ${
            ctx.unsubscribe_url
              ? `<hr style="border: none; border-top: 1px solid #eeeeee; margin-top: 32px; margin-bottom: 16px;"/>
                 <p style="font-size: 11px; color: #888888; text-align: center;">
                   Prefer not to receive updates for this event? <a href="${unsubscribeUrl}" style="color: #C9A96E; text-decoration: underline;">Unsubscribe here</a>.
                 </p>`
              : ''
          }
        </div>
      </body>
    </html>
  `;
}
