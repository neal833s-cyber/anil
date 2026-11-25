import nodemailer from 'nodemailer';
import { logger } from './logger.js';

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'MeroBazaar'}" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error(`Email send failed: ${error.message}`);
    throw error;
  }
};

export const sendOtpEmail = (to, otp) =>
  sendEmail({
    to,
    subject: 'MeroBazaar - Email Verification OTP',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fd;border-radius:16px;">
        <h2 style="color:#1D3557;margin:0 0 16px;">Email Verification</h2>
        <p>Your one-time password (OTP) to verify your MeroBazaar account:</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#E63946;background:#fff;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:14px;">This OTP expires in ${process.env.OTP_EXPIRE_MINUTES || 10} minutes. Do not share it with anyone.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px;">© 2024 MeroBazaar. If you did not request this, please ignore.</p>
      </div>
    `,
  });

export const sendPasswordResetEmail = (to, resetUrl) =>
  sendEmail({
    to,
    subject: 'MeroBazaar - Password Reset Request',
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fd;border-radius:16px;">
        <h2 style="color:#1D3557;margin:0 0 16px;">Password Reset</h2>
        <p>You requested a password reset. Click the button below to set a new password:</p>
        <a href="${resetUrl}" style="display:inline-block;background:#E63946;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:24px 0;">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:14px;">This link expires in 10 minutes. If you didn't request this, ignore this email.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px;">© 2024 MeroBazaar</p>
      </div>
    `,
  });

export const sendOrderConfirmationEmail = (to, order) =>
  sendEmail({
    to,
    subject: `MeroBazaar - Order #${order.orderNumber} Confirmed`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8f9fd;border-radius:16px;">
        <h2 style="color:#1D3557;">Order Confirmed! 🎉</h2>
        <p>Thank you for your order. Here's your summary:</p>
        <div style="background:#fff;border-radius:12px;padding:16px;margin:16px 0;">
          <p><strong>Order #:</strong> ${order.orderNumber}</p>
          <p><strong>Total:</strong> Rs ${order.totalPrice}</p>
          <p><strong>Payment:</strong> ${order.paymentMethod}</p>
          <p><strong>Status:</strong> ${order.status}</p>
        </div>
        <p style="color:#6b7280;font-size:12px;margin-top:32px;">© 2024 MeroBazaar</p>
      </div>
    `,
  });
