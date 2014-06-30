var Common = require(global.__commonModule);
var admin = Common.module.admin;
var app = Common.app;
var mid = Common.mid;
var db = Common.db;
var models = require('./models');
var uuid = require('uuid');
var conf = Common.conf;

admin.addModulePage('Signup Tokens', '/admin/signuptokens');

// Restrict all routes in this namespace.
app.use('/admin/signuptokens', mid.restrictTo('dashboard-administrators'));

app.get('/admin/signuptokens', function(req, res) {
  models.SignupToken.findAll()
  .then(function(signupTokens) {

    if (req.param('token')) {
      res.local('created', req.param('token'));
    }

    res.render(__dirname + '/../views/signuptokens-admin', {
      tokens: signupTokens,
      siteURL: conf.site.url
    });

  })
});

app.post('/admin/signuptokens/create', function(req, res, next) {

  // Create a new SignupToken instance
  models.SignupToken.create({token: uuid.v1()})
  .then(function(token) {

    res.redirect('/admin/signuptokens?token=' + token.values.token, 301);

  }, function(err) {
    next(err);
  });

});

app.get('/admin/signuptokens/delete', function(req, res, next) {

  var tokenId = req.param('token');
  console.log(tokenId);

  models.SignupToken.find(tokenId)
  .then(function(token) {
    console.log('destroying ', token);
    return token.destroy();
  })
  .then(function() {

    res.redirect('/admin/signuptokens', 301);

  }, function(err) {
    next(err);
  })

});