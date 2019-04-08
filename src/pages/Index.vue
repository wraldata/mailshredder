<template>
  <q-page class="flex flex-center">
    <q-stepper ref="stepper" v-model="currentStep" @step="onStep" class="fullscreen">

      <!-- Step: -->
      <q-step
        name="step-setup"
        title="Setup"
        subtitle="Choose a file and log into Document Cloud"
      >

        <q-field
          label="Username"
          :error="$v.setupForm.dcUsername.$error"
          error-label="Document Cloud username is required"
        >
          <q-input
            v-model="setupForm.dcUsername"
          />
        </q-field><br />
        <q-field
          label="Password"
          :error="$v.setupForm.dcPassword.$error"
          error-label="Document Cloud password is required"
        >
          <q-input
            v-model="setupForm.dcPassword"
            type="password"
          />
        </q-field><br />
        <q-field
          label="Document Cloud Project ID"
          :error="$v.setupForm.dcProjectId.$error"
          error-label="Document Cloud project ID is required and must be a positive integer"
        >
          <q-input
            v-model="setupForm.dcProjectId"
          />
        </q-field><br />
        <q-field
          label="Input file"
          :error="$v.setupForm.inputFile.$error"
          error-label="Input file is required"
        >
          <q-input
            v-model="setupForm.inputFile"
          /><br />
        </q-field><br />
        <q-btn
          color="primary"
          @click="browseForFile"
          label="Browse..."
        />
      </q-step>

      <q-step
        name="step-filter"
        title="Filter"
        subtitle="Filter your results"
      >

        <q-table
          dense
          :data="tableData"
          :filter="emailFilter"
          :columns="columns"
          selection="multiple"
          :selected.sync="selected"
          :pagination.sync="paginationControl"
          row-key="emailId"
        >
        <!-- MUST have a slot-scope, or the q-search won't display; if we set it to "props", we get an error at compile time
            about props not being used; set it to "{}" instead  - https://github.com/vuejs/eslint-plugin-vue/issues/781 -->
          <template slot="top-left" slot-scope="{}">
            <q-search
              hide-underline
              color="secondary"
              v-model="emailFilter"
              class="col-6"
            />
          </template>
        </q-table>
      </q-step>

      <q-step
        name="step-upload"
        title="Upload"
        subtitle="Send to DocumentCloud"
      >
        <br /><br /><strong>Upload progress:</strong><br /><br />
        <q-progress
          :percentage="uploadProgress"
          animate
          style="height: 16px"
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

<style>
</style>

<script>
const { dialog } = require('electron').remote
import { required, integer, minValue } from 'vuelidate/lib/validators'

const fs = require('fs')
const pathinfo = require('pathinfo')

// const MonolithicPdfReader = require('../lib/readers/MonolithicPdfReader')
import MonolithicPdfReader from '../lib/readers/MonolithicPdfReader'
import MultiplePdfWriter from '../lib/writers/MultiplePdfWriter'
import DocumentCloudUploader from '../lib//uploaders/DocumentCloudUploader'
// import { open } from 'fs'

// const EmailReportGenerator = require('../lib/utils/EmailReportGenerator')
// const moment = require('moment')

