/**
 * Module dependencies
 */
var tingodb = require('tingodb')({ nativeObjectID: true });

/**
 * Initialize the TingoDB connector for the given data source
 * @param {DataSource} dataSource The data source instance
 * @param {Function} [callback] The callback function
 */
exports.initialize = function initialize(dataSource, callback) {
    if (!tingodb) return;

    var s = dataSource.settings;

    dataSource.ObjectID = tingodb.ObjectID;
    dataSource.connector = new TingoDB(s, dataSource, callback);
};


/**
 * The constructor for TingoDB connector
 * @param {Object} settings The settings object
 * @param {DataSource} dataSource The data source instance
 * @param [callback] The callback function
 * @constructor
 */
function TingoDB(s, dataSource, callback) {
    var i, n;
    this.name = 'tingodb';
    this._models = {};
    this.collections = {};


    this.db = new tingodb.Db(s.path, {});
    callback && process.nextTick(callback);
}

/**
 * Convert the id to be a BSON ObjectID if it is compatible
 * @param {*} id The id value
 * @returns {ObjectID}
 */
function ObjectID(id) {
    if (typeof id !== 'string') {
        return id;
    }
    if(id instanceof tingodb.ObjectID) {
        return id;
    }
    try {
        return new tingodb.ObjectID(id);
    } catch(e) {
        // console.error(e);
        return id;
    }
}

/**
 * Get the id property name for the given model
 * @param {String} model The model name
 * @returns {String} The id property name
 *
 * @private
 */
TingoDB.prototype.idName = function(model) {
    return this.dataSource.idName(model);
};

/**
 * Get the id value for the given model
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @returns {*} The id value
 *
 * @private
 */
TingoDB.prototype.getIdValue = function(model, data) {
    return data && data[this.idName(model)];
};

/**
 * Set the id value for the given model
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @param {*} value The id value
 *
 * @private
 */
TingoDB.prototype.setIdValue = function(model, data, value) {
    if(data) {
//        if(value instanceof tingodb.ObjectID) {
//            value = value.toString();
//        }
        data[this.idName(model)] = value;
    }
};

/**
 * Hook for defining new models
 * @param {Object} descr Model description
 */
TingoDB.prototype.define = function (descr) {
    if (!descr.settings) {
        descr.settings = {};
    }
    this._models[descr.model.modelName] = descr;
};

/**
 * Hook for defining a property
 * @param {String} model The model name
 * @param {String} prop The property name
 * @param {Object} params The parameters
 */
TingoDB.prototype.defineProperty = function (model, prop, params) {
    this._models[model].properties[prop] = params;
};

/**
 * Define a foreign key
 * @param {String} model The model name
 * @param {String} key The key name
 * @param {funciton} [cb] The callback function
 */
TingoDB.prototype.defineForeignKey = function (model, key, cb) {
    cb(null, ObjectID);
};

/**
 * Access a TingoDB collection by name
 * @param {String} name The collection name
 * @returns {*}
 */
TingoDB.prototype.collection = function (name) {
    if (!this.collections[name]) {
        this.collections[name] = this.db.collection(name);
    }
    return this.collections[name];
};

/**
 * Create a new model instance for the given data
 * @param {String} model The model name
 * @param {Object} data The model data
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.create = function (model, data, callback) {
    var self = this;
    if(self.debug) {
        console.log('create', model, data);
    }
    var idValue = self.getIdValue(model, data);
    var idName = self.idName(model);

    if (idValue === null) {
        delete data[idName]; // Allow TingoDB to generate the id
    } else {
        data._id = idValue; // Set it to _id
        delete data[idName];
    }
    this.collection(model).insert(data, {}, function (err, m) {
        if(self.debug) {
            console.log('create.callback', model, err, m);
        }
        callback(err, err ? null : m[0]._id);
    });
};

/**
 * Save the model instance for the given data
 * @param {String} model The model name
 * @param {Object} data The model data
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.save = function (model, data, callback) {
    var self = this;
    if(self.debug) {
        console.log('save', model, data);
    }
    var idValue = self.getIdValue(model, data);
    var idName = self.idName(model);

    var oid = ObjectID(idValue);
    delete data[idName];

    this.collection(model).update({_id: oid}, data, function (err, result) {
        if(!err) {
            self.setIdValue(model, data, idValue);
        }
        if(self.debug) {
            console.log('save.callback', model, err, result);
        }
        callback && callback(err, result);
    });
};

/**
 * Check if a model instance exists by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} [callback] The callback function
 *
 */
TingoDB.prototype.exists = function (model, id, callback) {
    var self = this;
    if(self.debug) {
        console.log('exists', model, id);
    }
    id = ObjectID(id);
    this.collection(model).findOne({_id: id}, function (err, data) {
        if(self.debug) {
            console.log('exists.callback', model, id, err, data);
        }
        callback(err, !!(!err && data));
    });
};

