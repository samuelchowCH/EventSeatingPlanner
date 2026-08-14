import validator from 'validator';
import nodemailer from 'nodemailer';
import { ALLOWED_PLACEHOLDERS } from '../../src/utils/emailRenderer';

// Re-export shared browser-safe rendering utilities from the frontend-safe module
export {
  ALLOWED_PLACEHOLDERS,
  escapeHtml,
  renderTextTemplate,
  renderHtmlFromText,
  type RenderContext,
} from '../../src/utils/emailRenderer';

export function validateHeaderField(fieldValue: string, fieldName: string): string {
  if (!fieldValue) return '';
  // Reject CR (\r), LF (\n), NUL (\0), and control characters
  if (/[\r\n\0\x00-\x1F\x7F]/.test(fieldValue)) {
    throw new Error(`Prohibited control character or newline detected in header field '${fieldName}'`);
  }
  return fieldValue.trim();
}

export function validateEmailAddress(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (/[\r\n\0\x00-\x1F\x7F]/.test(email)) return false;
  return validator.isEmail(email.trim());
}

export function validateTemplatePlaceholders(templateText: string): void {
  const matches = templateText.match(/\{\{[^}]+\}\}/g) || [];
  for (const match of matches) {
    if (!ALLOWED_PLACEHOLDERS.includes(match)) {
      throw new Error(`Unsupported placeholder '${match}' in template. Allowed placeholders: ${ALLOWED_PLACEHOLDERS.join(', ')}`);
    }
  }
}


export async function buildRawMimeMessage(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
}): Promise<string> {
  const cleanFrom = validateHeaderField(options.from, 'From');
  const cleanTo = validateHeaderField(options.to, 'To');
  const cleanSubject = validateHeaderField(options.subject, 'Subject');
  const cleanReplyTo = options.replyTo ? validateHeaderField(options.replyTo, 'Reply-To') : undefined;

  let processedHtml = options.html;
  const attachments: nodemailer.SendMailOptions['attachments'] = [];

  // Convert inline base64 data URLs into CID attachments for Gmail compatibility
  const imgRegex = /src="(data:(image\/[a-zA-Z0-9+-]+);base64,([^"]+))"/g;
  let match: RegExpExecArray | null;
  let imgIndex = 1;

  while ((match = imgRegex.exec(options.html)) !== null) {
    const fullDataUrl = match[1];
    const mimeType = match[2];
    const base64Data = match[3];
    const ext = mimeType.split('/')[1] || 'png';
    const cid = `inline_img_${imgIndex}@seatingplanner`;

    attachments.push({
      filename: `image_${imgIndex}.${ext}`,
      content: Buffer.from(base64Data, 'base64'),
      cid: cid,
    });

    processedHtml = processedHtml.replace(fullDataUrl, `cid:${cid}`);
    imgIndex++;
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: cleanFrom,
    to: cleanTo,
    subject: cleanSubject,
    text: options.text,
    html: processedHtml,
    attachments: attachments.length > 0 ? attachments : undefined,
    replyTo: cleanReplyTo,
  };

  if (options.listUnsubscribeUrl) {
    mailOptions.headers = {
      'List-Unsubscribe': `<${options.listUnsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  // Create Nodemailer stream transport (captures raw MIME message in memory)
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: 'windows',
  });

  const info = await transporter.sendMail(mailOptions);
  const rawBuffer: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const messageStream = info.message as any;
    if (Buffer.isBuffer(messageStream)) {
      resolve(messageStream);
    } else {
      messageStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      messageStream.on('end', () => resolve(Buffer.concat(chunks)));
      messageStream.on('error', reject);
    }
  });

  // Gmail API requires base64url encoded RFC 2822 message
  return rawBuffer.toString('base64url');
}
