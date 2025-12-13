import { Tender } from "../types";
import { EMAIL_RECIPIENTS } from "../constants";

export const generateEmailHTML = (tenders: Tender[]) => {
  if (tenders.length === 0) return null;

  const subject = `[TenderWatch] ${tenders.length} New Opportunities Found`;
  
  // Create a nice HTML table for the email
  let html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #2563eb;">Tender Watch Report</h2>
      <p>Found <strong>${tenders.length}</strong> new tenders matching your criteria (Last 30 Days).</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
  `;

  tenders.forEach((t, index) => {
    html += `
      <div style="margin-bottom: 24px; padding: 15px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; font-size: 16px;">${index + 1}. <a href="${t.url}" style="color: #2563eb; text-decoration: none;">${t.title}</a></h3>
        <p style="font-size: 12px; color: #64748b; margin: 5px 0;">Source: <strong>${t.source}</strong> | Date: ${t.dateFound}</p>
        <p style="font-size: 14px; line-height: 1.5;">${t.snippet}</p>
        <div style="margin-top: 10px;">
          ${t.keywordsFound.map(k => `<span style="display:inline-block; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:11px; margin-right:5px;">${k}</span>`).join('')}
        </div>
      </div>
    `;
  });

  html += `
    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
    <p style="font-size: 12px; color: #999;">Automated by TenderWatch AI (GCP)</p>
    </div>
  `;

  return { subject, html };
};

export const triggerMailto = async (tenders: Tender[]): Promise<{success: boolean, method: 'api' | 'mailto'}> => {
  const content = generateEmailHTML(tenders);
  if (!content) return { success: false, method: 'api' };

  try {
    console.log("Attempting to send email via Server API...");
    // Call our Express Server Endpoint
    const response = await fetch('/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: EMAIL_RECIPIENTS,
        subject: content.subject,
        html: content.html
      })
    });

    // Check strict JSON response
    const contentType = response.headers.get("content-type");
    if (!response.ok || !contentType || !contentType.includes("application/json")) {
      const text = await response.text();
      throw new Error(`Backend Error: ${response.status} - ${text}`);
    }

    console.log("Email sent successfully via API!");
    return { success: true, method: 'api' };

  } catch (error) {
    console.warn("Email API failed, triggering Mailto fallback:", error);
    
    // Fallback to mailto
    const plainTextBody = tenders.map(t => 
      `${t.title}\nSource: ${t.source}\nLink: ${t.url}\nKeywords: ${t.keywordsFound.join(', ')}`
    ).join('\n\n-------------------\n\n');

    const mailtoLink = `mailto:${EMAIL_RECIPIENTS.join(",")}?subject=${encodeURIComponent(content.subject)}&body=${encodeURIComponent(plainTextBody)}`;
    
    // Try window.open first
    const newWindow = window.open(mailtoLink, '_blank');
    
    if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
        window.location.href = mailtoLink;
    }

    return { success: true, method: 'mailto' };
  }
};