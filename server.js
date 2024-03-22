const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const schedule = require('node-schedule');
const {sendMail} = require('./mailer');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/mailerdb?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.1');

// Schema definition
const Schema = mongoose.Schema;
const dataSchema = new Schema({
  name: String,
  email: String,
  password: String,
  subject: String,
  mailText: String,
  sendTime: Date,
  attachments: [{
    filename: String,
    path: String,
    contentType: String,
  }], // assuming file paths
});
const Data = mongoose.model('Data', dataSchema);

// File Upload Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Routes
app.post('/submit', upload.array('attachments', 5), (req, res) => {
  const { name, email, password, subject, mailText, datetime } = req.body;
  const attachments = req.files.map(file => {
    return {
      filename: file.originalname,
      path: file.path,
      contentType: file.mimetype,
    };
  });
  
  const newData = new Data({ name, email, password, subject, mailText, sendTime:datetime, attachments });
  newData.save()
    .then(() => {
      // Schedule the action
      scheduleAction(newData._id, datetime);
      res.redirect('/success');
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error saving data');
  });
});

function scheduleAction(dataId, scheduledDate) {
  // Schedule the action using node-schedule
  const job = schedule.scheduleJob(scheduledDate, async function() {
    // Perform the action here
    console.log(`Action scheduled for data ID ${dataId} executed at ${scheduledDate}`);
    try {
      // Retrieve data from the database
      const data = await Data.findById(dataId);
      if (!data) {
        console.error(`Data with ID ${dataId} not found`);
        return;
      }
      
      // Perform the action using the retrieved data
      // console.log(`Action scheduled for data ID ${dataId} executed at ${scheduledDate}`);
      // console.log('Retrieved data:', data);
      sendMail(data)
    } catch (error) {
      console.error('Error scheduled action:', error);
    }

    // sendMail()
  });
}

// Route for success page
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
