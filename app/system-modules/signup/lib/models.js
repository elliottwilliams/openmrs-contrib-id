var Common = require(global.__commonModule);
var db = Common.db;

var models = module.exports = {};

models.SignupToken = db.define('SignupToken', {
  token: db.UUID,
  used: db.BOOLEAN
});