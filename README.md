# sharedconfig

The `sharedconfig` package is used to provide applications a mechanism for sharing application configuration information across a network of machines.

<a href="http://travis-ci.org/#!/DamonOehlman/sharedconfig"><img src="https://secure.travis-ci.org/DamonOehlman/sharedconfig.png" alt="Build Status"></a>

## Why?

So why would you want to use `sharedconfig` over many of the other excellent node configuration libraries.  Primarily, because this configuration engine is designed to grab configuration information from a single configuration server.  Additionally, the [CouchDB](http://couchdb.apache.org) `_changes` feed is used (via [nano](https://github.com/dscape/nano) and [follow](https://github.com/iriscouch/follow)) to monitor changes in the config.

Combine this with the magic of [xdiff](https://github.com/dominictarr/xdiff) and you have a really powerful little configuration service for your application.  Here, let me show you:

## Getting Started

To get started with `sharedconfig` you simply need to create a new sharedconfig instance:

```js
var config = sharedconfig('http://kondoot.iriscouch.com/test-sharedconfig');
```

Once you have a config instance, you can then use a particular environment configuration.  The `use` command operates asynchronously and fires a callback once the complete merged config has been loaded for the target environment.

```js
config.use('dev', function(err, data) {
    console.log(data.a);
});
```

Merged config?  What does that mean?  Well, the merged config is the result of merging the data contained within the `default` document and the data contained within the requested environment.  To get a feel for how this works in practice, why not have a look at the contents of the two documents within the test db:

<