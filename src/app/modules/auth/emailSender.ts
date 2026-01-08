import nodemailer from 'nodemailer'
import config from '../../../config';
//he
import envVars from '../../config/env';

const emailSender = async (
    email: string,
    html: string
) => {
    const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // Use `true` for port 465, `false` for all other ports
        auth: {
            user: envVars.EMAIL,
            pass: envVars.APP_PASS,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const info = await transporter.sendMail({
        from: '"Tour Nest" <farhadhossen2590@gmail.com>', // sender address
        to: email, // list of receivers
        subject: "Reset Password Link", // Subject line
        //text: "Hello world?", // plain text body
        html, // html body
    });

}

export default emailSender;