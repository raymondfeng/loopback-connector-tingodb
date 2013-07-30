/**
 * Module dependencies
 */
var tingodb = require('tingodb')();
var ObjectID = tingodb.ObjectID;

exports.initialize = function initializeSchema(dataSource, callback) {
    if (!tingodb) return;

    var s = dataSource.settings;

    dataSource.ObjectID = ObjectID;
    dataSource.connector = new TingoDB(s, dataSource, callback);
};

var TingoObjectID = function ObjectID(id) {
    // console.log('To object id: ', id);
    // if (typeof id !== 'string') return id;
    return new tingodb.ObjectID(id);
}

function TingoDB(s, dataSource, callback) {
    var i, n;
    this.name = 'tingodb';
    this._models = {};
    this.collections = {};


    this.db = new tingodb.Db(s.path, {});
    callback && process.nextTick(callback);
}

TingoDB.prototype.define = function (descr) {
    if (!descr.settings) descr.settings = {};
    this._models[descr.model.modelName] = descr;
};

TingoDB.prototype.defineProperty = function (model, prop, params) {
    this._models[model].properties[prop] = params;
};

TingoDB.prototype.defineForeignKey = function (model, key, cb) {
    cb(null, TingoObjectID);
};

TingoDB.prototype.collection = function (name) {
    if (!this.collections[name]) {
        this.collections[name] = this.db.collection(name);
    }
    return this.collections[name];
};

TingoDB.prototype.create = function (model, data, callback) {
    if (data.id === null) {
        delete data.id;
    }
    this.collection(model).insert(data, {}, function (err, m) {
        callback(err, err ? null : m[0]._id);
    });
};

TingoDB.prototype.save = function (model, data, callback) {
    var id = data.id;
    if (!(id instanceof ObjectID)) {
        id = new ObjectID(id);
    }
    this.collection(model).update({_id: id}, data, function (err) {
        callback(err);
    });
};

TingoDB.prototype.exists = function (model, id, callback) {
    if (!(id instanceof ObjectID)) {
        id = new ObjectID(id);
    }
    this.collection(model).findOne({_id: id}, function (err, data) {
        callback(err, !!(!err && data));
    });
};

TingoDB.prototype.find = function find(model, id, callback) {
    if (!(id instanceof ObjectID)) {
        id = new ObjectID(id);
    }
    this.collection(model).findOne({_id: id}, function (err, data) {
        if (data) data.id = id;
        callback(err, data);
    });
};

TingoDB.prototype.updateOrCreate = function updateOrCreate(model, data, callback) {
    var connector = this;
    if (!data.id) return this.create(data, callback);
    this.find(model, data.id, function (err, inst) {
        if (err) return callback(err);
        if (inst) {
            connector.updateAttributes(model, data.id, data, callback);
        } else {
            delete data.id;
            connector.create(model, data, function (err, id) {
                if (err) return callback(err);
                if (id) {
                    data.id = id;
                    delete data._id;
                    callback(null, data);
                } else{
                    callback(null, null); // wtf?
                }
            });
        }
    });
};

TingoDB.prototype.destroy = function destroy(model, id, callback) {
    if (!(id instanceof ObjectID)) {
        id = new ObjectID(id);
    }
    this.collection(model).remove({_id: id}, callback);
};

TingoDB.prototype.all = function all(model, filter, callback) {
    var tingo = this;
    if (!filter) {
        filter = {};
    }
    var query = {};
    if (filter.where) {
        if (filter.where.id) {
            var id = filter.where.id;
            delete filter.where.id;
            if (!(id instanceof ObjectID)) {
                id = new ObjectID(id);
            }
            filter.where._id = id;
        }
        Object.keys(filter.where).forEach(function (k) {
            var cond = filter.where[k];
            var spec = false;
            if (cond && cond.constructor.name === 'Object') {
                spec = Object.keys(cond)[0];
                cond = cond[spec];
            }
            if (spec) {
                if (spec === 'between') {
                    query[k] = { $gte: cond[0], $lte: cond[1]};
                } else if (spec === 'inq') {
                    query[k] = { $in: cond.map(function(x) {
                        if (x instanceof ObjectID) return x;
                        return new ObjectID(x);
                    })};
                } else {
                    query[k] = {};
                    query[k]['$' + spec] = cond;
                }
            } else {
                if (cond === null) {
                    query[k] = {$type: 10};
                } else {
                    query[k] = cond;
                }
            }
        });
    }
    var cursor = this.collection(model).find(query);

    if (filter.order) {
        var keys = filter.order;
        if (typeof keys === 'string') {
            keys = keys.split(',');
        }
        var args = {};
        for (var index in keys) {
            var m = keys[index].match(/\s+(A|DE)SC$/);
            var key = keys[index];
            key = key.replace(/\s+(A|DE)SC$/, '').trim();
            if (m && m[1] === 'DE') {
                args[key] = -1;
            } else {
                args[key] = 1;
            }
        }
        cursor.sort(args);
    }
    if (filter.limit) {
        cursor.limit(filter.limit);
    }
    if (filter.skip) {
        cursor.skip(filter.skip);
    } else if (filter.offset) {
        cursor.skip(filter.offset);
    }
    cursor.toArray(function (err, data) {
        if (err) return callback(err);
        var objs = data.map(function (o) { o.id = o._id; return o; });
        if (filter && filter.include) {
            tingo._models[model].model.include(objs, filter.include, callback);
        } else {
            callback(null, objs);
        }
    });
};

TingoDB.prototype.destroyAll = function destroyAll(model, callback) {
    this.collection(model).remove({}, callback);
};

TingoDB.prototype.count = function count(model, callback, where) {
    this.collection(model).count(where, function (err, count) {
        callback(err, count);
    });
};

TingoDB.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    if (!(id instanceof ObjectID)) {
        id = new ObjectID(id);
    }
    this.collection(model).findAndModify({_id: id}, [['_id','asc']], {$set: data}, {}, function(err, object) {
        cb(err, object);
    });
};

TingoDB.prototype.disconnect = function () {
    this.db.close();
};

