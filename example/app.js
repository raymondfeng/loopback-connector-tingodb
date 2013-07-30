var Schema = require('jugglingdb').Schema;
var path = require('path');


var db = new Schema(require('../'), {
    path: path.join(__dirname, 'tingodb'),
    // inMemoryOnly: true,
    debug: true
});

User = db.define('User1', {
    name:      { type: String, index: true },
    email:     { type: String, index: true },
    age:          Number,
    notes: {type: []}
});

User.create({name: 'Ray', email: 'x@y.com', notes: ['A']}, function(err, result) {
    User.findById(result.id, console.log);
    User.findOne(function(e, u) {
        User.findOne({where: {
            id: u.id
            // email: 'x@y.com'
        }}, function(err, user) {
            console.log(user);
        });
    });


});