/**
 * Find a model instance by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.find = function find(model, id, callback) {
    var self = this;
    if(self.debug) {
        console.log('find', model, id);
    }
    var oid = ObjectID(id);
    this.collection(model).findOne({_id: oid}, function (err, data) {
        self.setIdValue(model, data, oid);
        if(self.debug) {
            console.log('find.callback', model, id, err, data);
        }
        callback && callback(err, data);
    });
};

/**
 * Update if the model instance exists with the same id or create a new instance
 *
 * @param {String} model The model name
 * @param {Object} data The model instance data
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.updateOrCreate = function updateOrCreate(model, data, callback) {
    var self = this;
    if(self.debug) {
        console.log('updateOrCreate', model, data);
    }

    var idValue = self.getIdValue(model, data);
    // var idName = self.idName(model);

    if (idValue === null || idValue === undefined) {
        return this.create(data, callback);
    }
    this.find(model, idValue, function (err, inst) {
        if (err) {
            return callback(err);
        }
        if (inst) {
            self.updateAttributes(model, idValue, data, callback);
        } else {
            // delete data.id;
            self.create(model, data, function (err, id) {
                if (err) {
                    return callback(err);
                }
                if (id) {
                    self.setIdValue(model, data, id);
                    delete data._id;
                    callback(null, data);
                } else{
                    callback(null, null); // wtf?
                }
            });
        }
    });
};

/**
 * Delete a model instance by id
 * @param {String} model The model name
 * @param {*} id The id value
 * @param [callback] The callback function
 */
TingoDB.prototype.destroy = function destroy(model, id, callback) {
    var self = this;
    if(self.debug) {
        console.log('delete', model, id);
    }
    id = ObjectID(id);
    this.collection(model).remove({_id: id}, function(err, result) {
        if(self.debug) {
            console.log('delete.callback', model, id, err, result);
        }
        callback && callback(err, result);
    });
};

/**
 * Decide if id should be included
 * @param {Object} fields
 * @returns {Boolean}
 */
function idIncluded(fields, idName) {
    if(!fields) {
        return true;
    }
    if(Array.isArray(fields)) {
        return fields.indexOf(idName) >= 0;
    }
    if(fields[idName]) {
        // Included
        return true;
    }
    if((idName in fields) && !fields[idName]) {
        // Excluded
        return false;
    }
    for(var f in fields) {
        return !fields[f]; // If the fields has exclusion
    }
    return true;
}

/**
 * Find matching model instances by the filter
 *
 * @param {String} model The model name
 * @param {Object} filter The filter
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.all = function all(model, filter, callback) {
    var self = this;
    if(self.debug) {
        console.log('all', model, filter);
    }
    if (!filter) {
        filter = {};
    }
    var idName = self.idName(model);
    var query = {};
    if (filter.where) {
        if (filter.where[idName]) {
            var id = filter.where[idName];
            delete filter.where[idName];
            id = ObjectID(id);
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
                        if ('string' !== typeof x) return x;
                        return ObjectID(x);
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
    var fields = filter.fields;
    var cursor = null;
    if(fields) {
        cursor = this.collection(model).find(query, fields);
    } else {
        cursor = this.collection(model).find(query);
    }

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
        if(self.debug) {
            console.log('all', model, filter, err, data);
        }
        if (err) {
            return callback(err);
        }
        var objs = data.map(function (o) {
            if(idIncluded(fields, self.idName(model))) {
                self.setIdValue(model, o, o._id);
            }
            return o;
        });
        if (filter && filter.include) {
            self._models[model].model.include(objs, filter.include, callback);
        } else {
            callback(null, objs);
        }
    });
};

/**
 * Delete all instances for the given model
 * @param {String} model The model name
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.destroyAll = function destroyAll(model, callback) {
    var self = this;
    if(self.debug) {
        console.log('destroyAll', model);
    }
    this.collection(model).remove({}, function (err, result) {
        if(self.debug) {
            console.log('destroyAll.callback', model, err, result);
        }
        callback && callback(err, result);
    });
};

/**
 * Count the number of instances for the given model
 *
 * @param {String} model The model name
 * @param {Function} [callback] The callback function
 * @param {Object} filter The filter for where
 *
 */
TingoDB.prototype.count = function count(model, callback, where) {
    var self = this;
    if(self.debug) {
        console.log('count', model, where);
    }
    this.collection(model).count(where, function (err, count) {
        if(self.debug) {
            console.log('count.callback', model, err, count);
        }
        callback && callback(err, count);
    });
};

/**
 * Update properties for the model instance data
 * @param {String} model The model name
 * @param {Object} data The model data
 * @param {Function} [callback] The callback function
 */
TingoDB.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    var debug = this.debug;
    if(debug) {
        console.log('updateAttributes', model, id, data);
    }
    var oid = ObjectID(id);
    delete data[this.idName(model)];

    this.collection(model).findAndModify({_id: oid}, [['_id','asc']], {$set: data}, {}, function(err, object) {
        if(debug) {
            console.log('updateAttributes.callback', model, id, err, object);
        }
        if(!err && !object) {
            // No result
            err = 'No '+ model +' found for id ' + id;
        }
        cb && cb(err, object);
    });
};

/**
 * Disconnect from TingoDB
 */
TingoDB.prototype.disconnect = function () {
    if(this.debug) {
        console.log('disconnect');
    }
    // this.db.close();
};

