import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
      clientId: process.env.OAUTH_CLIENTID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN
    }
});

export const sendMail = async (mailOptions) => {
    try {
        mailOptions.from = process.env.MAIL_USERNAME;
        await transporter.sendMail(mailOptions);
        return { status: 200, message: 'Mail sent successfully' };
    } catch (error) {
        return { status: 500, message: error.message };
    }
}
