# robthebuilder #

JSON-RPC service compiles and renders templates. It can also forward templates
to an instance of [postmaster](https://github.com/LevenLabs/postmaster) to send
an email.

## Command-line Options ##

* `rpc-port`: the port to listen for rpc calls on. Defaults to a random port
between 8000-9999.
* `skyapi-addr`: address of SkyAPI server to advertise `robthebuilder` to
* `postmaster-addr`: address to reach postmaster instance(s)
* `templates-dir`: directory to load templates from
* `addl-methods-dir`: directory to load additional methods from
* `from-email`: default the `fromEmail` param to this value
* `from-name`: default the `fromName` param to this value
* `logger`: change the default logging class (defaults to debuglog)
* `log-level`: change the log level (defaults to info)

Advertising to SkyAPI is optional. Using postmaster is also optional.

[modulelog](https://www.npmjs.com/package/modulelog) is used for logging. This
allows you to npm install your own logging library and pass the name to
`--logger`.

## Templates ##

Templates are compiled using lodash's [_.template](https://lodash.com/docs#template).
Additional metadata in JSON format can be sent at the top of the template file
in order to require params and nest templates. An example metadata block:
```
<!--
{
    "parent": {
        "name": "generic_base",
        "args": {"showFooter": false},
        "include_var": "body"
    },
    "params": [
        "cardLast4",
        "totalAmount"
    ]
}
-->
```

`parent` defines the parent template to load. The current template is rendered
and then passed to the parent template as the `include_var` variable. You can
also pass additional arguments to the parent.

`params` defines the required params that must be sent to this template in
order to render it. The above example requires `cardLast4` and `totalAmount` to
be sent. Additionally, you'll have access to the `escape` function in order to
escape params that are passed in.

For the above metadata example, the parent might look like:
```
<!--
{
    "params": [
        "body",
        "showFooter"
    ]
}
-->
<!DOCTYPE html><html><body>
<%= body %>
<% if (showFooter) { %>
<p> footer </p>
<% } %>
</body></html>
```

## RPC Methods ##

### Rob.Render ###

Arguments:

* `name`: (string) name of the template to render
* `params`: (object) params to send to the template

Response:

```
{html: "<!DOCTYPE html><html><body>..."}
```

### Rob.RenderAndEmail ###

Arguments:

* `name`: (string) name of the template to render
* `params`: (object) params to send to the template
* `toName`: (optional string) name of the recipient
* `toEmail`: (string) address to send the email to
* `subject`: (string) subject of the email
* `fromEmail`: (string) address to send the email from. To fallback to
`--from-email` just send an empty string.
* `fromName`: (optional string) name of the sender. To fallback to
`--from-name` don't send this property or send an empty string.
* `flags`: (number) flags to pass along to postmaster for categorizing emails

`toName`, `toEmail` can be sent by defining your own pre-processor using
rpclib. You can store `toName` and `toEmail` on the response object using the
`set` method and those will be used if `toEmail` or `toName` are empty. If you
want to only use the pre-processor values, send an empty string for both
values. Additionally, a `user` object can be stored on response and the `name`
property and `email` property will be used for `toName` and `toEmail`,
respectively. The `user` object will also be sent to the template if its not
already defined in `params`. An example pre-processor can be found in
`tests/pre/pre.js`.
