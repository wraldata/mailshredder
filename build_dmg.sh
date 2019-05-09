#!/bin/sh
#
# to use: npm i electron-installer-dmg -
#
electron-installer-dmg \
  --overwrite \
  dist/electron/mailshredder-darwin-x64/mailshredder.app \
  mailshredder
