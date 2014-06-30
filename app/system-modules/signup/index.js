var Common = require(global.__commonModule);

var signup = module.exports = require('./lib/signup');
var admin = require('./lib/admin');

Common.module.signup = {
  signup: signup,
  admin: admin
}