<template>
    <div>
        <br /><br /><strong>Upload progress:</strong><br /><br />
        <q-progress
          :percentage="uploadProgress"
          animate
          style="height: 16px"
        />
    </div>
</template>

<script>
import DocumentCloudUploader from '../lib//uploaders/DocumentCloudUploader'

export default {
  name: 'StepUpload',
  props: {
  },
  data: () => ({
    uploadProgress: 0
  }),
  computed: {
  },
  mounted () {
    this.uploadFiles()
  },
  methods: {
    uploadFiles: function () {
      let emails = this.$store.state.filter.emails
      let selected = this.$store.state.filter.selected

      console.log(selected)

      console.log('[uploadFiles] uploading...')

      let files = []
      for (let i = 0; i < selected.length; i++) {
        let id = selected[i].emailId - 1
        let e = emails[id]
        files.push(e.files.pdf)
      }

      let u = new DocumentCloudUploader({
        username: this.$store.state.setup.dcUsername,
        password: this.$store.state.setup.dcPassword,
        projectId: this.$store.state.setup.dcProjectId
      })

      let numUploadSuccess = 0
      this.uploadProgress = 0
      u.on('upload-success', evt => {
        numUploadSuccess++
        this.uploadProgress = Math.round(numUploadSuccess / files.length * 100.0)
        console.log('[on-upload-success] numUploadSuccess: ' + numUploadSuccess + ', uploadProgress: ' + this.uploadProgress)
      })

      u.uploadFiles(files).then(() => {
        console.log('[uploadFiles] done uploading.')
      }).catch(function (err) {
        this.$q.notify('Error uploading to Document Cloud: ' + err.message)
      })
    }
  }
}
</script>
