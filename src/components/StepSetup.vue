<template>
    <div style="max-width: 480px">
        <q-input
          v-model="dcUsername"
          :error="$v.dcUsername.$error"
          label="Document Cloud Username"
          error-message="Document Cloud username is required"
        />
        <br /><br />
        <q-input
          v-model="dcPassword"
          :error="$v.dcPassword.$error"
          label="Document Cloud Password"
          error-message="Document Cloud password is required"
          type="password"
        />
        <br /><br />
        <q-input
          v-model="dcProjectId"
          :error="$v.dcProjectId.$error"
          label="Document Cloud Project ID"
          error-message="Document Cloud project ID is required and must be a positive integer"
        />
        <br /><br />
        <q-input
          v-model="inputFile"
          :error="$v.inputFile.$error"
          label="Input file or directory"
          error-message="Input file is required"
        />
        <br /><br />
        <q-btn
          color="primary"
          @click="browseForFile"
          label="Browse..."
        />
        <br />
        <br />
        <br />
        <q-select
          v-model="headerJustification"
          label="Header Justification"
          :options="headerJustificationOptions"
        ></q-select>
        <br />
        <q-checkbox
          v-model="performOCR"
          label="Perform OCR"
        />
        <br />
        <q-checkbox
          v-model="unpackPortfolio"
          label="Unpack PDF Portfolio"
         />
    </div>
</template>

<script>
const { dialog } = require('electron').remote
import { required, integer, minValue } from 'vuelidate/lib/validators'
import DocumentCloudUploader from '../lib/uploaders/DocumentCloudUploader'
const FSUtils = require('../lib/utils/Filesystem')

export default {
  name: 'StepSetup',
  props: {
  },
  data: () => ({
    headerJustificationOptions: ['left', 'right']
  }),
  validations: {
    dcUsername: { required },
    dcPassword: { required },
    dcProjectId: { required, integer, minValue: minValue(1) },
    inputFile: { required }
  },
  computed: {
    dcUsername: {
      get () {
        return this.$store.state.setup.dcUsername
      },
      set (val) {
        this.$store.commit('setup/updateDcUsername', val)
      }
    },
    dcPassword: {
      get () {
        return this.$store.state.setup.dcPassword
      },
      set (val) {
        this.$store.commit('setup/updateDcPassword', val)
      }
    },
    dcProjectId: {
      get () {
        return this.$store.state.setup.dcProjectId
      },
      set (val) {
        this.$store.commit('setup/updateDcProjectId', val)
      }
    },
    inputFile: {
      get () {
        return this.$store.state.setup.inputFile
      },
      set (val) {
        this.$store.commit('setup/updateInputFile', val)
      }
    },
    headerJustification: {
      get () {
        return this.$store.state.setup.headerJustification
      },
      set (val) {
        this.$store.commit('setup/updateHeaderJustification', val)
      }
    },
    performOCR: {
      get () {
        return this.$store.state.setup.performOCR
      },
      set (val) {
        this.$store.commit('setup/updatePerformOCR', val)
      }
    },
    unpackPortfolio: {
      get () {
        return this.$store.state.setup.unpackPortfolio
      },
      set (val) {
        this.$store.commit('setup/updateUnpackPortfolio', val)
      }
    }
  },
  methods: {
    browseForFile: function () {
      let options = {
        properties: ['openFile', 'openDirectory'],
        filters: {
          extensions: ['pdf']
        }
      }

      // note that there is a scoping issue with the way calls are made to remote objects,
      // so you have to use an arrow function (or store a reference to 'this')
      dialog.showOpenDialog(options, (selection) => {
        if (selection && selection.length === 1) {
          console.log('user selected: ' + selection[0])
          this.inputFile = '' + selection[0]
        }
      })
    },
    validate: function () {
      this.$v.$touch()
      if (this.$v.$error) {
        this.$emit('validation-result', {
          result: false,
          errMessage: 'One or more errors in form fields; please correct before proceeding.'
        })
        return
      }

      if (FSUtils.isDir(this.inputFile)) {
        if (this.unpackPortfolio) {
          this.$emit('validation-result', {
            result: false,
            errMessage: '"Unpack PDF Portfolio" checked, but directory selected; select a single portfolio file instead.'
          })
          return
        }
        if (FSUtils.isDirEmpty(this.inputFile)) {
          this.$emit('validation-result', {
            result: false,
            errMessage: 'Directory selected, but nothing in directory; cannot proceed.'
          })
          return
        }
      }

      let u = new DocumentCloudUploader({
        username: this.dcUsername,
        password: this.dcPassword,
        projectId: this.dcProjectId
      })

      u.validateProjectId().then(() => {
        this.$emit('validation-result', {
          result: true,
          errMessage: ''
        })
      }, () => {
        this.$emit('validation-result', {
          result: false,
          errMessage: 'Could not validate Document Cloud project ID; check username, password, and project ID.'
        })
      })
    }
  }
}
</script>
