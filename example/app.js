var DataSource = require('loopback-datasource-juggler').DataSource;
var path = require('path');

var db = new DataSource(require('../'), {
    path: path.join(__dirname, 'tingodb'),
    // inMemoryOnly: true,
    debug: true
});

User = db.createModel('User1', {
    name: { type: String, index: true },
    email: { type: String, index: true },
    age: Number,
    notes: {type: [String]}
});

User.create({name: 'Ray', email: 'x@y.com', notes: ['A']}, function(err, result) {
    console.log(err, result);
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
