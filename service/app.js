var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var db = require('./db/db')
var appRouter = require('./routes/app/index');
var qiniuRouter = require('./routes/qiniu');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//---------------------配置token start---------------------------//
var expressJWT = require('express-jwt');
var contant = require("./utis/contant")
app.use(expressJWT({
  secret: contant.JWT_SECRET,
  getToken: function (req) {
    if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    } 
    return null;
  }
}).unless({
  path: [
    "/app/user/login",
    "/app/user/register",
    "/apidoc/index.html",
    // "/qiniu/getToken",
    "/app/user/sendEmailCode",
    "/app/user/resetPassword",
  ]
}))
var {filterEmoji} = require('./utis/emoji')
//过滤emoji表情
app.use(function(req,res,next){
  if(req.query){
    Object.keys(req.query).forEach(key => {
      req.query[key] = filterEmoji(req.query[key])
    })
  }
  if(req.body){
    Object.keys(req.body).forEach(key => {
      req.body[key] = filterEmoji(req.body[key])
    })
  }
  next();
})
app.use(function (err, req, res, next) {
  if (err.name == "UnauthorizedError") {
    res.status(401).send('invalid token...');
  } else {
    next()
  }
})
//---------------------配置token end---------------------------//

app.use('/app', appRouter);
app.use('/qiniu', qiniuRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
