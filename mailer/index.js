const nodemailer = require("nodemailer");

async function sendMail(data) {
  // console.log('🚀 ~ sendMail ~ data:', data)
  // send mail with defined transport object
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.centrum.cz",
      port: 465,
      secure: true, // Use `true` for port 465, `false` for all other ports
      auth: {
        user: `${data.email}`,//"lukas.houf@centrum.cz",
        // pass: `${data.password}`//"Heslo pro centrum.1",
        pass:`${data.password}`,
      },
    });


    const info = await transporter.sendMail({
      from: `"${data.name}" <${data.email}>`, // sender address
      to: `${data.toemail}`, // list of receivers
      subject: `${data.subject}`, // Subject line
      // text: `${data.mailText}`,//"", // plain text body
      html: `${data.mailText}`, // html body
      attachments: data.attachments.map(attachment => {
        return {
          filename: attachment.filename,
          path: attachment.path,
          contentType: attachment.contentType,
        };
      })
    });
  
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch(e) {
    console.error(e);
    throw e;
  }
}

exports.sendMail = sendMail;