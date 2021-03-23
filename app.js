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
const nodemailer = require("nodemailer");
const {
  google
} = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const jwt = require('jsonwebtoken');

const createTransporter = async () => {
  const oauth2Client = new OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    "https://developers.google.com/oauthplayground"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN
  });
  const accessToken = await new Promise((resolve, reject) => {
    oauth2Client.getAccessToken((err, token) => {
      if (err) {
        reject();
      }
      resolve(token);
    });
  });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.EMAIL,
      accessToken,
      clientId: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      refreshToken: process.env.REFRESH_TOKEN
    }
  });

  return transporter;
};

const sendEmail = async (emailOptions) => {
  let emailTransporter = await createTransporter();
  await emailTransporter.sendMail(emailOptions);
};


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

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
};

mongoose.Promise = global.Promise;
////uncomment to use local db
// mongoose.connect("mongodb://localhost:27017/bilgebaykusDB", options);
mongoose.connect("mongodb+srv://admin-enes:" + process.env.PASSWORD + "@cluster0.drsol.mongodb.net/bilgebaykusDB", options);
mongoose.set("useCreateIndex", true);
mongoose.set('useFindAndModify', false);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  reviewedInstructors:[String],
  isConfirmed: {
    type: Boolean,
    default: false
  }
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("user", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

const courseSchema = new mongoose.Schema({
  title: String,
  code: String,
  fullName: String
});
const Course = mongoose.model("course", courseSchema);

const reviewSchema = {
  title: String,
  text: String,
  userID: String
}


const instructorSchema = new mongoose.Schema({
  name: String,
  courses: [courseSchema],
  reviews: [reviewSchema],
  overallAvg: Number,
  lecturingAvg: Number,
  studentRelAvg: Number,
  difficultyAvg: Number,
  gradingAvg: Number,
  numberOfYes: Number
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

// Instructor.find({}, function(err, foundInstructors) {
//   foundInstructors.forEach(function(instructor){
//     instructor.ratings= undefined;
//     instructor.reviews= [];
//     instructor.overallAvg= 50;
//     instructor.lecturingAvg= 50;
//     instructor.studentRelAvg= 50;
//     instructor.difficultyAvg= 50;
//     instructor.gradingAvg= 50;
//     instructor.numberOfYes= 0;
//
//     instructor.save();
//   });
// });

// Instructor.update({name: "enes arda"}, { $set: { ratings: undefined }}, function(err) {
//   if(!err){
//     console.log("done");
//   }
// })

// User.findById("6059d32b6263a065dc8d29f0", function(err, foundUser){
//   Instructor.find({}, function(err, foundInstructors) {
//     foundInstructors.forEach(function(instructor){
//       instructor.ratings.forEach(function(rating){
//         rating.userID=foundUser._id;
//       });
//       instructor.save();
//     });
//   });
// });

// User.findById("6059d32b6263a065dc8d29f0", function(err, foundUser){
//
//   foundUser.reviewedInstructors.push("enes arda");
//   foundUser.save();
//
// });


app.get("/", function(req, res) {

  console.log(req.isAuthenticated());
  console.log(req.user);

  res.render("home", {
    success: req.flash('success'),
    fail: req.flash('error'),
    isAuth: req.isAuthenticated()
  });

});

app.get("/index", function(req, res) {
  const page = Number(req.query.page);
  const searchedName = _.lowerCase(req.query.search)

  if (searchedName) {
    const regex = new RegExp(escapeRegex(searchedName), 'gi');
    const regex2 = new RegExp(escapeRegex(req.query.search), 'gi');

    Instructor.countDocuments({
      name: regex
    }, function(err, instructorCount) {
      Course.countDocuments({
        fullName: regex2
      }, function(err2, courseCount) {

        const initialPage = Math.floor(instructorCount / 15) + 1;
        const initialAmount = 15 - (instructorCount - (initialPage - 1) * 15);

        Instructor.find({
          name: regex
        }).sort({
          name: 1
        }).skip(15 * (page - 1)).limit(15).exec(function(err, foundInstructors) {
          if (err) {
            console.log(err);
          } else {
            if (foundInstructors.length === 15) {
              res.render("index", {
                items: [foundInstructors],
                page: page,
                numberOfPages: Math.ceil((instructorCount + courseCount) / 15),
                search: req.query.search,
                isAuth: req.isAuthenticated()
              });
            } else {

              if (page === initialPage) {

                Course.find({
                  fullName: regex2
                }).sort({
                  fullName: 1
                }).skip(0).limit(initialAmount).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount + courseCount) / 15),
                      search: req.query.search,
                      isAuth: req.isAuthenticated()
                    });
                  }
                });

              } else {

                Course.find({
                  fullName: regex2
                }).sort({
                  fullName: 1
                }).skip(initialAmount + 15 * (page - initialPage - 1)).limit(15).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount + courseCount) / 15),
                      search: req.query.search,
                      isAuth: req.isAuthenticated()
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

        const initialPage = Math.floor(instructorCount / 15) + 1;
        const initialAmount = 15 - (instructorCount - (initialPage - 1) * 15);

        Instructor.find({}).sort({
          name: 1
        }).skip(15 * (page - 1)).limit(15).exec(function(err, foundInstructors) {
          if (err) {
            console.log(err);
          } else {

            if (foundInstructors.length === 15) {
              res.render("index", {
                items: [foundInstructors],
                page: page,
                numberOfPages: Math.ceil((instructorCount + courseCount) / 15),
                search: req.query.search,
                isAuth: req.isAuthenticated()
              });
            } else {

              if (page === initialPage) {

                Course.find({}).sort({
                  fullName: 1
                }).skip(0).limit(initialAmount).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount + courseCount) / 15),
                      search: req.query.search,
                      isAuth: req.isAuthenticated()
                    });
                  }
                });

              } else {

                Course.find({}).sort({
                  fullName: 1
                }).skip(initialAmount + 15 * (page - initialPage - 1)).limit(15).exec(function(err, foundCourses) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.render("index", {
                      items: [foundInstructors, foundCourses],
                      page: page,
                      numberOfPages: Math.ceil((instructorCount + courseCount) / 15),
                      search: req.query.search,
                      isAuth: req.isAuthenticated()
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
        let initialReview;
        let hasAlreadyReviewed = false;

        if(req.user!=null && req.user.reviewedInstructors.includes(foundInstructor.name)){

          hasAlreadyReviewed = true;
          foundInstructor.reviews.forEach(function(review) {

            if(review.userID==req.user._id){
              initialReview = review;
            }

          });
        }
        res.render("instructor", {
          instructor: foundInstructor,
          success: req.flash('success'),
          fail: req.flash('error'),
          isAuth: req.isAuthenticated(),
          initialReview: initialReview,
          hasAlreadyReviewed: hasAlreadyReviewed
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
      }).sort({
        overallAvg: -1
      }).exec(function(err, foundInstructors) {
        res.render("course", {
          instructors: foundInstructors,
          course: req.params.courseName,
          isAuth: req.isAuthenticated()
        });
      });
    }
  });

});

app.get("/rate", function(req, res) {


  if (req.isAuthenticated()) {

    Instructor.findOne({
      name: req.query.instructor
    }, function(err, foundInstructor) {
      if (err) {
        console.log(err);
      } else {
        if (foundInstructor) {
          if(!req.user.reviewedInstructors.includes(foundInstructor.name)){
            res.render("rate", {
              instructor: foundInstructor
            });
          } else {
            res.redirect("/");
          }

        } else {
          res.send("no such instructor");
        }
      }
    });

  } else {
    res.redirect("/login")
  }



});

app.post("/rate", function(req, res) {
  const newReview = {
    title: req.body.reviewTitle,
    text: req.body.reviewText,
    userID: req.user._id
  }

  Instructor.findOne({
    name: req.body.instructor
  }, function(err, foundInstructor) {
    if (err) {
      console.log(err);
    } else {
      const lecturingAvg = (foundInstructor.lecturingAvg * (foundInstructor.reviews.length + 1) + Number(req.body.lecturingValue)) / (foundInstructor.reviews.length + 2);
      const studentRelAvg = (foundInstructor.studentRelAvg * (foundInstructor.reviews.length + 1) + Number(req.body.studentRelValue)) / (foundInstructor.reviews.length + 2);
      const difficultyAvg = (foundInstructor.difficultyAvg * (foundInstructor.reviews.length + 1) + Number(req.body.difficultyValue)) / (foundInstructor.reviews.length + 2);
      const gradingAvg = (foundInstructor.gradingAvg * (foundInstructor.reviews.length + 1) + Number(req.body.gradingValue)) / (foundInstructor.reviews.length + 2);
      const overallAvg = (lecturingAvg + studentRelAvg + gradingAvg) / 3

      foundInstructor.lecturingAvg = parseInt(lecturingAvg);
      foundInstructor.studentRelAvg = parseInt(studentRelAvg);
      foundInstructor.difficultyAvg = parseInt(difficultyAvg);
      foundInstructor.gradingAvg = parseInt(gradingAvg);
      foundInstructor.overallAvg = parseInt(overallAvg);
      if(req.body.attendance=='1') {
        foundInstructor.numberOfYes++;
      }
      foundInstructor.reviews.push(newReview);
      req.user.reviewedInstructors.push(foundInstructor.name);
      req.user.save(function(err) {
        if(!err) {
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
        } else {
          console.log(err);
          req.flash('error', 'değerlendirmeniz eklenirken sorun oluştu');
          res.redirect("/instructors/" + foundInstructor.name);
        }
      });
    }
  });

});

app.get("/login", function(req, res) {
  let queryPage = "/";
  if (req.query.page != null) {
    queryPage = encodeURI(req.query.page);
  }

  if (!req.isAuthenticated()) {
    res.render("login", {
      success: req.flash('success'),
      fail: req.flash('error'),
      page: queryPage
    });
  } else {
    res.redirect("/");
  }

});



app.get("/register", function(req, res) {
  if (!req.isAuthenticated()) {
    res.render("register", {
      success: req.flash('success'),
      fail: req.flash('error')
    });
  } else {
    res.redirect("/");
  }

});


app.post("/register", function(req, res) {
  if (req.body.password === req.body.secondPassword) {
    User.register({
      username: req.body.username
    }, req.body.password, function(err, user) {
      if (err) {
        console.log(err);
        req.flash('error', 'bu mail adresini kullanamazsınız');
        res.redirect("/register");
      } else {

        jwt.sign({
          data: user.id
        }, process.env.EMAIL_SECRET, {
          expiresIn: '1d'
        }, function(err, emailToken) {
          sendEmail({
            subject: "Bilge Baykuş Aktivasyon",
            text: "Hesabınızı aktifleştirmek için lütfen linke tıklayın: https://bilgebaykus.herokuapp.com/confirmation/" + emailToken + " Link bir gün sonra geçerliliğini yitirecektir.",
            to: req.body.username + "@boun.edu.tr",
            from: "enesarda22@gmail.com"
          });
          req.flash('success', req.body.username + '@boun.edu.tr adresine onaylama maili gönderildi');
          res.redirect("/");
        });

      }
    });
  } else {
    req.flash('error', 'paralolar aynı degil');
    res.redirect("/register");
  }
});

app.post("/login", function(req, res, next) {
  const page = req.body.page;

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  User.findOne({
    username: req.body.username
  }, function(err, foundUser) {

    if (!foundUser) {
      req.flash('error', 'hatalı kullanıcı adı ya da şifre');
      res.redirect("/login");
    } else {
      if (!foundUser.isConfirmed) {
        req.flash('error', 'aktivasyon mailini onaylayın');
        res.redirect("/login");
      } else {

        passport.authenticate('local', function(err, user, info) {
          if (err) {
            return next(err);
          }
          if (!user) {
            req.flash('error', 'hatalı kullanıcı adı ya da şifre');
            return res.redirect('/login');
          }
          req.logIn(user, function(err) {
            if (err) {
              return next(err);
            }
            req.flash('success', 'başarılı bir şekilde giriş yaptınız.');
            return res.redirect(page);
          });
        })(req, res, next);

      }
    }

  });

});

app.get("/confirmation/:token", function(req, res) {

  const token = req.params.token;

  jwt.verify(token, process.env.EMAIL_SECRET, function(err, decoded) {

    if (err) {
      req.flash('error', 'üyeliğiniz onaylanamadı.');
      res.redirect("/login");
    } else {
      id = decoded.data;

      User.findByIdAndUpdate(id, {
        isConfirmed: true
      }, function(err) {

        if (!err) {
          req.flash('success', 'üyeliğiniz onaylandı.');
          res.redirect("/login");
        } else {
          req.flash('error', 'bir hata gerçekleşti.');
          res.redirect("/register");
        }

      });
    }

  });
});

app.post("/logout", function(req, res) {
  req.logout();
  res.redirect("/");
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("listening on port 3000");
});
