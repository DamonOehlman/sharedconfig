var debug = require('debug')('sharedconfig'),
    nano = require('nano'),
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    util = require('util'),
    xdiff = require('xdiff'),
    _ = require('lodash'),
    rePrivate = /^_/;
    
function SharedConfig(targetdb) {
    var config = this;
    
    // initialise the data
    this._data = {};
    
    // initialise the current environment to null
    this._current = null;
    
    // initialise the environments array to empty
    this._environments = null;
    
    // initialise the nano connection
    this._db = nano(targetdb);
    
    // initialise the feed
    this._feed = null;
    
    // read the environments from the db
    debug('requesting environments from config endpoint');
    this._db.list(function(err, info) {
        if (! err) {
            debug('retrieve list of config docs from db: ', info.rows);
            config._environments = info.rows.map(function(doc) {
                return doc.id;
            });
        }
        
        config.emit(err ? 'error' : 'connect');
    });
}

util.inherits(SharedConfig, EventEmitter2);

SharedConfig.prototype.applyConfig = function(data) {
    var config = this,
        newKeys = Object.keys(data).filter(function(key) {
            return ! rePrivate.test(key);
        }),
        newConfig = {},
        changes;
    
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
    
    // get the change delta
    changes = xdiff.diff(this._data, newConfig) || [];
    
    // detect the changes between the existing config and the new config
    // and report the changes
    changes.forEach(function(changeData) {
        if (changeData[0] === 'set') {
            config.emit('update.' + changeData[1].slice(1).join('.'), changeData[2]);
        }
    });
    
    // trigger a global change event
    config.emit('changed', newConfig, config._current, changes);

    // return the new config
    return this._data = newConfig;
};

SharedConfig.prototype.use = function(environment, callback) {
    var config = this,
        db = this._db,
        targetDocs = ['default', environment];
    
    // if we don't yet have environments defined, we aren't connected, so wait
    if (! this._environments) {
        return this.once('connect', this.use.bind(this, environment, callback));
    }
        
    // ensure we have an error handling callback
    callback = callback || function(err) {
        if (err) config.emit('error', err);
    };
        
    // if we are not currently aware of the environment return an error via the callback
    if (this._environments.indexOf(environment) < 0) {
        return callback(new Error('Unable to use the "' + environment + '" environment'));
    }

    // release the existing configuration
    this.release();
    
    this._loadEach(targetDocs, function(err, mergedConfig) {
        if (err) return callback(err);
        
        // update the target known environment
        config._current = environment;
        
        // apply the config
        mergedConfig = config.applyConfig(mergedConfig);
        
        // initialise the follow feed
        config._feed = db.follow({ since: 'now' });
        config._feed.on('change', function(change) {
            // if the change is related to the current environment or the default doc
            // then apply the config change
            if (targetDocs.indexOf(change.id) >= 0) {
                config._loadEach(targetDocs, function(err, mergedConfig) {
                    // console.log('merged config: ', mergedConfig);
                    
                    if (! err) {
                        config.applyConfig(mergedConfig);
                    }
                });
            }
        });
        
        // follow
        config._feed.follow();
        
        // apply the config and trigger the callback
        callback(err, mergedConfig);
    });
    
    return this;
};

SharedConfig.prototype.release = function() {
    // if we have an exiting feed, then stop the feed and dereference
    if (this._feed) {
        this._feed.stop();
        this._feed = null;
    }
};

/* "private" methods */

SharedConfig.prototype._loadEach = function(targets, callback, baseConfig) {
    var config = this,
        nextTarget;
        
    // ensure targets is a copy
    targets = [].concat(targets);
    
    // get the next target
    nextTarget = targets.shift();
    
    // ensure we have a config
    baseConfig = baseConfig || {};
    
    // if we don't have a nextTarget, fire the callback
    if (! nextTarget) return callback(null, baseConfig);

    // get the data for the next config
    this._db.get(nextTarget, function(err, data) {
        // if we loaded, successfully, merge the config
        if (! err) {
            // console.log(config, data);
            baseConfig = _.merge(baseConfig, data);
        }
        
        // recurse and load the next target
        config._loadEach(targets, callback, baseConfig);
    });
}

module.exports = function(targetdb) {
    return new SharedConfig(targetdb);
};