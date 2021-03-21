require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const _ = require('lodash');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(cookieParser());
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(flash());

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
};

////uncomment to use local db
// mongoose.connect("mongodb://localhost:27017/bilgebaykusDB", options);
mongoose.connect("mongodb+srv://admin-enes:" + process.env.PASSWORD + "@cluster0.drsol.mongodb.net/bilgebaykusDB", options);
mongoose.set("useCreateIndex", true);
mongoose.set('useFindAndModify', false);

const courseSchema = new mongoose.Schema({
  title: String,
  code: String,
  fullName: String
});
const Course = mongoose.model("course", courseSchema);

const ratingSchema = {
  lecturingValue: Number,
  studentRelValue: Number,
  difficultyValue: Number,
  gradingValue: Number,
  review: {
    title: String,
    text: String
  },
  attendance: Boolean
}


const instructorSchema = new mongoose.Schema({
  name: String,
  courses: [courseSchema],
  ratings: [ratingSchema],
  overallAvg: Number,
  lecturingAvg: Number,
  studentRelAvg: Number,
  difficultyAvg: Number,
  gradingAvg: Number
});
const Instructor = mongoose.model("instructor", instructorSchema);

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// Instructor.findOneAndUpdate({name: "enes arda"}, {
//   overallAvg: 50,
//   lecturingAvg: 50,
//   studentRelAvg: 50,
//   difficultyAvg: 50,
//   gradingAvg: 50,
//   ratings: []
// }, function(err){
//   if(err) {
//     console.log(err);
//   }
// });


app.get("/", function(req, res) {

  res.render("home");

});

app.get("/index", function(req, res) {
  const page = Number(req.query.page);
  const searchedName = _.lowerCase(req.query.search)

  if (searchedName) {
    const regex = new RegExp(escapeRegex(searchedName), 'gi');
    const regex2 = new RegExp(escapeRegex(req.query.search), 'gi');

    Instructor.countDocuments({name: regex}, function(err, instructorCount) {
      Course.countDocuments({fullName: regex2}, function(err2, courseCount) {

        const initialPage = Math.floor(instructorCount/15)+1;

        Instructor.find({name: regex}).sort({name:1}).skip(15*(page-1)).limit(15).exec(function(err, foundInstructors) {
          if (err) {
            console.log(err);
          } else {
            const initialAmount = 15-foundInstructors.length;
            if(foundInstructors.length===15) {
              res.render("index", {
                items: [foundInstructors],
                page: page,
                numberOfPages: Math.ceil((instructorCount+courseCount)/15),
                search: req.query.search
              });
            } else {

              if(page===initialPage) {

                Course.find({fullName: regex2}).sort({fullName: 1}).skip(0).limit(initialAmount).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount+courseCount)/15),
                      search: req.query.search
                    });
                  }
                });

              } else {

                Course.find({fullName: regex2}).sort({fullName: 1}).skip(initialAmount + 15*(page-initialPage-1)).limit(15).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount+courseCount)/15),
                      search: req.query.search
                    });
                  }
                });

              }


            }
          }
        });


      });
    });
  } else {

    Instructor.countDocuments({}, function(err, instructorCount) {
      Course.countDocuments({}, function(err2, courseCount) {

        const initialPage = Math.ceil(instructorCount/15);

        Instructor.find({}).sort({name:1}).skip(15*(page-1)).limit(15).exec(function(err, foundInstructors) {
          if (err) {
            console.log(err);
          } else {
            const initialAmount = 15-foundInstructors.length;
            if(foundInstructors.length===15) {
              res.render("index", {
                items: [foundInstructors],
                page: page,
                numberOfPages: Math.ceil((instructorCount+courseCount)/15),
                search: req.query.search
              });
            } else {

              if(page===initialPage) {

                Course.find({}).sort({fullName: 1}).skip(0).limit(initialAmount).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount+courseCount)/15),
                      search: req.query.search
                    });
                  }
                });

              } else {

                Course.find({}).sort({fullName: 1}).skip(initialAmount + 15*(page-initialPage-1)).limit(15).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount+courseCount)/15),
                      search: req.query.search
                    });
                  }
                });

              }

            }
          }
        });


      });
    });


  }
});

