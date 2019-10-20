var nodemailer = require('nodemailer')

const config = {
    host: 'smtp.mxhichina.com',
    port: 465,
    secure:true,
    auth: {
        user: 'admin@vjujiao.com', 
        pass: 'Kelianren2009' 
    }
}

const transporter = nodemailer.createTransport(config)

function sendEmail(email, callback) {
    transporter.sendMail(email, callback)
}

//激活账号的邮件模板
function createActivationEmail(email, code) {
    return {
        from: config.auth.user,
        to: email,
        subject: "安全码",
        text: "安全码:" + code
    }
}

//找回密码的邮件模板
function createFindPasswordEmail(email, code) {
    return {
        from: config.auth.user,
        to: email,
        subject: "找回密码",
        text: "安全码:" + code
    }
}

//随机生成激活码
function randomCode(){
    return Math.floor(Math.random() * 1000000);
}

module.exports = {
    sendEmail,
    createActivationEmail,
    createFindPasswordEmail,
    randomCode
};