# mailshredder

This program is designed to help you break apart large tranches of email documents, filter them, and upload to Document Cloud.

Running in dev mode:

```
 quasar dev -m electron
```

Building an electron app:

```
 quasar build -m electron
```


## requirements

You must install the following before using mailshredder:

* tesseract: https://github.com/tesseract-ocr/tesseract/wiki

* pdftk: https://www.pdflabs.com/tools/pdftk-server/

* ImageMagick: https://imagemagick.org/

* poppler (for the pdftotext utility): https://poppler.freedesktop.org/
