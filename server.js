const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const schedule = require('node-schedule');
const {sendMail} = require('./mailer');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
// mongoose.connect('mongodb://127.0.0.1:27017/mailerdb?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.1');
mongoose.connect(`mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PSWD}@db-mongodb-nyc3-41851-4069eb8b.mongo.ondigitalocean.com/nodemailer?replicaSet=db-mongodb-nyc3-41851&tls=true&authSource=admin`);

// Schema definition
const Schema = mongoose.Schema;
const dataSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  name: String,
  email: String,
  toemail: String,
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
  const { name, email, toemail, password, subject, mailText, datetime } = req.body;
  const attachments = req.files.map(file => {
    return {
      filename: file.originalname,
      path: file.path,
      contentType: file.mimetype,
    };
  });
  
  const newData = new Data({ name, email, toemail, password, subject, mailText, sendTime:datetime, attachments });
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

async function scheduleAction(dataId, scheduledDate) {
  // Schedule the action using node-schedule
  const job = schedule.scheduleJob(scheduledDate, async function() {
    // Perform the action here
    // console.log(`Action scheduled for data ID ${dataId} executed at ${scheduledDate}`);
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
      const emailId = await sendMail(data)
      logToDB(`Email from ${data.email} sent to ${data.toemail} with ID ${emailId} at ${scheduledDate}. Send scheduled at ${data.timestamp}. Current time: ${new Date()}`)
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

app.post('/delete-files', (req, res) => {
  try {
    deleteFilesInUploadsDir();
    res.redirect('/files-delete-success');
  } catch (error) {
    console.error('Error deleting files:', error);
    res.status(500).send('Error deleting files');
  }
});

app.get('/files-delete-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files-delete-success.html'));
});

const uploadsDir = path.join(__dirname, 'uploads');
const exceptions = ['.gitkeep']; // Define exceptions here

// Function to delete files in uploads directory except for those in exceptions
function deleteFilesInUploadsDir() {
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            console.error('Error reading directory:', err);
            return;
        }

        files.forEach(file => {
            if (!exceptions.includes(file)) { // Check if file is not in exceptions
                const filePath = path.join(uploadsDir, file);
                fs.unlink(filePath, err => {
                    if (err) {
                        console.error('Error deleting file:', err);
                        return;
                    }
                    // console.log(`${file} has been deleted successfully`);
                });
            }
        });
    });
}

const logSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  message: String
});
const Log = mongoose.model('Log', logSchema);

app.post('/logs', (req, res) => {
  Log.find().sort({ timestamp: -1 })
    .then(logs => {
      res.json(logs);
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error retrieving logs');
    });
});

function logToDB(message) {
  const newLog = new Log({ message });
  newLog.save()
    // .then(() => {
    //   console.log('Log saved successfully');
    // })
    .catch(err => {
      console.error('Error saving log:', err);
    });
}

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
