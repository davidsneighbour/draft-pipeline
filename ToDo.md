## ToDo

### .env setup

- [x] create a way to setup a custom `.pipeline.env` with demo content
- [x] set `.pipeline.env` as default env file and add a CLI parameter to set path to .env file

### Override templates

- [x] add options to override each individual template with local path

### Add print ready PDF output

- [x] add bleeds to PDF output and make it configurable (only when CLI parameter `--printready` is added)

### Deprecate dotenv usage

- [x] require Node version that supports native .env integration
- [x] use native .env integration instead of dotenv

### Add release pipeline via release-it

- [x] add release-it configuration
- [x] add `npm run release` script using release-it config
- [x] add npm package release
- [x] add github release
- [x] add conventional commits changelog generation via release-it plugin
- [x] add `npm run release:pre` to create pre-release packages

### Fix/Add config order

- [ ] make sure that all configuration can be done via .env file AND config file AND CLI parameters (overrides in that order)
- [ ] make debuggable from where we receive the configuration (env, config, cli)
- [ ] make config debuggable (output list or json)

### Documentation

- [ ] add section explaining how to configure (env vs. config vs. cli)
- [ ] add section explaining all parameters (CLI, add env and config names as note to each parameter)

### Sensible configuration defaults

- [ ] add and document sensible configuration defaults for all options

### Isolate reMarkable integration

- [x] explain in docs that reMarkable has a system of UUID and meta data files, that this is created on the fly and then uploaded via SSH to the reMarkable
- [x] add links to official docs or explanations how to setup for SSH access (cable required, host name configuration via /etc/hosts or IP address required)
- [x] isolate the remarkable upload into it's on little plugin/system and enable/disable via config option
- [x] requires explicit enable/disable via config option

### Add SSH integration

- [x] enable upload via ssh to any location (add config parameters)
- [x] explore if this should/could be done via rsync so we have more target options for this
- [x] add in parallel to the remarkable setup
- [x] requires explicit enable/disable via config option
