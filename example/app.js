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

User.create({name: 'Ray', notes: ['A']}, function(err, result) {
   User.find({where: {id: result.id}}, console.log);
});