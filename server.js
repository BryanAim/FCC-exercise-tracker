//////////////////////////////
///////// CORE SETUP /////////
//////////////////////////////

// Let's start by setting up our server, requiring all needed dependencies and "activating" them.
// Remember that any packages/dependencies that we require should be in the package.json file, from which Node.js will check the version and fetch the packages

// First things first, let's set up our Express.js framework, which will make it easier to set up our web app/site:
const express = require('express')
// We'll define our express so we can access/use it:
const app = express()

// We'll be using the body-parser middleware to parse any incoming request (e.g. GET, POST) bodies before our handlers, making it easy to access the user's input within req.body...
const bodyParser = require('body-parser')

// ... by setting it to urlencoded, it will only parse urlencoded bodies. By setting the option extended=false, the bodyParser will only parse string and array types.
app.use(bodyParser.urlencoded({extended: false}))

// ... we'll also make the bodyParser parse incoming JSON requests to be able to handle the exercise log queries with parameters for a userID, limit, and date range.
app.use(bodyParser.json());

// For freeCodeCamp to be able to test the project remotely, we need to enable CORS (https://en.wikipedia.org/wiki/Cross-origin_resource_sharing):
const cors = require('cors');
app.use(cors());

//We'll use the dotenv package to aba able to read .env variables
require('dotenv').config();

// We'll be using a database to hold and keep track of our users' exercise data. For this, we'll be using a no-SQL MongoDB database. We'll use Mongoose.js as the "front-end" for our DB.
const mongoose = require('mongoose');
// When we connect tyo our DB via Mongoose, we'll keep an eye on our connection with a callback function to make sure all is well with our connection:
mongoose.connect(process.env.MONGO_URI,{ useNewUrlParser: true, useUnifiedTopology: true }).then(()=> console.log('DB connected')
).catch( err => console.log(err)
);


const User = require('./models/user');
const Exercise = require('./models/exercise');

// Finally, we're saving our functions in handlers/userHandler.js, so let's make sure that the file is accessible here:
const userHandler = require("./handlers/userHandler.js");



app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


// Not found middleware
// app.use((req, res, next) => {
//   return next({status: 404, message: 'not found'})
// })

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

//create new exercise route

app.post('/api/exercise/add', (req, res) => {
  const username = req.body.username;
  const description = req.body.description;
  const duration = req.body.duration;
  const date = req.body.date;
  let userId;

  if ((username=== undefined) || (description === undefined) || (duration === undefined) || (date === undefined)) {
    res.send("Required field(s) are missing.");
  } else if (username === '' || description === '' || duration === '') {
    res.send("Required field(s) are blank")
  } else if (username.length > 10) {
    res.send("Username too long, cannot be more than 10 characters")
  } else if (description.length > 100) {
    res.send("Description length too long, should not be more than 100 characters")
  } else if (isNaN(duration)) {
    res.send("Duration must be a number")
  } else if (Number(duration)> 1440) {
    res.send("Duration cannot be more than 1440 minutes, (24 hours)")
  } else if (date !== '' && isNaN(Date.parse(date))=== true) {
    res.send("Thats not a valid date")
  } else {
   // find userID for username
   User.findOne({ username}, (err, user)=> {
     if (err) {
       res.send("Error Searching for username, try again")
     } else if (!user) {
       res.send("Username not found")
     } else {
       userId = user.id;
       // validations passed, convert duration
       duration = Number(duration);

       //convert date
       if (date=== '') {
         date = new Date()
       } else {
         date = Date.parse(date);
       }

       const newExercise = new Exercise({
         userId,
         description,
         duration,
         date,
       });

       newExercise.save((errSave, data)=> {
         if (errSave) {
           res.send("Error occured during save exercise");
         } else {
           res.json(data)
         }
       });
     }
   });
  }
});

// read exercise route

app.get('/api/exercise/:log', (req,res) => {
  const username = req.query.username;
  let from = req.query.from;
  let to = req.query.to;
  let limit = req.query.limit;
  let userId;
  const query = {};

  if (username===undefined) {
    res.send("Username is undefines");

  } else if (username=== '') {
    res.send("Username is blank")
  } else if (username.length> 10) {
    res.send("Username cannot be more than 10 characters");
  } else if (from !== undefined &&isNaN(Date.parse(from))===true) {
    res.send("From is not a valid date");
  } else if (to !== undefined && isNaN(Date.parse(to))=== true) {
    res.send("to is not a valid date")
  } else if (limit !== undefined && isNaN(limit)=== true) {
    res.send("Limit is not a valid number");
  } else if (limit !== undefined && Number(limit) < 1) {
    res.send("Limit must be greater than 0");
  } else {
    // find user for username
    User.findOne({username}, (err, user)=> {
      if (err) {
        res.send("Error searching for username, try again");
      } else if (!user) {
        res.send("Username not found");
      } else {
        userId = user.id;
        query.userId = userId;

        if (from !== undefined) {
          from = new Date(from) ;
          query.date = {$gte: from}
        }

        if (to !== undefined) {
          to = new Date(to);
          to.setDate(to.getDate() + 1) //add 1 day to unclude date
          query.date = {$lt: to}
        }

        if (limit !== undefined) {
          limit = Number(limit);
        }

        Exercise.find(query).select('userId description date duration').limit(limit).exec((errExercise, exercises) => {
          if (err) {
            res.send("Error searching for exercises, try again");

          } else if (!user) {
            res.send("Exercises not found");
          } else {
            res.json(exercises)
          }
        });
      }
    });
  }
});


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
