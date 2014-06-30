var url = require('url');
var path = require('path');
var botproof = require('./botproof');
var signupMiddleware = require('./middleware');
var models = require('./models');
var signuptokens = require('./signuptokens');

var Common = require(global.__commonModule);
var conf = Common.conf;
var app = Common.app;
var ldap = Common.ldap;
var log = Common.logger.add('signup');
var mid = Common.mid;
var validate = Common.validate;
var verification = Common.verification;
var nav = Common.userNav;

/*
USER-NAV
========
*/
nav.add({
  "name": "Sign Up",
  "url": "/signup",
  "viewName": "signup",
  "visibleLoggedOut": true,
  "visibleLoggedIn": false,
  "icon": "icon-asterisk",
  "order": 20
});

/*
ROUTES
======
*/
// get signup from /signup or from / and handle accordingly
app.get(/^\/signup\/?$|^\/$/i, validate.receive(), botproof.generators,
  function(req, res, next) {
    if (req.session.user) return next(); // pass onward if a user is signed in

    // parse querystrings for pre-populated data
    var values = res.local('validation').values || {},
      renderLayout = true;
    var query = url.parse(req.url, true).query

    for (var prop in query) {
      if (/^(firstname|lastname|username|email|)$/.test(prop))
        values[prop] = query[prop];
    }

    // If a bypass token is given, verify that it's valid before using it.
    var token = req.param('token');
    var used;

    if (token) {

      models.SignupToken.find({where: {token: token}})
      .then(function(token) {
        used = token ? token.used : null

      }, function(err) {
        return next(err);
      })
      .then(renderSignup);

    } else {
      renderSignup();
    }


    function renderSignup() {

      // handle layout query string & determine which view to render
      renderLayout = (query.layout == 'false') ? false : true;
      var viewPath = (renderLayout) ? __dirname + '/../views/signup' : __dirname + '/../views/signup-standalone';

      // render the page
      res.render(viewPath, {
        values: values,
        layout: renderLayout,
        renderLayout: renderLayout, // allows view to see whether or not it has layout
        bodyAppend: '<script type="text/javascript" src="https://www.google.com/recaptcha/api/challenge?k=' + conf.validation.recaptchaPublic + '"></script>',
        bypassToken: (token && !used) ? token : null
      });

    }

  });
app.get('/signup', mid.forceLogout); // prevent from getting 404'd if a logged-in user hits /signup

app.post('/signup', mid.forceLogout, signuptokens.parseSubmittedToken, botproof.parsers,
  signupMiddleware.includeEmpties, validate(), function(req, res, next) {

    log.debug('signup post middleware completed');

    var id = req.body.username,
      first = req.body.firstname,
      last = req.body.lastname,
      email = req.body.email,
      pass = req.body.password,
      captcha = req.body.recaptcha_response_field;

    if (!id || !first || !last || !email || !pass || !captcha) {
      res.send('Unauthorized POST error', {
        'Content-Type': 'text/plain'
      }, 403);
      res.end();
    }

    id = id.toLowerCase();

    // will be called after account is created and validation process started
    var finishCalls = 0,
      errored = false;
    var finish = function(err) {
      if (err && errored === false) { // handle error
        errored = true;
        return next(err);
      } else {
        finishCalls++;
        if (finishCalls == 2) { // display welcome & verify notification
          req.flash('success', "<p>Thanks and welcome to the OpenMRS Community!</p>" + "<p>Before you can use your OpenMRS ID across our services, we need to verify your email address.</p>" + "<p>We've sent an email to <strong>" + email + "</strong> with instructions to complete the signup process.</p>");
          res.redirect('/signup/verify', 303);
        }
      }
    }

    // add the user to ldap
    ldap.addUser(id, first, last, email, pass, function(e, userobj) {
      if (e) finish(e);
      log.info('created account "' + id + '"');

      // lock out the account until it has been verified
      ldap.lockoutUser(id, function(err) {
        if (err) finish(err);
        finish();
      });
    });

    // validate email before completing signup
    verification.begin({
      urlBase: 'signup',
      email: email,
      subject: '[OpenMRS] Welcome to the OpenMRS Community',
      template: path.join(__dirname, '../views/welcome-verify-email.ejs'),
      // template: path.relative(global.__apppath, __dirname+'/../views/welcome-verify-email.ejs'),
      locals: {
        displayName: first + ' ' + last,
        username: id,
        userCredentials: {
          id: id,
          email: email
        }
      },
      timeout: 0
    }, function(err) {
      if (err) finish(err);

      finish();
    });
  });

app.get('/signup/verify', function(req, res, next) {
  res.render('signedup');
});

// verification
app.get('/signup/:id', function(req, res, next) {
  verification.check(req.params.id, function(err, valid, locals) {
    if (err) return next(err);
    if (valid) {
      var user = locals.userCredentials;

      // enable the account, allowing logins
      ldap.enableUser(user.id, function(err, userobj) {
        if (err) return next(err);
        log.debug(user.id + ': account enabled');
        verification.clear(req.params.id);
        req.flash('success', 'Your account was successfully created. Welcome!');

        req.session.user = userobj;
        res.redirect('/');

      });
    } else {
      req.flash('error', 'The requested signup verification does not exist.');
      res.redirect('/');
    }
  });
});

// AJAX, check whether or not user exists
app.get('/checkuser/*', function(req, res, next) {
  if (req.isXMLHttpRequest) {
    ldap.getUser(req.params[0], function(e, data) {
      if (e) {
        if (e.message == 'User data not found') res.end(JSON.stringify({
          exists: false
        }));
        else if (e.message == 'Illegal username specified') res.end(JSON.stringify({
          illegal: true
        }));
      } else if (data) res.end(JSON.stringify({
        exists: true
      }));
      else next(e);
    });
  } else res.redirect('/signup');
});


// Resource handler
app.get('/signup/resource/*', function(req, res, next) {

  // resolve the path
  var file = path.join(__dirname, '/../resource/', req.params[0]);

  // transmit the file
  res.sendfile(file, function(err) {
    if (err) return next(err);
  });
});
