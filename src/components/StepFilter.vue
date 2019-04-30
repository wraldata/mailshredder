<template>
    <div>
        <q-table
          dense
          :data="tableData"
          :filter="emailFilter"
          :columns="columns"
          selection="multiple"
          :selected.sync="selected"
          :pagination.sync="paginationControl"
          :rows-per-page-options=[]
          style="top: 0px; left: 0px; right: 0px; bottom: 0px;"
          row-key="emailId"
        >
          <q-tr :id="props.row.id" slot="body" slot-scope="props" :props="props" @dblclick.native="preview(props.row)" class="cursor-pointer">
            <q-td auto-width>
              <q-checkbox color="primary" v-model="props.selected" />
            </q-td>
            <q-td
              v-for="col in props.cols"
              :key="col.name"
              :props="props"
              style="overflow: hidden"
            >
              {{ col.value }}
            </q-td>
          </q-tr>
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
        <br />
        <q-btn
          label="Select all"
          color="secondary"
          @click="selectAll()"
          v-if="!globalButtonsDisabled"
          :disabled="globalButtonsDisabled"
        />&nbsp;
        <q-btn
          label="Select none"
          color="secondary"
          @click="selectNone()"
          v-if="!globalButtonsDisabled"
          :disabled="globalButtonsDisabled"
        />&nbsp;
        <q-btn
          label="Invert selection"
          color="secondary"
          @click="invertSelection()"
          v-if="!globalButtonsDisabled"
          :disabled="globalButtonsDisabled"
        />&nbsp;
        <q-btn
          label="Remove unselected"
          color="secondary"
          @click="removeUnselected()"
          v-if="!globalButtonsDisabled"
          :disabled="globalButtonsDisabled"
        />
        <div class="float-right">
          <q-btn
            label="Log"
            color="tertiary"
            @click="showLog()"
          />&nbsp;
          <q-btn
            label="Working Dir"
            color="tertiary"
            @click="showDir()"
          />
        </div>
    </div>
</template>

<style>
/*
NOTE: the table will look kind of small in a dev build.  This is intentional, because I was getting
a weird situation where everything is larger in the production build.  You can trace this down to
window.devicePixelRatio, which is ~1.8 in a dev build, but 2.0 in a production build.  Can't find an
explanation for that, so I just sized things to fit in the window in the production build, leaving
it a tad bit small in the dev build.
*/
table.q-table {
  table-layout: fixed;
}
.q-table-dense .q-table tbody td {
  padding: 2px 8px;
  font-size: 12px;
  height: 26px;
}

.q-table-dense .q-table thead tr {
  height: 26px;
}

.q-table-dense .q-table-top {
  min-height: 36px;
}

.q-table-top {
  padding: 0px 24px;
}

.q-checkbox-icon {
    height: 18px;
    width: 18px;
    font-size: 18px;
    opacity: 0;
}
</style>

<script>
const { spawn } = require('child_process')
const { dialog } = require('electron').remote
const path = require('path')
const fs = require('fs')
const os = require('os')
const ensureDirectoryExists = require('../lib/utils/Filesystem').ensureDirectoryExists

import MonolithicPdfReader from '../lib/readers/MonolithicPdfReader'
import MultiplePdfReader from '../lib/readers/MultiplePdfReader'
import MultipleEmlReader from '../lib/readers/MultipleEmlReader'
import MultiplePdfWriter from '../lib/writers/MultiplePdfWriter'

import Logger from '../lib/utils/Logger'

const moment = require('moment')

