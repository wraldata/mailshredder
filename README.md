# mailshredder

This program is designed to help you break apart large tranches of email documents, filter them, and upload to Document Cloud.

It can process the following types of tranches:

- single PDF
- single PDF Portfolio
- multiple PDFs
- multiple EML files

It can perform OCR on image-based PDF tranches, but be advised that it is very slow (about 7 seconds per page
on a 2017 MacBook Pro).  And with very large tranches, its possible that the OCR process will hang.  For this
reason, it is advised that you run any PDFs that need OCR through a preprocessor to do that OCR (for example, Adobe
Acrobat).

Once the tranche has been parsed, the results are presented in a paginated table.  You can sort and filter the list
of emails, selecting and deselecting individual messages.  When you are satisifed with the set of selected messages,
hit the "Next" button, and they will be uploaded to Document Cloud (as PDFs ).

Note the "select all" checkbox at the top of the table only selects/deselects the messages in the current page
of messages.  However, the buttons at the bottom "select all", "select none", "invert selection", "remove selected"
operate on the entire tranche.

## Caveats

When mailshredder parses PDF-based tranches, it uses heuristics to identify individual emails within the tranche.
It uses start-of-page plus "header-like" lines of text to determine the boundaries of email messages.  
This is not always reliable.

### limited sample size

We have built mailshredder using a small set of about 10 tranches provided by various governmental agencies.
Most seem to be exported from Exchange or Outlook.  If another application is used that uses a
different format in its output, mailshredder will likely not work.  Please submit the tranche (or a reasonable
portion of it) so it can be analyzed and support can be added for it.

### mixed PDFs

Sometimes PDFs contain a mix of searcheable text-based pages and non-searchable image-based pages.  If 
you open a large PDF and scan through the first few pages to determine whether the whole thing is searchable,
you might not encounter any of the image-based pages, and you would draw the wrong conclusion about
the file.

Best practice would be to run any PDF tranche through Acrobat's OCR before using mailshredder.  The 
OCR in mailshredder is extremely slow.  Also, you might think that a given PDF is searchable, but then random pages
within it might be image-based and have no searchable text.  Mailshredder will end up tacking those pages onto the
end of the previous email.

### header formatting challenges

Parsing headers can fail if the headers are presented in a table format and the headers are not aligned to the
top; For example:

|           |                                                                                                 |
|-----------|-------------------------------------------------------------------------------------------------|
|  Subject: |  RE: Site Inspection for Scotts Ridge Elementary School -The WootenCompany(Architect) - Federal<br>Tax Program for Energy Efficient Buildings |

Since "Subject:" does not line up vertically with the text to the right, the parsing can't associate
the label "Subject:" with the actual subject text, and it will fail to identify this header.  This in turn
will cause the parser to fail to identify the start of the email message, since Subject is considered a
"critical" header.

### meeting invites

Meeting invites sometimes appear in the tranches; they are formatted similarly to email messages, but 
they use different headers.  They will not be identified as individual messages; depending on whether you
are dealing with a single PDF tranche or a multi-PDF tranche, the meeting invite may end up appended to
the previous email message in the tranche.

### false positives

Headers can appear within a message, like when a user replies to another user's message.  
If, due to normal text flow and page breaks, those headers appear at the
top of a page, that page will be misidentified as the start of an email message.

MonolithicPdfReader and MultiplePdfReader will misidentify an embedded email as a separate email if the page breaks are just right
and the embedded message's headers start at the top of a page.  In theory, this could be improved for multi-PDF
tranches if you knew that there was exactly one email in each PDF.  The MultiplePdfReader could be
modified to expect exactly one email in each PDF, and thus, it could stop parsing for headers once it
finds the start of a message, eliminating the false positives.

I am unsure, however, whether all multi-PDF tranches adhere to this policy.  Rather than hard-coding it into
MultiplePdfReader, it might have to be a user-selectable option.

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
