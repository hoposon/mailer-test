const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const {GridFsStorage} = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/mailerdb?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.1');

const connection = mongoose.connection;

let gfs;
connection.once('open', () => {
  gfs = Grid(connection.db, mongoose.mongo);
  gfs.collection('attachments');
});

// GridFS storage configuration
const storage = new GridFsStorage({
  url: 'mongodb://127.0.0.1:27017/mailerdb?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.2.1',
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: 'attachments',
    };
  },
});

const upload = multer({ storage });

// Schema definition
const Schema = mongoose.Schema;
const dataSchema = new Schema({
  name: String,
  email: String,
  password: String,
  mailText: String,
  sendTime: { type: Date, default: Date.now },
  attachments: [mongoose.Types.ObjectId], // storing GridFS file IDs
});
const Data = mongoose.model('Data', dataSchema);

// // File Upload Configuration
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'uploads/');
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
//   },
// });

// const upload = multer({ storage: storage });

// Routes
app.post('/submit', upload.array('attachments', 5), (req, res) => {
  const { name, email, password, mailText, datetime } = req.body;
  const attachments = req.files.map(file => file.path);
  
  const newData = new Data({ name, email, password, mailText, sendTime: datetime, attachments });
  newData.save()
    .then(() => {
      // res.status(200).send('Data saved successfully');
      res.redirect('/success');
    })
    .catch(err => {
      console.error(err);
      res.status(500).send('Error saving data');
    });
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});