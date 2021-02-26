# ChocoPy WASM Compiler

## Installation

This project assumes npm 6.x and node 14.x.

To install a specific version of node, we recommend using [`nvm`](https://github.com/nvm-sh/nvm).

### Installing nvm on macOS

Install nvm using homebrew with `brew install nvm`. Make sure to follow the instructions about
adding the correct statements to your `.bash_profile`/`.zshrc` file (or whatever terminal you use).

After installing nvm, you can install node 14.x by running `nvm install 14` and then activate it
for this project with `nvm use 14`.

If you just want to use a specific version of npm, run `npm install -g npm@6`

Note: If you run `npm --version` and it prints out version 6.x, then you're good. However, npm v7
(bundled with node 15 by default) introduces changes to the package-lock.json generation which is
why we're requiring npm v6. Unfortunately, the npm lacks a clean way to select a specific major
version at runtime.

## Development

To start in a local dev server, run `npm start`. This will also live reload
any file changes you make.
