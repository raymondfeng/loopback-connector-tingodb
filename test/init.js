module.exports = require('should');

var Schema = require('jugglingdb').Schema;
var path = require('path');

global.getSchema = function() {
    var db = new Schema(require('../'), {
        path: path.join(__dirname, 'tingodb')
    });
    db.log = function (a) { console.log(a); };

    return db;
};
