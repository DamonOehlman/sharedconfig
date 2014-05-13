## Getting Started

To get started with `sharedconfig` you simply need to create a new sharedconfig instance:

```js
var config = sharedconfig('http://damonoehlman.iriscouch.com/sharedconfig-test');
```

Once you have a config instance, you can then use a particular environment configuration.  The `use` command operates asynchronously and fires a callback once the complete merged config has been loaded for the target environment.

```js
config.use('dev', function(err, data) {
    console.log(data.a);
});
```

Merged config?  What does that mean?  Well, the merged config is the result of merging the data contained within the `default` document and the data contained within the requested environment.  To get a feel for how this works in practice, why not have a look at the contents of the two documents that are merged within the test db:

default (http://damonoehlman.iriscouch.com/sharedconfig-test/default):

```json
{
    "a": 5,
    "b": 5,
    "redis": {
        "host": "localhost",
        "port": 6379
    }
}
```

dev (http://damonoehlman.iriscouch.com/sharedconfig-test/dev):

```json
{
    "a": 10
}
```

Which produces the merged results (via the [lodash merge](http://lodash.com/docs#merge) function) of:

```json
{
    "a": 10,
    "b": 5,
    "redis": {
        "host": "localhost",
        "port": 6379
    }
}
```

After the `use` operation has completed, the configuration data will be made available directly on the created shared config object.  In our case, this is a variable called `config`:

```js
console.log(config.redis.host);
// => localhost
```

Now while all of this is useful in it's own right, it pales in comparison with what you can do when you combine the magic of the CouchDB `_changes` feed into the mix.

Once you are using a config environment / area that area will be monitored for changes, and this will generate events on the config object.  Additionally, there are two types of config change events that are fired:

- targeted updates using the `update.setting.name` event, e.g. `update.riak.host`; and
- a blanket `changed` event that is triggered after the individual update events have been fired.  It's important to note that *at the moment* the `changed` event will fire after a configuration is loaded regardless of whether anything changed in the config or not.  I'm open to discussion about this.

## Example Change Notifications

Handling config loads on environment selection / change:

```js
config.use('dev').on('changed', function(settings) {
    // handle updates
});
```

Listening for targeted changes on a specific configuration property.  These events are triggered when a configuration change is detected for a specific property.  This can happen when either a different environment is selected using the `use` method, OR; a configuration update has been made to the CouchDB backend and it is picked up in the `_changes` feed:

```js
config.on('update.redis.host', function(newHost) {
    console.log('The host has changed to: ' + newHost);
});
```

Additionally, because [EventEmitter2](https://github.com/hij1nx/EventEmitter2) has been used for the events system, you can also listen for wildcard events:

```js
config.on('update.redis.*', function() {
    // no point looking at the value
    // and might be worth throttling the handler to deal with the event being fired twice
    // if both the port and the host changed
    console.log('Redis config has changed: ', config.redis);
});
```
