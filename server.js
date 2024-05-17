const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const schedule = require('node-schedule');
const moment = require('moment-timezone');
const {sendMail} = require('./mailer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = process.env.PORT || 3000;

let jobsArray = [];

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

if (process.env.NODE_ENV === 'production') {
  mongoose.connect(`mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PSWD}@db-mongodb-nyc3-41851-4069eb8b.mongo.ondigitalocean.com/nodemailer?replicaSet=db-mongodb-nyc3-41851&tls=true&authSource=admin`)
  .then(() => console.log('Connected to MongoDB'))
  .catch(error => console.error('Error connecting to MongoDB:', error));
} else {
  // MongoDB Connection
  mongoose.connect('mongodb://127.0.0.1:27017/mailerdb?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.1');
}


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
  timezone: String,
  attachments: [{
    filename: String,
    path: String,
    contentType: String,
  }], // assuming file paths
});
const Data = mongoose.model('Data', dataSchema);

const logSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  logLevel: String,
  logType: String,
  message: String
});
const Log = mongoose.model('Log', logSchema);

const jobSchema = new mongoose.Schema({
  jobId: String,
  status: { type: String, default: 'scheduled' },
  scheduledTime: String,
  nextInvocation: Date
});

// Create a model based on the schema
const Job = mongoose.model('Job', jobSchema);

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


// helper functions
async function scheduleAction(dataId, scheduledDate, timezone) {

  const userMoment = moment.tz(scheduledDate, timezone);

  const serverTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const serverMoment = userMoment.clone().tz(serverTimezone);

  // Schedule the action using node-schedule
  let job;
  const jobId = uuidv4();
  try {
    const currentDate = moment.tz(new Date(), timezone)
    const df = serverMoment.diff(currentDate, 'seconds')
    if (df < 0) {
      logToDB({logLevel: 'fatal', logType: 'Email Schedule', message: `Email scheduled in the past | Schedule submitted at ${moment.tz(new Date(), timezone)} | Email sent scheduled to ${moment.tz(scheduledDate, timezone)}`});
      throw 'Email scheduled in the past';
    }
    
    job = schedule.scheduleJob(serverMoment.toDate(), async function() {
      try {
        const data = await Data.findById(dataId);
        if (!data) {
          logToDB({logLevel: 'fatal', logType: 'Get email data', message: `Data with ID ${dataId} not found`});
          return;
        }

        const emailInfo = await sendMail(data)
        await Job.findOneAndUpdate({ jobId: jobId }, { status: 'sent' })
        logToDB({logLevel: 'success', logType: 'Email sent', message: `Email from ${data.email} | Sent to ${data.toemail} | Subject: ${data.subject} | Schedule submitted at ${moment.tz(data.timestamp, timezone)} | Email sent scheduled to ${moment.tz(scheduledDate, timezone)} | Current time (actual time email was sent): ${moment.tz(new Date(), timezone)} | Email status: accepted-${emailInfo.accepted}, rejected-${emailInfo.rejected} | Email ID ${emailInfo.messageId}`})
      } catch (error) {
        logToDB({logLevel: 'fatal', logType: 'Email sending', message: `Error sending email: ${error}`})
      }
    });
    jobsArray.push({id: jobId, job});

    const newJob = new Job({
      jobId,
      scheduledTime: scheduledDate,
      nextInvocation: job.nextInvocation()
    });
    newJob.save()
      .catch(error => {
        logToDB({logLevel: 'error', logType: 'Save job detail to db', message: `Error saving job to database: ${error} | Schedule submitted at ${moment.tz(data.timestamp, timezone)} | Email sent scheduled to ${moment.tz(scheduledDate, timezone)}`});
        throw 'Error saving job to database';
      })
  } catch (error) {
    logToDB({logLevel: 'fatal', logType: 'Email Schedule', message: `Error scheduling email: ${error}`})
    throw 'Error scheduling job'
  }
  
  
}


const uploadsDir = path.join(__dirname, 'uploads');
const exceptions = ['.gitkeep']; // Define exceptions here
// Function to delete files in uploads directory except for those in exceptions
function deleteFilesInUploadsDir() {
  fs.readdir(uploadsDir, (error, files) => {
      if (error) {
          logToDB({logLevel: 'minor', logType: 'Delete files manual', message: `Error reading directory: ${error}`});
          throw 'Error reading directory';
      }

      files.forEach(file => {
          if (!exceptions.includes(file)) { // Check if file is not in exceptions
              const filePath = path.join(uploadsDir, file);
              fs.unlink(filePath, error => {
                  if (error) {
                      logToDB({logLevel: 'minor', logType: 'Delete files manual - one file', message: `Error deleting file: ${file} | ${error}`});
                      throw `Error deleting file: ${file}`;
                  }
              });
          }
      });
  });
}