app.get("/instructors/:instructorName", function(req, res) {

  Instructor.findOne({
    name: req.params.instructorName
  }, function(err, foundInstructor) {
    if (err) {
      console.log(err);
    } else {
      if (foundInstructor) {
        res.render("instructor", {
          instructor: foundInstructor,
          success: req.flash('success'),
          fail: req.flash('error')
        });
      } else {
        res.send("no such instructor");
      }
    }
  });
});

app.get("/courses/:courseName", function(req, res) {

  Course.findOne({
    fullName: req.params.courseName
  }, function(err, foundCourse) {
    if (err) {
      console.log(err);
    } else {
      Instructor.find({
        courses: {
          $elemMatch: {
            title: foundCourse.title,
            code: foundCourse.code
          }
        }
      }).sort({overallAvg: -1 }).exec(function(err, foundInstructors) {
        res.render("course", {
          instructors: foundInstructors,
          course: req.params.courseName
        });
      });
    }
  });

});

app.get("/rate", function(req, res) {
  console.log(req.query);

  Instructor.findOne({
    name: req.query.instructor
  }, function(err, foundInstructor) {
    if (err) {
      console.log(err);
    } else {
      if (foundInstructor) {
        res.render("rate", {
          instructor: foundInstructor
        });
      } else {
        res.send("no such instructor");
      }
    }
  });

});

app.post("/rate", function(req, res) {
  const newRating = {
    lecturingValue: Number(req.body.lecturingValue),
    studentRelValue: Number(req.body.studentRelValue),
    difficultyValue: Number(req.body.difficultyValue),
    gradingValue: Number(req.body.gradingValue),
    review: {
      title: req.body.reviewTitle,
      text: req.body.reviewText
    },
    attendance: (req.body.attendance === '1')
  }

  Instructor.findOne({
    name: req.body.instructor
  }, function(err, foundInstructor) {
    if (err) {
      console.log(err);
    } else {
      const lecturingAvg = (foundInstructor.lecturingAvg * (foundInstructor.ratings.length + 1) + newRating.lecturingValue) / (foundInstructor.ratings.length + 2);
      const studentRelAvg = (foundInstructor.studentRelAvg * (foundInstructor.ratings.length + 1) + newRating.studentRelValue) / (foundInstructor.ratings.length + 2);
      const difficultyAvg = (foundInstructor.difficultyAvg * (foundInstructor.ratings.length + 1) + newRating.difficultyValue) / (foundInstructor.ratings.length + 2);
      const gradingAvg = (foundInstructor.gradingAvg * (foundInstructor.ratings.length + 1) + newRating.gradingValue) / (foundInstructor.ratings.length + 2);
      const overallAvg = (lecturingAvg + studentRelAvg + gradingAvg) / 3

      foundInstructor.lecturingAvg = parseInt(lecturingAvg);
      foundInstructor.studentRelAvg = parseInt(studentRelAvg);
      foundInstructor.difficultyAvg = parseInt(difficultyAvg);
      foundInstructor.gradingAvg = parseInt(gradingAvg);
      foundInstructor.overallAvg = parseInt(overallAvg);
      foundInstructor.ratings.push(newRating);
      foundInstructor.save(function(err) {
        if (err) {
          console.log(err);
          req.flash('error', 'değerlendirmeniz eklenirken sorun oluştu');
          res.redirect("/instructors/" + foundInstructor.name);
        } else {
          req.flash('success', 'değerlendirmeniz başarılı bir şekilde eklendi');
          res.redirect("/instructors/" + foundInstructor.name);
        }
      });
    }
  });






});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("listening on port 3000");
});
