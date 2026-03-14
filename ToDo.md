## ToDo

### .env setup

- [ ] create a way to setup a custom `.pipeline.env` with demo content
- [ ] set `.pipeline.env` as default env file and add a CLI parameter to set path to .env file

### Override templates

- [ ] add options to override each individual template with local path

### Add print ready PDF output

- [ ] add bleeds to PDF output and make it configurable (only when CLI parameter `--printready` is added)

### Deprecate dotenv usage

- [ ] require Node version that supports native .env integration
- [ ] use native .env integration instead of dotenv

### Add release pipeline via release-it

- [ ] add release-it configuration
- [ ] add `npm run release` script using release-it config
- [ ] add npm package release
- [ ] add github release
- [ ] add conventional commits changelog generation via release-it plugin
- [ ] add `npm run release:pre` to create pre-release packages

### Fix/Add config order

- [ ] make sure that all configuration can be done via .env file AND config file AND CLI parameters (overrides in that order)
- [ ] make debuggable from where we receive the configuration (env, config, cli)
- [ ] make config debuggable (output list or json)

### Documentation

- [ ] add section explaining how to configure (env vs. config vs. cli)
- [ ] add section explaining all parameters (CLI, add env and config names as note to each parameter)
