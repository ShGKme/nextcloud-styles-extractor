#  Nextcloud Server Styles

> Extracted Nextcloud server global styles
- ⚡ Zero dependencies
- 🌲 Different branches: `master`, `stable30`, `stable29`
- ✅ `REUSE.toml` included

## 📥 Install

```sh
npm i @shgk/nextcloud-styles
```

## 🏗️ Prerequisites

Requires a bundler with `.css` import support, such as Webpack with `css-loader` ot Vite. 

## 🧑‍💻 Usage

Import all styles and themes:

```js
// master
import '@shgk/nextcloud-styles'
// or a specific branch
import '@shgk/nextcloud-styles/master'
import '@shgk/nextcloud-styles/stable30'
import '@shgk/nextcloud-styles/stable29'
```

Importing a specific file:

```js
// master
import '@shgk/nextcloud-styles/apps/theming/theme/dark.css'
import '@shgk/nextcloud-styles/core/img/logo/logo.svg'
// or a specific branch
import '@shgk/nextcloud-styles/master/apps/theming/css/default.css'
import '@shgk/nextcloud-styles/stable30/core/css/server.css'
```

## 📦 Details

Styles are close to the original. Changes:
- Added `light.plain.css` and `light.dark.css` to be used as server's
  ```html
  <link rel="stylesheet" media="prefers-color-scheme: light" href="/apps/theming/theme/light.css?plain=1" />
  <link rel="stylesheet" media="prefers-color-scheme: dark" href="/apps/theming/theme/dark.css?plain=1" />
  ``` 
- Absolute paths in `url()` are changed to relative
- Added `REUSE.toml` for license information
- Added `theme.css` for re-export theming styles including plain style on `prefers-color-scheme`
- Added `index.js` for re-export all styles and `themes.css`

Styles structure:

```
└───BRANCH
    ├───apps
    │   └───theming
    │       ├───css
    │       │   └───default.css
    │       ├───img
    │       │   └───...
    │       └───theme
    │           ├───dark.css
    │           ├───dark.plain.css
    │           ├───dark.css
    │           └───light.plain.css
    ├───core
    │   ├───css
    │   │   ├───apps.css
    │   │   └───server.css
    │   └───img
    │       └───...
    ├───dist
    │   └───icons.css
    ├───REUSE.toml
    ├───theme.css = apps/theming/css/default.css + apps/theming/theme/* with prefers-color-scheme
    └───index.js = core/css/server.css + core/css/apps.css + theme.css
```

Based on awesome [`szaimen/nextcloud-simple-test`](https://github.com/szaimen/nextcloud-easy-test/).

## 👾 Development

Update styles:
```sh
node ./build/extract.js <VERSION>
```

## TODO

- [ ] Add high-contrast theme and dyslexia-friendly font
- [ ] Add automatic updates
- [ ] Add custom themes support
- [ ] Add private servers support
- [ ] Improve building performance
- [ ] Remove unneeded images