export default {
  name: 'PageIndex',
  data: () => ({
    columns: [
      {
        name: 'subject',
        required: true,
        label: 'Subject',
        align: 'left',
        field: 'subject',
        sortable: true,
        classes: 'my-class',
        style: 'width: 200px'
      },
      {
        name: 'from',
        required: true,
        label: 'From',
        align: 'left',
        field: 'from',
        sortable: true,
        classes: 'my-class',
        style: 'width: 200px'
      },
      {
        name: 'to',
        required: true,
        label: 'To',
        align: 'left',
        field: 'to',
        sortable: true,
        classes: 'my-class',
        style: 'width: 200px'
      },
      {
        name: 'date',
        required: true,
        label: 'Date',
        align: 'left',
        field: 'date',
        sortable: true,
        sort: (a, b) => new Date(a) - new Date(b),
        classes: 'my-class',
        style: 'width: 200px'
      }
    ],
    tableData: [],
    selected: [],
    paginationControl: { rowsPerPage: 25, page: 1 },
    emailFilter: '',
    currentStep: 'step-setup',
    emails: [],
    uploader: null,

    uploadProgress: 0,

    inputFileWritten: '',
    inputFileWrittenAt: null,

    setupForm: {
      inputFile: '',
      dcUsername: '',
      dcPassword: '',
      dcProjectId: ''
    }
  }),
  validations: {
    setupForm: {
      dcUsername: { required },
      dcPassword: { required },
      dcProjectId: { required, integer, minValue: minValue(1) },
      inputFile: { required }
    }
  },
  computed: {
  },
  methods: {
    onNextClick: function (evt) {
      if (this.currentStep === 'step-setup') {
        this.$v.setupForm.$touch()
        if (this.$v.setupForm.$error) {
          this.$q.notify('One or more errors in form fields; please correct before proceeding.')
          return
        }

        this.uploader = new DocumentCloudUploader({
          username: this.setupForm.dcUsername,
          password: this.setupForm.dcPassword,
          projectId: this.setupForm.dcProjectId
        })

        this.uploader.validateProjectId().then(() => {
          this.$refs.stepper.next()
        }, () => {
          this.$q.notify('Could not validate Document Cloud project ID; check username, password, and project ID.')
        })

        return
      }
      console.log(evt)
      this.$refs.stepper.next()
    },

    onStep: function (evt) {
      // [onStep]  66ce00dc-1068-8bda-249d-787d82e903ec
      // what to do with this guid?
      try {
        this.currentStep = evt
        if (evt === 'step-filter') {
          this.processFile()
        }
        if (evt === 'step-upload') {
          this.uploadFiles()
        }
      } catch (err) {
        dialog.showMessageBox({
          type: 'error',
          title: 'Error',
          message: err.message
        })
      }
    },

    uploadFiles: function () {
      console.log(this.selected)

      console.log('[uploadFiles] uploading...')

      let files = []
      for (let i = 0; i < this.selected.length; i++) {
        let id = this.selected[i].emailId - 1
        let e = this.emails[id]
        files.push(e.files.pdf)
      }

      let numUploadSuccess = 0
      this.uploadProgress = 0
      this.uploader.on('upload-success', evt => {
        numUploadSuccess++
        this.uploadProgress = Math.round(numUploadSuccess / files.length * 100.0)
        console.log('[on-upload-success] numUploadSuccess: ' + numUploadSuccess + ', uploadProgress: ' + this.uploadProgress)
      })

      this.uploader.uploadFiles(files).then(() => {
        console.log('[uploadFiles] done uploading.')
      }).catch(function (err) {
        this.$q.notify('Error uploading to Document Cloud: ' + err.message)
      })
    },

    processFile: function () {
      if ((this.inputFileWritten === this.setupForm.inputFile)) {
        console.log('[processFile] input filename unchanged since last processing...')
        let modDate = fs.statSync(this.setupForm.inputFile).mtime
        console.log('[processFile] modDate:', modDate)
        console.log('[processFile] inputFileWrittenAt:', this.inputFileWrittenAt)
        if (this.inputFileWrittenAt > modDate) {
          console.log('[processFile] input file unchanged since last processing; skipping re-processing')
          return
        } else {
          console.log('[processFile] input file changed since last processing; re-processing')
        }
      } else {
        console.log('[processFile] new input file specified since last processing; re-processing')
      }

      this.tableData = []

      var tempnamSync = require('tempnam').tempnamSync
      this.outputDir = tempnamSync('/tmp', 'mailshredder-')
      fs.unlinkSync(this.outputDir)
      fs.mkdirSync(this.outputDir)
      var info = pathinfo(this.setupForm.inputFile)
      this.baseName = info.basename

      // let r = new MonolithicPdfReader({ src: this.setupForm.inputFile })
      // console.log(r)

      let r = new MonolithicPdfReader({
        src: this.setupForm.inputFile
      })

      let w = new MultiplePdfWriter({
        src: this.setupForm.inputFile,
        outDir: this.outputDir,
        baseName: this.baseName
      })

      console.log('[processFile] reading ' + this.setupForm.inputFile)
      this.$q.loading.show()
      r.read().then((emails) => {
        this.emails = emails
        console.log(emails)

        let newdata = []
        let newSelected = []
        for (let i = 0; i < emails.length; i++) {
          let e = emails[i]
          let record = {
            emailId: i + 1,
            from: e.headers.From ? e.headers.From.value : '',
            subject: e.headers.Subject ? e.headers.Subject.value : '',
            to: e.headers.To ? e.headers.To.value : '',
            date: e.headers.Date ? e.headers.Date.value : ''
          }
          newdata.push(record)
          newSelected.push(record)
        }

        console.log(newdata)
        this.tableData = newdata
        this.selected = newSelected

        // let g = new EmailReportGenerator()
        // g.generate(emails, program.outputDir, program.baseName)

        if (w) {
          console.log('[processFile] writing to ' + this.outputDir)
          w.setEmails(emails)
          return w.write()
        }
      }).then((files) => {
        console.log('[processFile] writing complete.')
        this.$q.loading.hide()
        this.inputFileWritten = this.setupForm.inputFile
        this.inputFileWrittenAt = new Date()
      }).catch(function (err) {
        dialog.showMessageBox({
          type: 'error',
          title: 'Error1',
          message: err.message
        })
      })
    },

    browseForFile: function () {
      let options = {
        properties: ['openFile', 'openDirectory'],
        filters: {
          extensions: ['pdf']
        }
      }

      // note that there is a scoping issue with the way calls are made to remote objects,
      // so you have to use an arrow function (or store a reference to 'this')
      console.log(dialog.showOpenDialog(options, (selection) => {
        if (selection && selection.length === 1) {
          console.log('user selected: ' + selection[0])
          this.setupForm.inputFile = '' + selection[0]
        }
      }))
    }

  }
}
</script>
