# Papera for Obsidian

Papera for Obsidian puts your Papera projects into your vault as folders of Markdown notes.
You edit the notes in Obsidian, and the plugin sends your edits back to Papera.

The plugin is in early development. Today it loads, holds its settings, and makes its requests
through one HTTP client.

## Development

Install the dependencies:

```
npm install
```

Build the plugin once, with every check:

```
npm run build
```

The build writes `main.js` beside `manifest.json`. Obsidian loads those two files.

Watch the source and rebuild on every change:

```
npm run dev
```

The other scripts are `npm run typecheck`, `npm run lint` and `npm test`.

### Build into a test vault

`npm run dev` copies `main.js` and `manifest.json` into a vault when you name the vault in the
environment variable `PAPERA_DEV_VAULT`:

```
PAPERA_DEV_VAULT=/path/to/test-vault npm run dev
```

Warning: the build overwrites the folder `.obsidian/plugins/papera` in that vault on every
change. Point `PAPERA_DEV_VAULT` at a test vault, never at a vault that holds your own notes.

The build fails when `PAPERA_DEV_VAULT` names a folder that does not exist. When the variable
is unset, the build writes `main.js` and `manifest.json` in this repository only.

## Manual checks

Two acceptance criteria need a person. Run both checks before a release.

### The plugin unloads without leaving a listener behind

1. Build the plugin into a test vault with `PAPERA_DEV_VAULT`.
2. Open the vault, and turn the plugin on in Settings, Community plugins.
3. Confirm that `data.json` appears in `.obsidian/plugins/papera`.
4. Turn the plugin off, then on again, ten times. The vault stays responsive, and the developer
   console reports no error.

`app.emulateMobile(true)` in the developer console switches the user interface to the phone
layout. It does not prove that the bundle is free of Node, so it does not replace the check
below.

### The plugin loads on Obsidian mobile

1. Build the plugin with `npm run build`.
2. Copy `main.js` and `manifest.json` into `.obsidian/plugins/papera` in a vault on the phone.
   Obsidian Sync, iCloud, or a cable all work.
3. Open the vault on the phone, and turn the plugin on.
4. The plugin appears in the installed plugins list, and Obsidian reports no load error.

## License

MIT. See `LICENSE`.
