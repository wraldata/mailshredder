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
        subtitle="Choose a file and log into Document Cloud"
      >
          <step-setup
            ref="stepSetup"
            @validation-result="onStepSetupValidationResult"
          />
      </q-step>

      <q-step
        name="step-filter"
        title="Filter"
        subtitle="Filter your results"
      >
          <step-filter
            ref="stepFilter"
          />
      </q-step>

      <q-step
        name="step-upload"
        title="Upload"
        subtitle="Send to DocumentCloud"
      >
          <step-upload
            ref="stepUpload"
          />
      </q-step>

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

    </q-stepper>
  </q-page>
</template>

<script>

var commandExistsSync = require('command-exists').sync

import StepSetup from '../components/StepSetup.vue'
import StepFilter from '../components/StepFilter.vue'
import StepUpload from '../components/StepUpload.vue'

export default {
  name: 'PageIndex',
  components: {
    StepSetup,
    StepFilter,
    StepUpload
  },
  mounted () {
    function checkPrereq (executable, name) {
      if (commandExistsSync(executable)) {
        return true
      }
      return false
    }

    if (checkPrereq('convert', 'ImageMagick') &&
        checkPrereq('pdftk', 'PDFtk') &&
        checkPrereq('pdftotext', 'pdftotext (poppler)') &&
        checkPrereq('tesseract', 'tesseract')
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
