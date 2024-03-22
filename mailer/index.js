const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//   host: "smtp.centrum.cz",
//   port: 465,
//   secure: true, // Use `true` for port 465, `false` for all other ports
//   auth: {
//     user: "lukas.houf@centrum.cz",
//     pass: "Heslo pro centrum.1",
//   },
// });

// async..await is not allowed in global scope, must use a wrapper
async function sendMail(data) {
  console.log('🚀 ~ sendMail ~ data:', data)
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
      from: `"${data.name}" <${data.email}>`,//'"Lukas Houf" <lukas.houf@centrum.cz>', // sender address
      to: "lukas.houf@gmail.com, hoposon@gmail.com", // list of receivers
      subject: `${data.subject}`, //"Lukas Houf CV", // Subject line
      // text: `${data.mailText}`,//"", // plain text body
      html: `${data.mailText}`,//"<p>Hello,</br> my name is Lukas Houf and I am sending my CV in the attachment. I hope you will find it interesting and I am looking forward to your response. </br></br>Have a nice day. </br>Lukas Houf</p>", // html body
      attachments: data.attachments.map(attachment => {
        return {
          filename: attachment.filename,
          path: attachment.path,
          contentType: attachment.contentType,
        };
      })
      // [
      //   {
      //     filename: 'LukasHouf_CV_EN_dev.docx',
      //     path: './attachements/LukasHouf_CV_EN_dev.docx',
      //     contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      //   }
      // ]
    });
  
    console.log("Message sent: %s", info.messageId);
    // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
  } catch(e) {
    console.error(e);
  }
}

exports.sendMail = sendMail;