export default {
  name: 'StepSetup',
  data: function () {
    return {
      columns: [
        {
          name: 'subject',
          required: true,
          label: 'Subject',
          align: 'left',
          field: 'subject',
          sortable: true,
          style: 'width: 200px; overflow: hidden'
        },
        {
          name: 'from',
          required: true,
          label: 'From',
          align: 'left',
          field: 'from',
          sortable: true,
          style: 'width: 200px; overflow: hidden'
        },
        {
          name: 'to',
          required: true,
          label: 'To',
          align: 'left',
          field: 'to',
          sortable: true,
          style: 'width: 200px; overflow: hidden'
        },
        {
          name: 'date',
          required: true,
          label: 'Date',
          align: 'left',
          field: 'date',
          sortable: true,
          sort: (a, b) => new Date(a) - new Date(b),
          style: 'width: 120px; overflow: hidden'
        },
        {
          name: 'numPages',
          required: true,
          label: 'Pages',
          align: 'left',
          field: 'numPages',
          sortable: true,
          sort: (a, b) => parseInt(a) - parseInt(b),
          style: 'width: 35px; overflow: hidden'
        }
      ],
      paginationControl: { rowsPerPage: 25 },
      emailFilter: '',
      outputDir: ''
    }
  },
  computed: {
    globalButtonsDisabled: {
      get () {
        if (this.emailFilter) {
          return true
        }
        return false
      }
    },
    emails: {
      get () {
        return this.$store.state.filter.emails
      },
      set (val) {
        this.$store.commit('filter/updateEmails', val)
      }
    },
    tableData: {
      get () {
        return this.$store.state.filter.tableData
      },
      set (val) {
        this.$store.commit('filter/updateTableData', val)
      }
    },
    selected: {
      get () {
        return this.$store.state.filter.selected
      },
      set (val) {
        this.$store.commit('filter/updateSelected', val)
      }
    },
    lastJob: {
      get () {
        return this.$store.state.filter.lastJob
      },
      set (val) {
        this.$store.commit('filter/updateLastJob', val)
      }
    }
  },
  mounted () {
    this.processFile()
  },
  methods: {
    selectAll: function () {
      let newSelected = []
      for (let i = 0; i < this.tableData.length; i++) {
        newSelected.push(this.tableData[i])
      }
      this.selected = newSelected
    },
    selectNone: function () {
      this.selected = []
    },
    invertSelection: function () {
      this.selected = this.tableData.filter((el) => !this.selected.includes(el))
    },
    removeUnselected: function () {
      let newTableData = []
      for (let i = 0; i < this.selected.length; i++) {
        newTableData.push(this.selected[i])
      }
      this.tableData = newTableData
    },
    showLog: function () {
      let logfile = Logger.getLogfile()
      spawn('open', [logfile])
    },
    showDir: function () {
      spawn('open', [this.outputDir])
    },
    preview: function (row) {
      console.log('[preview] row: ', row)
      let id = row.emailId - 1
      let email = this.emails[id]
      if (email.files.pdf) {
        console.log('[preview] email: ', email)
        spawn('open', [email.files.pdf])
      }
    },

    processFile: function () {
      let newJob = {
        inputFile: this.$store.state.setup.inputFile,
        inputFileModTime: fs.statSync(this.$store.state.setup.inputFile).mtime,
        performOCR: this.$store.state.setup.performOCR,
        unpackPortfolio: this.$store.state.setup.unpackPortfolio
      }

      if (JSON.stringify(newJob) === JSON.stringify(this.lastJob)) {
        console.log('[processFile] job parameters unchanged; skipping re-processing')
        return
      }

      this.tableData = []

      let me = this
      function notify (msg) {
        me.$q.loading.show({
          message: msg
        })
      }

      let msDir = path.join(os.tmpdir(), 'mailshredder')
      ensureDirectoryExists(msDir)

      var tempnamSync = require('tempnam').tempnamSync
      this.outputDir = tempnamSync(msDir, 'mailshredder-')
      fs.unlinkSync(this.outputDir)
      fs.mkdirSync(this.outputDir)
      this.baseName = path.parse(this.$store.state.setup.inputFile).base
      Logger.init(this.outputDir)

      let r = null
      let w = null
      let inputType = MultiplePdfWriter.INPUT_TYPE_SINGLE_FILE_PAGE_PER_EMAIL

      if (this.$store.state.setup.unpackPortfolio) {
        r = new MultiplePdfReader({
          src: this.$store.state.setup.inputFile,
          outDir: this.outputDir,
          performOCR: this.$store.state.setup.performOCR,
          unpackPortfolio: true
        })
        inputType = MultiplePdfWriter.INPUT_TYPE_DIRECTORY_FILE_PER_EMAIL
      } else {
        if (fs.lstatSync(this.$store.state.setup.inputFile).isDirectory()) {
          if (containsEml(this.$store.state.setup.inputFile)) {
            r = new MultipleEmlReader({
              src: this.$store.state.setup.inputFile,
              outDir: this.outputDir
            })
          } else {
            r = new MultiplePdfReader({
              src: this.$store.state.setup.inputFile,
              outDir: this.outputDir,
              performOCR: this.$store.state.setup.performOCR
            })
          }
          inputType = MultiplePdfWriter.INPUT_TYPE_DIRECTORY_FILE_PER_EMAIL
        } else {
          r = new MonolithicPdfReader({
            src: this.$store.state.setup.inputFile,
            outDir: this.outputDir,
            performOCR: this.$store.state.setup.performOCR
          })
        }
      }

      w = new MultiplePdfWriter({
        src: this.$store.state.setup.inputFile,
        inputType: inputType,
        outDir: this.outputDir,
        baseName: this.baseName
      })

      function containsEml (dir) {
        let items = fs.readdirSync(dir)

        for (let i = 0; i < items.length; i++) {
          if (items[i].match(/\.eml$/)) {
            return true
          }
        }

        return false
      }

      // decodes HTML entities (our pdf reading code is getting entities, and quasar/vue is double-encoding them);
      // we often see HTML entities like &apos; in the subject lines
      function domDecoder (str) {
        let parser = new DOMParser()
        let dom = parser.parseFromString('<!doctype html><body>' + str, 'text/html')
        return dom.body.textContent
      }

      console.log('[processFile] reading ' + this.$store.state.setup.inputFile)
      notify('Reading ' + this.$store.state.setup.inputFile)
      r.read().then((emails) => {
        this.emails = emails

        let newdata = []
        let newSelected = []
        for (let i = 0; i < emails.length; i++) {
          let e = emails[i]
          let datestr = ''
          let rawdatestr = ''
          if (e.headers.Sent) {
            rawdatestr = e.headers.Sent.value
          }
          if (e.headers.Date) {
            rawdatestr = e.headers.Date.value
          }

          if (rawdatestr) {
            let d = new Date(rawdatestr)
            if (d && !isNaN(d.getTime())) {
              datestr = moment(d).format('ddd MMM DD, YYYY hh:mm a')
            }
          }

          let record = {
            emailId: i + 1,
            from: e.headers.From ? domDecoder(e.headers.From.value) : '',
            subject: e.headers.Subject ? domDecoder(e.headers.Subject.value) : '',
            to: e.headers.To ? domDecoder(e.headers.To.value) : '',
            date: datestr,
            numPages: e.end.page - e.start.page + 1
          }
          newdata.push(record)
          newSelected.push(record)
        }

        // console.log(newdata)
        this.tableData = newdata
        this.selected = newSelected

        if (w) {
          w.on('start-burst', evt => {
            notify('Bursting into individual pages (' + evt.output + ')')
          })
          w.on('start-email-write', evt => {
            notify('Writing individual emails...')
          })
          w.on('email-write-complete', evt => {
            notify('Done writing individual emails.')
          })
          console.log('[processFile] writing to ' + this.outputDir)
          w.setEmails(emails)
          return w.write()
        }
      }).then((files) => {
        console.log('[processFile] writing complete.')
        this.lastJob = newJob
        this.$q.loading.hide()
      }).catch(function (err) {
        dialog.showMessageBox({
          type: 'error',
          title: 'Error',
          message: err
        })
      })
    }
  }
}
</script>
