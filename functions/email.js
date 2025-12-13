/**
 * Serverless function to send emails using Resend.
 * Requires RESEND_API_KEY environment variable in Cloudflare.
 */
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();
    
    // Use the environment variable. 
    // CRITICAL: Ensure RESEND_API_KEY is set in Cloudflare Dashboard.
    const API_KEY = env.RESEND_API_KEY;

    if (!API_KEY) {
      console.error("Missing RESEND_API_KEY");
      return new Response(JSON.stringify({ error: "Server Configuration Error: Missing RESEND_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // NOTE: 'onboarding@resend.dev' ONLY works for the verified email account owner.
    // To send to others, you must verify a domain in Resend and update 'from'.
    const fromAddress = "TenderWatch <onboarding@resend.dev>";

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddress, 
        to: body.to,
        subject: body.subject,
        html: body.html
      })
    });

    const responseText = await resendResponse.text();

    if (!resendResponse.ok) {
      console.error("Resend API Failed:", responseText);
      return new Response(JSON.stringify({ error: "Resend API Failed", details: responseText }), {
        status: resendResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}