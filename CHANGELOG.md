## Changelog ##

### 0.5.0###
* Always generate uniqueID if one isn't sent

### 0.4.3 ###
* Fixed handling render errors in RenderAndEmail

### 0.4.2 ###
* Removed timeout waiting for `Postmaster.Enqueue`

### 0.4.1 ###
* Added `replyTo` support

### 0.4.0 ###
* Allow custom server to define `server.getRPCClient`
* Update versions

### 0.3.1 ###
* Fixed handling of skyapi endpoint if just ip:port

### 0.3.0 ###
* Provide a way to pass server middleware
* Updated dependencies

### 0.2.1 ###
* Raise timeout
* Added new --priority flag to set SRV priority

### 0.2.0 ###
* Added recursive parent args to make grandparent overriding easier
* Changed out directory to current directory

### 0.1.3 ###
* Allow subject fallback by template
* Fixed bug where `toName` and `toEmail` were not being set correctly in
templates

### 0.1.2 ###
* Change default logging to console
* Provide more helpful startup errors

### 0.1.1 ###
* Added new optional `uniqueID` and `dupThreshold` params to `RenderAndEmail`

### 0.1.0 ###
* Stable release

### 0.0.1 ###
* Initial Release
