#!/bin/sh

cd src/statics/icons
convert -geometry 152x152 icon-1024x1024.png apple-icon-152x152.png
convert -geometry 16x16 icon-1024x1024.png favicon-16x16.png
convert -geometry 32x32 icon-1024x1024.png favicon-32x32.png
convert -geometry 128x128 icon-1024x1024.png icon-128x128.png
convert -geometry 192x192 icon-1024x1024.png icon-192x192.png
convert -geometry 256x256 icon-1024x1024.png icon-256x256.png
convert -geometry 384x384 icon-1024x1024.png icon-384x384.png
convert -geometry 512x512 icon-1024x1024.png icon-512x512.png
convert -geometry 144x144 icon-1024x1024.png ms-icon-144x144.png
convert -geometry 128x128 icon-1024x1024.png ../quasar-logo.png

mkdir /tmp/Icon.iconset
cp icon-1024x1024.png /tmp/icon.iconset/icon_1024x1024.png
convert -geometry 512x512 icon-1024x1024.png /tmp/icon.iconset/icon_512x512.png
convert -geometry 512x512 icon-1024x1024.png /tmp/icon.iconset/icon_256x256@2x.png
convert -geometry 256x256 icon-1024x1024.png /tmp/icon.iconset/icon_256x256.png
convert -geometry 256x256 icon-1024x1024.png /tmp/icon.iconset/icon_128x128@2x.png
convert -geometry 128x128 icon-1024x1024.png /tmp/icon.iconset/icon_128x128.png
convert -geometry 128x128 icon-1024x1024.png /tmp/icon.iconset/icon_64x64@2x.png
convert -geometry 64x64 icon-1024x1024.png /tmp/icon.iconset/icon_64x64.png
convert -geometry 64x64 icon-1024x1024.png /tmp/icon.iconset/icon_32x32@2x.png
convert -geometry 32x32 icon-1024x1024.png /tmp/icon.iconset/icon_32x32.png
convert -geometry 32x32 icon-1024x1024.png /tmp/icon.iconset/icon_16x16@2x.png
convert -geometry 16x16 icon-1024x1024.png /tmp/icon.iconset/icon_16x16.png
iconutil -c icns /tmp/icon.iconset
#rm -rf /tmp/icon.iconset

cd ../../..
cp /tmp/icon.icns src-electron/icons
