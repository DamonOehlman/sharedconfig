var debug = require('debug')('sharedconfig'),
    nano = require('nano'),
    events = require('events'),
    util = require('util'),
    _ = require('lodash'),
    rePrivate = /^_/;
    
function SharedConfig(targetdb) {
    var config = this;
    
    // initialise the current environment to null
    this._current = null;
    
    // initialise the environments array to empty
    this._environments = [];
    
    // initialise the nano connection
    this._db = nano(targetdb);
    
    // read the environments from the db
    debug('requesting environments from config endpoint');
    this._db.list(function(err, info) {
        if (! err) {
            config._environments = info.rows.map(function(doc) {
                return doc.id;
            });
        }
        
        config.emit(err ? 'error' : 'connect');
    });
}

util.inherits(SharedConfig, events.EventEmitter);

SharedConfig.prototype.applyConfig = function(data) {
    var config = this,
        newKeys = Object.keys(data).filter(function(key) {
            return ! rePrivate.test(key);
        }),
        newConfig = {};
    
    // delete any keys from this object that are owned by the object
    // and don't start with an underscore
    Object.keys(config).forEach(function(key) {
        if (config.hasOwnProperty(key) && (! rePrivate.test(key))) {
            delete config[key];
        }
    });
    
    // iterate through the keys in the data and apply to the this
    newKeys.forEach(function(key) {
        // add the key to the item if it isn't an owned item already
        if (! config.hasOwnProperty(key)) {
            config[key] = newConfig[key] = _.clone(data[key]);
        }
    });
    
    return newConfig;
};

SharedConfig.prototype.use = function(environment, callback) {
    var config = this,
        db = this._db,
        mergedConfig;
        
    // ensure we have an error handling callback
    callback = callback || function(err) {
        if (err) config.emit('error', err);
    };
        
    // if we are not currently aware of the environment return an error via the callback
    if (this._environments.indexOf(environment) < 0) {
        return callback(new Error('Unable to use the "' + environment + '" environment'));
    }

    db.get('default', function(defaultErr, defaultConfig) {
        db.get(environment, function(err, data) {
            if (err) return callback(err);
            
            // update the target known environment
            config._current = environment;
    
            // merge the default and environment specific configuration    
            mergedConfig = config.applyConfig(_.merge({}, defaultConfig, data));
            
            // emit the loaded event
            config.emit('loaded', environment, mergedConfig);
            
            // apply the config and trigger the callback
            callback(err, mergedConfig);
        });
    });
    
    return this;
};
    
module.exports = function(targetdb) {
    return new SharedConfig(targetdb);
};