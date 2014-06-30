var models = require('./models');
var Common = require(global.__commonModule);
var log = Common.logger.add('signuptokens');

module.exports = {

  // Look up a bypass token incoming in the request. If one exists, populate the
  // request local "bypassToken" with the token's instance.
  parseSubmittedToken: function parseSubmittedToken(req, res, next) {
    var token = req.body.token;

    res.local('bypassToken', null);

    if (!token) {
      log.debug('no token found');
      return next();
    }

    return models.SignupToken.find({where: {token: token}})
    .then(function(token) {

      if (!token.used) res.local('bypassToken', token);
      log.info('signup bypass token with id =', token.id, 'submitted');

      token.used = true;
      return token.save();

    }, function(err) {

      log.error(err);
      next(err);

    })

    .finally(function() {
      next();
    });
  }
}