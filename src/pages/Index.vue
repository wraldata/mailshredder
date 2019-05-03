<template>
  <q-page class="flex flex-center">
    <div v-if="!showStepper">
      <p><strong>Missing prerequisite(s)</strong><br /></p>
      <p>One or more prerequisites is missing.  Please make sure you have all prerequisites installed and available on your system path.</p>
      <ul>
        <li><a href="https://imagemagick.org/">ImageMagick</a></li>
        <li><a href="https://www.pdflabs.com/tools/pdftk-server">PDFtk</a></li>
        <li><a href="https://poppler.freedesktop.org/">poppler</a></li>
        <li><a href="https://github.com/tesseract-ocr/tesseract/wiki">tesseract</a></li>
      </ul>
    </div>

    <q-stepper ref="stepper" v-model="currentStep" @step="onStep" class="fullscreen" v-if="showStepper">

      <!-- Step: -->
      <q-step
        name="step-setup"
        title="Setup"
        caption="Choose a file and log into Document Cloud"
      >
          <step-setup
            ref="stepSetup"
            @validation-result="onStepSetupValidationResult"
          />
      </q-step>

      <q-step
        name="step-filter"
        title="Filter"
        caption="Filter your results"
      >
          <step-filter
            ref="stepFilter"
          />
      </q-step>

      <q-step
        name="step-upload"
        title="Upload"
        caption="Send to DocumentCloud"
      >
          <step-upload
            ref="stepUpload"
          />
      </q-step>

      <template slot="navigation" slot-scope="{}">
        <q-page-sticky position="bottom-right" :offset="[10, 10]">
        <q-stepper-navigation>
          <q-btn
            v-if="currentStep !== 'step-setup'"
            color="primary"
            flat
            @click="$refs.stepper.previous()"
        >
            Back
          </q-btn>

          <q-btn
            color="primary"
            @click="onNextClick"
            v-if="currentStep !== 'step-upload'"
          >
            {{ currentStep === 'step-done' ? 'Finalize' : 'Next' }}
          </q-btn>
        </q-stepper-navigation>
        </q-page-sticky>
      </template>

    </q-stepper>
  </q-page>
</template>

<script>

var path = require('path')
var fs = require('fs')

import StepSetup from '../components/StepSetup.vue'
import StepFilter from '../components/StepFilter.vue'
import StepUpload from '../components/StepUpload.vue'

const { dialog } = require('electron').remote

export default {
  name: 'PageIndex',
  components: {
    StepSetup,
    StepFilter,
    StepUpload
  },
  mounted () {
    function ucFirst (string) {
      return string.charAt(0).toUpperCase() + string.slice(1)
    }

    let store = this.$store

    // FIXME -- this is a total hack:
    //    - it has a hard-coded list of directories
    //    - it won't work on windows
    //    - it doesn't even check to see if a file is executable
    //
    // I tried using the command-exists npm module, but when the app is compiled and
    // run from the finder, the PATH is apparently not set, so commnd-exists can't find
    // any of the executables (and I suspect we wouldn't be able to run the commands, either)
    function checkPrereq (executable, key, name) {
      let dirs = [
        '/bin',
        '/usr/bin',
        '/usr/local/bin',
        '/opt/local/bin'
      ]
      for (let i = 0; i < dirs.length; i++) {
        let dir = dirs[i]
        let fullPath = path.join(dir, executable)
        if (fs.existsSync(fullPath)) {
          key = 'commands/update' + ucFirst(key)
          store.commit(key, fullPath)
          console.log(`found ${executable}: ${fullPath}`)
          return true
        }
      }
      console.log(`could not find ${executable}`)
      dialog.showMessageBox({
        type: 'error',
        title: 'Error',
        message: `Could not find ${executable}`
      })
      return false
    }

    if (checkPrereq('convert', 'convert', 'ImageMagick') &&
        checkPrereq('pdftk', 'pdftk', 'PDFtk') &&
        checkPrereq('pdftotext', 'pdftotext', 'pdftotext (poppler)') &&
        checkPrereq('tesseract', 'tesseract', 'tesseract')
    ) {
      this.showStepper = true
      return
    }

    // if we are missing prereqs, we'll display an error message with some hyperlinks to the various prereq project pages;
    // use this function to get those links to open in the user's browser, not in the electron window
    function configureOpenRenderedLinksInDefaultBrowser () {
      const aAll = document.querySelectorAll('a')
      if (aAll && aAll.length) {
        aAll.forEach(function (a) {
          a.addEventListener('click', function (event) {
            if (event.target) {
              event.preventDefault()
              let link = event.target.href
              require('electron').shell.openExternal(link)
            }
          })
        })
      }
    }
    configureOpenRenderedLinksInDefaultBrowser()
  },
  data: () => ({
    currentStep: 'step-setup',
    showStepper: false
  }),
  computed: {
  },
  methods: {
    onStepSetupValidationResult: function (evt) {
      console.log('[onStepSetupValidationResult] evt: ', evt)
      if (!evt.result) {
        this.$q.notify(evt.errMessage)
        return
      }
      this.$refs.stepper.next()
    },

    onNextClick: function (evt) {
      if (this.currentStep === 'step-setup') {
        this.$refs.stepSetup.validate()
        return
      }
      console.log(evt)
      this.$refs.stepper.next()
    },

    onStep: function (evt) {
      this.currentStep = evt
    }
  }
}
</script>
