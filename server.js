const express = require('express')
const bodyParser = require('body-parser')
require('dotenv').config();
const cors = require('cors')
const mongoose = require('mongoose');
const User = require('./models/user');
const Exercise = require('./models/exercise');

const app = express()

mongoose.connect(process.env.MONGO_URI,{ useNewUrlParser: true, useUnifiedTopology: true }).then(()=> console.log('DB connected')
).catch( err => console.log(err)
);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

// create New User
app.post('/api/exercise/new-user', (req, res)=>{
  
  const username = req.body.username;

  if (username === '') {
    res.send("Username cannot be blank")
  } else if (username.length > 10) {
    res.send("Username too long")
  } else {
    const newUser = new User({
      username,
    });

    newUser.save((err, data) => {
      if (err) {
        if (err.name==='MongoError' && err.code === 11000) {
          //Duplicate Key error
          res.send("Username already taken, try a different name");
        } else {
          res.send("Error occured while saving user")
        }
      } else {
        res.json(data)
      }
    })
  }
})



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
