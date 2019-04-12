<template>
    <div>
      <br />
      <br />
      <br />
       <q-field
          label="Document Cloud Username"
          :error="$v.dcUsername.$error"
          error-label="Document Cloud username is required"
        >
          <q-input
            v-model="dcUsername"
          />
        </q-field><br />
        <q-field
          label="Document Cloud Password"
          :error="$v.dcPassword.$error"
          error-label="Document Cloud password is required"
        >
          <q-input
            v-model="dcPassword"
            type="password"
          />
        </q-field><br />
        <q-field
          label="Document Cloud Project ID"
          :error="$v.dcProjectId.$error"
          error-label="Document Cloud project ID is required and must be a positive integer"
        >
          <q-input
            v-model="dcProjectId"
          />
        </q-field><br />
        <q-field
          label="Input file or directory"
          :error="$v.inputFile.$error"
          error-label="Input file is required"
        >
          <q-input
            v-model="inputFile"
          /><br />
          <q-btn
            color="primary"
            @click="browseForFile"
            label="Browse..."
          />
        </q-field>
        <q-field
          label="Perform OCR"
        >
        <q-checkbox v-model="performOCR" />
        </q-field>
    </div>
</template>

<script>
const { dialog } = require('electron').remote
import { required, integer, minValue } from 'vuelidate/lib/validators'
import DocumentCloudUploader from '../lib//uploaders/DocumentCloudUploader'

export default {
  name: 'StepSetup',
  props: {
  },
  data: () => ({
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
    performOCR: {
      get () {
        return this.$store.state.setup.performOCR
      },
      set (val) {
        this.$store.commit('setup/updatePerformOCR', val)
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
      console.log(dialog.showOpenDialog(options, (selection) => {
        if (selection && selection.length === 1) {
          console.log('user selected: ' + selection[0])
          this.inputFile = '' + selection[0]
        }
      }))
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
