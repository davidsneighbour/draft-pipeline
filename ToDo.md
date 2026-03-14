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
