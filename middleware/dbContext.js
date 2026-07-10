const { runWithDBContext } = require('../db');

const dbContext = (req, res, next) => {
  return runWithDBContext({ req }, () => next());
};

module.exports = dbContext;
