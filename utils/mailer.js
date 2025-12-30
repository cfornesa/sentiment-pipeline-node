/**
 * ================================================================================
 * PROJECT: Sovereign Mailer Service
 * MISSION: Authenticated SMTP transport for direct researcher dispatches.
 * ARCHITECT: Christopher Fornesa
 * ================================================================================
 */

const nodemailer = require('nodemailer');

/**
 * Creates the reusable SMTP transporter.
 * Configuration is pulled from environment variables (.env) to maintain 
 * credential security.
 */
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 465,
    secure: true, // Port 465 (SSL/TLS)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * DISPATCHER: sendInquiry
 * Purpose: Routes inquiries directly to the provisioned researcher.
 * Privacy Check: Explicitly excludes BCC/CC to Hub administrators.
 */
const sendInquiry = async (researcherEmail, senderEmail, subject, message) => {
    const mailOptions = {
        from: `"Sovereign Hub Agent" <${process.env.SMTP_USER}>`,
        to: researcherEmail, // Dynamic Sovereign Routing
        replyTo: senderEmail, // Allows researcher to reply directly to inquirer
        subject: `[Sovereign Hub] ${subject}`,
        html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #05386B;">New Institutional Inquiry</h2>
                <p><b>Sender:</b> ${senderEmail}</p>
                <hr style="border: 0; border-top: 1px solid #eee;">
                <p style="white-space: pre-wrap;">${message}</p>
                <p style="font-size: 11px; color: #64748b; margin-top: 20px;">
                    This inquiry was routed via the Sovereign Engine. No data has been persisted.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error("Mailer Dispatch Error:", error);
        throw new Error("SMTP Gateway Handshake Failed.");
    }
};

module.exports = { sendInquiry };