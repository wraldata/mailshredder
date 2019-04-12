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
    </div>
</template>

<style>
table.q-table {
  table-layout: fixed;
}
.q-table-dense .q-table td {
  padding: 2px 8px;
  font-size: 12px;
  height: 17px;
}

.q-table-dense .q-table td {
  padding: 2px 8px;
  font-size: 12px;
  height: 17px;
}

.q-table-dense .q-table thead tr {
  height: 24px;
}

.q-table-dense .q-table-top {
  min-height: 36px;
}

.q-table-top {
  padding: 0px 24px;
}
</style>

<script>
const { dialog } = require('electron').remote
const path = require('path')
const fs = require('fs')
const os = require('os')
const ensureDirectoryExists = require('../lib/utils/Filesystem').ensureDirectoryExists

import MonolithicPdfReader from '../lib/readers/MonolithicPdfReader'
import MultiplePdfReader from '../lib/readers/MultiplePdfReader'
import MultiplePdfWriter from '../lib/writers/MultiplePdfWriter'

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
      emailFilter: ''
    }
  },
  computed: {
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
    inputFileWritten: {
      get () {
        return this.$store.state.filter.inputFileWritten
      },
      set (val) {
        this.$store.commit('filter/updateInputFileWritten', val)
      }
    },
    inputFileWrittenAt: {
      get () {
        return this.$store.state.filter.inputFileWrittenAt
      },
      set (val) {
        this.$store.commit('filter/updateInputFileWrittenAt', val)
      }
    }
  },
  mounted () {
    this.processFile()
  },
  methods: {
    processFile: function () {
      if ((this.inputFileWritten === this.$store.state.setup.inputFile)) {
        console.log('[processFile] input filename unchanged since last processing...')
        let modDate = fs.statSync(this.$store.state.setup.inputFile).mtime
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

      let r = null
      let inputType = MultiplePdfWriter.INPUT_TYPE_SINGLE_FILE_PAGE_PER_EMAIL
      if (fs.lstatSync(this.$store.state.setup.inputFile).isDirectory()) {
        r = new MultiplePdfReader({
          src: this.$store.state.setup.inputFile,
          outDir: this.outputDir,
          performOCR: this.$store.state.setup.performOCR
        })
        inputType = MultiplePdfWriter.INPUT_TYPE_DIRECTORY_FILE_PER_EMAIL
      } else {
        r = new MonolithicPdfReader({
          src: this.$store.state.setup.inputFile,
          outDir: this.outputDir,
          performOCR: this.$store.state.setup.performOCR
        })
      }

      let w = new MultiplePdfWriter({
        src: this.$store.state.setup.inputFile,
        inputType: inputType,
        outDir: this.outputDir,
        baseName: this.baseName
      })

      console.log('[processFile] reading ' + this.$store.state.setup.inputFile)
      notify('Reading ' + this.$store.state.setup.inputFile)
      r.read().then((emails) => {
        this.emails = emails

        let newdata = []
        let newSelected = []
        for (let i = 0; i < emails.length; i++) {
          let e = emails[i]
          let datestr = ''
          if (e.headers.Date) {
            let d = new Date(e.headers.Date.value)
            if (d && !isNaN(d.getTime())) {
              datestr = moment(d).format('ddd MMM DD, YYYY hh:mm a')
            }
          }

          let record = {
            emailId: i + 1,
            from: e.headers.From ? e.headers.From.value : '',
            subject: e.headers.Subject ? e.headers.Subject.value : '',
            to: e.headers.To ? e.headers.To.value : '',
            date: datestr,
            numPages: e.end.page - e.start.page + 1
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
        this.inputFileWritten = this.$store.state.setup.inputFile
        this.inputFileWrittenAt = new Date()
        this.$q.loading.hide()
      }).catch(function (err) {
        dialog.showMessageBox({
          type: 'error',
          title: 'Error',
          message: err.message
        })
      })
    }
  }
}
</script>