function logToDB(message) {
  const newLog = new Log( message );
  newLog.save()
    // .then(() => {
    //   console.log('Log saved successfully');
    // })
    .catch(error => {
      console.error('Error saving log:', error);
    });
}




// Routes
app.post('/submit', upload.array('attachments', 5), (req, res) => {
  const { name, email, toemail, password, subject, mailText, datetime, timezone } = req.body;
  const attachments = req.files.map(file => {
    return {
      filename: file.originalname,
      path: file.path,
      contentType: file.mimetype,
    };
  });
  
  const newData = new Data({ name, email, toemail, password, subject, mailText, sendTime:datetime, timezone, attachments });
  newData.save()
    .then(async () => {
      try {
      // Schedule the action
        await scheduleAction(newData._id, datetime, timezone);
        res.redirect('/success');
      } catch (error) {
        logToDB({logLevel: 'fatal', logType: 'Submit email schedule', message: `Error submitting schedule: ${error}`});
        res.redirect('/error');
      }
    })
    .catch(error => {
      logToDB({logLevel: 'fatal', logType: 'Submit email schedule', message: `Error submitting schedule: ${error}`});
      res.redirect('/error');
  });
});

// Route for success page
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Route for error page
app.get('/error', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'error.html'));
} );

app.get('/getLogs', (req, res) => {
  Log.find().sort({ timestamp: -1 })
    .then(logs => {
      res.json(logs);
    })
    .catch(error => {
      res.status(500).send('Error retrieving logs');
      logToDB({logLevel: 'error', logType: 'Retrieve logs', message: `Error retrieving logs: ${error}`});
    });
});

app.get('/getJobs', (req, res) => {
  Job.find().sort({ scheduledTime: -1 })
    .then(jobs => {
      res.json(jobs);
    })
    .catch(error => {
      res.status(500).send('Error retrieving jobs');
      logToDB({logLevel: 'error', logType: 'Retrieve jobs', message: `Error retrieving jobs: ${error}`});
    });
});

app.post('/cancelJob', async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = jobsArray.find(job => job.id === jobId);
    if (job) {
      job.job.cancel();
      jobsArray.splice(jobsArray.indexOf(job), 1);
    }

    // Update the job status in the database
    await Job.findOneAndUpdate({ jobId: jobId }, { status: 'cancelled' })
    res.status(200).send('Job canceled successfully');
    
  } catch (error) {
    res.redirect('/error');
    logToDB({logLevel: 'fatal', logType: 'Cancel job', message: `Error cancelling job: ${error}`});
  }
});

app.post('/cancelAllJobs', async (req, res) => {
  try {
    // Cancel all jobs
    jobsArray.forEach(job => job.job.cancel());
    jobsArray = [];

    // Update all jobs in the database
    await Job.updateMany({}, { status: 'cancelled' })
    res.status(200).send('Jobs canceled successfully');
  } catch (error) {
    res.redirect('/error');
    logToDB({logLevel: 'fatal', logType: 'Cancel all jobs', message: `Error cancelling all jobs: ${error}`});
  }
});

app.post('/delete-files', (req, res) => {
  try {
    deleteFilesInUploadsDir();
    res.redirect('/files-delete-success');
  } catch (error) {
    res.status(500).send('Error deleting files');
    logToDB({logLevel: 'error', logType: 'Delete files', message: `Error deleting files: ${error}`});
  }
});

app.get('/files-delete-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'files-delete-success.html'));
});


app.post('/delete-logs', (req, res) => {
  Log.deleteMany({})
    .then(() => {
      res.redirect('/logs-delete-success');
    })
    .catch(error => {
      res.status(500).send('Error deleting logs');
      logToDB({logLevel: 'error', logType: 'Delete logs', message: `Error deleting logs: ${error}`});
    });
});

app.get('/logs-delete-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logs-delete-success.html'));
});

app.post('/delete-jobs-db', (req, res) => {
  Job.deleteMany({})
    .then(() => {
      res.redirect('/jobs-db-delete-success');
    })
    .catch(error => {
      res.status(500).send('Error deleting jobs db');
      logToDB({logLevel: 'error', logType: 'Delete jobs db', message: `Error deleting jobs db: ${error}`});
    });
});

app.get('/jobs-db-delete-success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'jobs-delete-success.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
