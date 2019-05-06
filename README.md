# mailshredder

This program is designed to help you break apart large tranches of email documents, filter them, and upload to Document Cloud.

Note that it uses heuristics to identify individual emails within the tranche.  It uses start-of-page plus "header-like" lines
of text to determine the boundaries of email messages.  This is not always reliable.  Headers can appear within a message,
like when a user replies to another user's message.  If, due to normal text flow and page breaks, those headers appear at the
top of a page, that page will be misidentified as the start of an email message.

When a tranche consists of multiple files in a folder or multiple files bundled within a PDF Portfolio, the system will
assume one email message per file, making for more reliable email segmentation.  If the tranche provider gives you a choice
of a monolithic PDF or multiple PDFs, take the multiple PDF option.

I think that best practice would be to run any PDF tranche through Acrobat's OCR before using mailshredder.  The 
OCR in mailshredder is extremely slow.  Also, you might think that a given PDF is searchable, but then random pages
within it might be image-based and have no searchable text.  Mailshredder will end up tacking those pages onto the
end of the previous email.

## ideas for improvements

When parsing PDFs for email headers, use the indentation of the header components to identify continuations.
Example:

```
From:     James G Ptaszynski
Sent:     Monday, July 09, 2018 11:18 AM
To:       Harry Smith (Harry Smith Harry Smith; Hannah Gage; Margaret Spellings; 
          Thomas C. Shanahan; Andrew P. Kelly; Kimberly van Noort
Subject:  elearning market estimated at $150B expected to grow >5% annually 2017 - 2024
```

In isolation, there's nothing in the "Thomas C. Shanahan" line that would suggest this is a header.  If it had
identifiable email address components, we might assume that it is a continuation of the "To:" header, since
we know the "To:" header contains email addresses.  But the PDF export doesn't contain the email addresses
of those individuals.  The indentiation could be a clue that it belongs with the text above.

And I think there are even stronger cues in the PDF -- when I copy and paste those headers into a plain
text document from Mac Preview, all the recipients are pasted as a single line.  So the PDF seems to contain
some information that indicates that that text is all one element. But I'm not sure how to get that 
information using the tools we have at our disposal, like pdftotext.

The bottom line is that if we could reliably handle multi-line headers, we could eliminate some errors caused
by incomplete header parsing, and we could remove some of the "fuzziness" from the Pdf readers, which allow
for some non-headers interleaved in the headers for just this reason.


Running in dev mode:

```
 quasar dev -m electron
```

Building an electron app:

```
 quasar build -m electron
```

Running tests:

```
 quasar test --unit=jest
```

NOTE: the tests are running code in the electron app's main process; since most of the code we're using
runs in the renderer process, there are references to electron.remote that don't work in the tests;
for example, the PDFUtils.htmlToPdf() doesn't work in the tests yet.  So we can't test any EML tranches.

## requirements

You must install the following before using mailshredder:

* tesseract: https://github.com/tesseract-ocr/tesseract/wiki

* pdftk: https://www.pdflabs.com/tools/pdftk-server/

* ImageMagick: https://imagemagick.org/

* poppler (for the pdftotext utility): https://poppler.freedesktop.org/
