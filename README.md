# mailshredder

This program is designed to help you break apart large tranches of email documents, filter them, and upload to Document Cloud.

Note that it uses heuristics to identify individual emails within the tranche.  It uses start-of-page plus "header-like" lines
of text to determine the boundaries of email messages.  This is not always reliable.  Headers can appear within a message,
like when a user replies to another user's message.  If, due to normal text flow and page breaks, those headers appear at the
top of a page, that page will be misidentified as the start of an email message.

When a tranche consists of multiple files in a folder or multiple files bundled within a PDF Portfolio, the system will
assume one email message per file, making for more reliable email segmentation.  If the tranche provider gives you a choice
of a monolithic PDF or multiple PDFs, take the multiple PDF option.

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
