var debug = require('debug')('sharedconfig'),
    nano = require('nano'),
    EventEmitter2 = require('eventemitter2').EventEmitter2,
    util = require('util'),
    xdiff = require('xdiff'),
    _ = require('lodash'),
    privateMembers = ['_', 'filter'];
    
/**
## triggerUpdates
This is a helper function that will trigger updates for each of the leaf nodes within value.  If value is
already a leaf node, then the update event will be triggered, otherwise the child elements of value
will be traversed and updates triggered appropriately.
*/
function triggerUpdates(config, ns, value) {
    // if the value is an object ({}) then traverse down through children
    if (typeof value == 'object' && (! Array.isArray(value)) && (! (value instanceof String))) {
        _.each(value, function(child, key) {
            triggerUpdates(config, ns + '.' + key, child);
        });
    }
    // otherwise, emit the update
    else {
        debug('update.' + ns, value);
        config.emit('update.' + ns, value);
    }
}
    
function SharedConfig(targetdb) {
    var config = this;
    
    // call the eventemitter2 constructor
    EventEmitter2.call(this, { wildcard: true });
    
    // initialise the rePrivate regex based on the contents of the 
    // eventemitter members
    this._privateRegex = new RegExp('^(' + privateMembers.concat(Object.keys(this)).join('|') + ')');
    
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
            if (info.rows.length === 0) {
                console.log('error connecting to the db');
                console.log(err, info);
            }
            
            config._environments = info.rows.map(function(doc) {
                return doc.id;
            });
        }
        
        debug('finished querying db, triggering appropriate event');
        config.emit(err ? 'error' : 'connect', err);
    });
}

SharedConfig.prototype = new EventEmitter2({ wildcard: true });

SharedConfig.prototype.applyConfig = function(data) {
    var config = this,
        newKeys = Object.keys(data).filter(function(key) {
            return ! config._privateRegex.test(key);
        }),
        newConfig = {},
        changes;
    
    // delete any keys from this object that are owned by the object
    // and don't start with an underscore
    Object.keys(config).forEach(function(key) {
        if (config.hasOwnProperty(key) && (! config._privateRegex.test(key))) {
            delete config[key];
        }
    });
    
    // iterate through the keys in the data and apply to the this
    newKeys.forEach(function(key) {
        // add the key to the item if it isn't an owned item already
        if (! config.hasOwnProperty(key)) {
            config[key] = newConfig[key] = config._clone(data[key]);
        }
    });
    
    // get the change delta
    changes = xdiff.diff(this._data, newConfig) || [];
    
    // detect the changes between the existing config and the new config
    // and report the changes
    changes.forEach(function(changeData) {
        if (changeData[0] === 'set') {
            triggerUpdates(config, changeData[1].slice(1).join('.'), changeData[2]);
        }
    });
    
    // trigger a global change event
    config.emit('changed', newConfig, config._current, changes);

    // return the new config
    return this._data = newConfig;
};

/**
## filter

The filter function is used to apply changes to the configuration values
as they are passed from shared config to the functions that make use of the data.  By
default the filter does nothing, but a filter function can be allocated simply:

    var config = sharedconfig('url');
    
    // set the filter to uppercase all values
    config.filter = function(input) {
        return input.toUpperCase();
    };

To unset the filter simply delete the reference on the base object:

    delete config.filter;
    
*/
SharedConfig.prototype.filter = function(input) {
    return input;
}

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
        
        // trigger the callback
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

SharedConfig.prototype._clone = function(input) {
    var config = this,
        clone = {};
    
    // if we have an object and not a String instance, then clone
    if (typeof input == 'object' && (! (input instanceof String))) {
        Object.keys(input).forEach(function(key) {
            if (input.hasOwnProperty(key)) {
                clone[key] = config._clone(input[key]);
            }
        });
    }
    // otherwise run the simple input value through the filter
    else {
        // opth
        clone = this.filter(input);
    }
    
    return clone;
};

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