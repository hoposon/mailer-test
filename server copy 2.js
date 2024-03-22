const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const Grid = require('gridfs-stream');
const { ObjectID } = require('mongodb'); // Import ObjectID from mongodb
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/mailerdb?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.1');

const connection = mongoose.connection;

// Initialize GridFS
let gfs;
connection.once('open', () => {
  gfs = Grid(connection.db, mongoose.mongo);
  gfs.collection('attachments');
});

// GridFS storage configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Schema definition
const Schema = mongoose.Schema;
const dataSchema = new Schema({
  name: String,
  email: String,
  password: String,
  mailText: String,
  sendTime: { type: Date, default: Date.now },
  attachments: [Schema.Types.ObjectId], // Storing file IDs
});
const Data = mongoose.model('Data', dataSchema);

// Routes
app.post('/submit', upload.array('attachments', 5), (req, res) => {
  const { name, email, password, mailText, datetime } = req.body;
  const attachments = [];

  req.files.forEach(file => {
    const writestream = gfs.createWriteStream({
      filename: file.originalname
    });
    writestream.write(file.buffer);
    writestream.end();
    writestream.on('close', function (file) {
      attachments.push(new ObjectID(file._id));
      // if (attachments.length === req.files.length) {
      //   saveDataWithAttachments(name, email, password, mailText, datetime , attachments, res);
      // }
    });
  });
  if (attachments.length === req.files.length) {
    saveDataWithAttachments(name, email, password, mailText, datetime , attachments, res);
  }
});

function saveDataWithAttachments(name, email, password, mailText, datetime, attachments, res) {
  const newData = new Data({ name, email, password, mailText, sendTime: datetime, attachments });
  newData.save()
    .then(() => {
      res.redirect('/success');
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error saving data');
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
