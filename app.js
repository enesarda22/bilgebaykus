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

  const transporter = nodemailer.createTransport({
    service: "FastMail",
    auth: {
      user: process.env.FASTMAIL_USERNAME,
      pass: process.env.FASTMAIL_PASSWORD
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
  reviewedInstructors: [String],
  reportedBy: [String],
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
  author: String,
  text: String,
  userID: String,
  date: String,
  course: String
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


// User.find({},function(err, foundUsers) {
//
//   foundUsers.forEach(function(user) {
//
//     user.reportedBy = [];
//     user.save();
//
//   });
//
// });

// Instructor.findOneAndUpdate({name: "enes arda"}, {
//   overallAvg: 50,
//   lecturingAvg: 50,
//   studentRelAvg: 50,
//   difficultyAvg: 50,
//   gradingAvg: 50,
//   numberOfYes: 0,
//   reviews: []
// }, function(err){
//   if(err) {
//     console.log(err);
//   }
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
            res.render("error");
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
                    res.render("error");
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
                    res.render("error");
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
            res.render("error");
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
                    res.render("error");
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
                    res.render("error");
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
      res.render("error");
    } else {
      if (foundInstructor) {
        let initialReview;
        let hasAlreadyReviewed = false;

        if (req.user != null && req.user.reviewedInstructors.includes(foundInstructor.name)) {

          hasAlreadyReviewed = true;
          foundInstructor.reviews.forEach(function(review) {

            if (review.userID == req.user._id) {
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
      res.render("error");
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
        res.render("error");
      } else {
        if (foundInstructor && !req.user.reviewedInstructors.includes(req.query.instructor)) {
          if (!req.user.reviewedInstructors.includes(foundInstructor.name)) {
            res.render("rate", {
              instructor: foundInstructor
            });
          } else {
            res.redirect("/");
          }

        } else {
          req.flash('error', 'bir sorun oluştu');
          res.redirect("/");
        }
      }
    });

  } else {
    res.redirect("/login")
  }



});



app.post("/rate", function(req, res) {

  if (req.isAuthenticated() && !req.user.reviewedInstructors.includes(req.body.instructor)) {

    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    let yyyy = today.getFullYear();
    today = dd + '/' + mm + '/' + yyyy;

    let author = "";
    if (req.body.author == '1') {
      author = "anonim";
    } else {
      author = _.lowerCase(req.user.username);
    }

    const newReview = {
      author: author,
      text: req.body.reviewText,
      userID: req.user._id,
      date: today,
      course: req.body.course
    }

    Instructor.findOne({
      name: req.body.instructor
    }, function(err, foundInstructor) {
      if (err) {
        res.render("error");
      } else {
        const lecturingAvg = (foundInstructor.lecturingAvg * (foundInstructor.reviews.length + 1) + Number(req.body.lecturingValue) * 10) / (foundInstructor.reviews.length + 2);
        const studentRelAvg = (foundInstructor.studentRelAvg * (foundInstructor.reviews.length + 1) + Number(req.body.studentRelValue) * 10) / (foundInstructor.reviews.length + 2);
        const difficultyAvg = (foundInstructor.difficultyAvg * (foundInstructor.reviews.length + 1) + Number(req.body.difficultyValue) * 10) / (foundInstructor.reviews.length + 2);
        const gradingAvg = (foundInstructor.gradingAvg * (foundInstructor.reviews.length + 1) + Number(req.body.gradingValue) * 10) / (foundInstructor.reviews.length + 2);
        const overallAvg = (lecturingAvg + studentRelAvg + gradingAvg) / 3

        foundInstructor.lecturingAvg = parseInt(lecturingAvg);
        foundInstructor.studentRelAvg = parseInt(studentRelAvg);
        foundInstructor.difficultyAvg = parseInt(difficultyAvg);
        foundInstructor.gradingAvg = parseInt(gradingAvg);
        foundInstructor.overallAvg = parseInt(overallAvg);
        if (req.body.attendance == '1') {
          foundInstructor.numberOfYes++;
        }
        foundInstructor.reviews.push(newReview);
        req.user.reviewedInstructors.push(foundInstructor.name);
        req.user.save(function(err) {
          if (!err) {
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

  } else {
    res.redirect("/instructors/" + req.body.instructor);
  }
});

app.post("/update", function(req, res) {
  if (req.user._id == req.body.userID) {

    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0');
    let yyyy = today.getFullYear();
    today = dd + '/' + mm + '/' + yyyy;

    let author = "";
    if (req.body.author == '1') {
      author = "anonim";
    } else {
      author = _.lowerCase(req.user.username);
    }
    const newReview = {
      author: author,
      text: req.body.reviewText,
      userID: req.user._id,
      date: today,
      course: req.body.course
    }

    Instructor.findOne({
      name: req.body.instructor
    }, function(err, foundInstructor) {
      if (!err) {

        foundInstructor.reviews.forEach(function(review) {
          if (review.userID == req.user._id) {
            foundInstructor.reviews = foundInstructor.reviews.filter(item => item !== review);
          }
        });
        foundInstructor.reviews.push(newReview);
        foundInstructor.save(function(err) {
          if (!err) {
            res.redirect("/instructors/" + req.body.instructor);
          }
        });

      }
    });


  } else {
    res.redirect("/instructors/" + req.body.instructor);
  }
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
            from: process.env.FASTMAIL_USERNAME
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

app.post("/reset", function(req, res) {

  User.findOne({
    username: req.body.username
  }, function(err, foundUser) {

    if (!err && foundUser) {

      jwt.sign({
        data: foundUser._id
      }, process.env.EMAIL_SECRET, {
        expiresIn: '1d'
      }, function(err, emailToken) {
        sendEmail({
          subject: "Bilge Baykuş Şifre Yenileme",
          text: "Şifrenizi yenilemek için tıklayın: https://bilgebaykus.herokuapp.com/reset/" + emailToken + " Link bir gün sonra geçerliliğini yitirecektir.",
          to: req.body.username + "@boun.edu.tr",
          from: process.env.FASTMAIL_USERNAME
        });
        req.flash('success', req.body.username + '@boun.edu.tr adresine şifre yenileme maili gönderildi');
        res.redirect("/login");
      });

    } else {
      req.flash('error', 'böyle bir kullanıcı yok.');
      res.redirect("/register");
    }

  });
});
app.get("/reset/:token", function(req, res) {

  const token = req.params.token;

  jwt.verify(token, process.env.EMAIL_SECRET, function(err, decoded) {

    if (err) {
      req.flash('error', 'bir sorun gerçekleşti');
      res.redirect("/login");
    } else {
      id = decoded.data;

      User.findById(id, function(err, foundUser) {

        if (!err && foundUser) {
          res.render("reset", {
            user: foundUser,
            token: token,
            success: req.flash('success'),
            fail: req.flash('error')
          });
        } else {
          req.flash('error', 'üyelik bulunamadı');
          res.redirect("/register");
        }

      });
    }
  });
});
app.post("/reset/:token", function(req, res) {

  if (req.body.password == req.body.secondPassword) {

    const token = req.params.token;

    jwt.verify(token, process.env.EMAIL_SECRET, function(err, decoded) {

      if (err) {
        req.flash('error', 'bir sorun gerçekleşti');
        res.redirect("/login");
      } else {
        id = decoded.data;

        User.findById(id, function(err, foundUser) {

          if (!err && foundUser) {
            foundUser.setPassword(req.body.password, function() {
              foundUser.save(function(err) {
                if (!err) {
                  req.flash('success', 'şifreniz başarılı bir şekilde yenilendi')
                  res.redirect("/login");
                }
              });
            });
          } else {
            req.flash('error', 'üyelik bulunamadı');
            res.redirect("/register");
          }

        });
      }
    });

  } else {
    req.flash('error', 'şifreler aynı değil');
    res.redirect("/reset/" + token);
  }
});

app.post("/activation", function(req, res) {

  User.findOne({
    username: req.body.username
  }, function(err, foundUser) {

    if (!err && foundUser) {

      if (foundUser.isConfirmed == false) {
        jwt.sign({
          data: foundUser._id
        }, process.env.EMAIL_SECRET, {
          expiresIn: '1d'
        }, function(err, emailToken) {
          sendEmail({
            subject: "Bilge Baykuş Aktivasyon",
            text: "Hesabınızı aktifleştirmek için lütfen linke tıklayın: https://bilgebaykus.herokuapp.com/confirmation/" + emailToken + " Link bir gün sonra geçerliliğini yitirecektir.",
            to: req.body.username + "@boun.edu.tr",
            from: process.env.FASTMAIL_USERNAME
          });
          req.flash('success', req.body.username + '@boun.edu.tr adresine şifre yenileme maili gönderildi');
          res.redirect("/login");
        });
      } else {
        req.flash('success', 'üyeliğiniz zaten onaylanmış');
        res.redirect("/login");
      }



    } else {
      req.flash('error', 'böyle bir kullanıcı yok.');
      res.redirect("/register");
    }

  });

});

app.get("/report", function(req, res) {

  if (req.query.reporteduser == null || req.query.instructor == null) {
    res.render("error");
  } else {

    if (req.isAuthenticated()) {

      User.findById(req.query.reporteduser, function(err, foundUser) {
        Instructor.findById(req.query.instructor, function(err, foundInstructor) {

          if (!err) {

            if (foundUser.reportedBy.length != 0 && foundUser.reportedBy.includes(req.user._id)) {
              req.flash('error', 'bu kullanıcıyı zaten raporladınız');
              res.redirect("/instructors/" + foundInstructor.name);
            } else {
              foundInstructor.reviews.forEach(function(review) {

                if (review.userID == req.query.reporteduser) {
                  res.render("report", {
                    instructor: foundInstructor,
                    review: review
                  })
                }

              });
            }

          } else {
            req.flash('error', 'bir hata gerçekleşti');
            res.redirect("/instructors/" + foundInstructor.name);
          }
        });


      });



    } else {
      res.redirect("/login");
    }
  }
});

app.post("/report", function(req, res) {

  if (req.isAuthenticated()) {

    User.findById(req.body.reportedUser, function(err, foundUser) {
      if (foundUser.reportedBy.includes(req.user._id)) {
        req.flash('success', 'bu kullanıcıyı zaten raporladınız');
        res.redirect("/instructors/" + req.body.instructor);
      } else {
        foundUser.reportedBy.push(req.user._id);
        foundUser.save(function(err) {
          if (!err) {
            sendEmail({
              subject: "Yeni Rapor",
              text: req.user._id + " tarafindan " + req.body.reportedUser + " " + req.body.instructor + "'a yazdigi yorumdan dolayi rapor edildi. Nedeni: " + req.body.reportText,
              to: "enesarda22@gmail.com",
              from: process.env.FASTMAIL_USERNAME
            });

            req.flash('success', 'raporunuz başarılı bir şekilde gönderildi.');
            res.redirect("/instructors/" + req.body.instructor);
          } else {
            req.flash('error', 'bir hata gerçekleşti');
            res.redirect("/");
          }
        });

      }
    });

  } else {
    res.redirect("/login");
  }

});
app.get('*', function(req, res) {
  res.render('error');
});


let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("listening on port 3000");
});
