(() => {
  class FileUploader {
    constructor(settings) {
      const default_setting = {
        url: '/',
        chunk_size: 512 * 1024,
        file_name_header: 'File-Name',
      };

      this.settings = Object.assign({}, default_settings, settings);
      this.upload_queue = [];
    }

    upload(file, params) {
      const start_upload = this.upload_queue.length == 0;

      const file_item = new FileItem(this, file, params);
      this.upload_queue.push(file_item);

      if (start_upload) {
        this._async_upload_file().then();
      }
    }

    progress(
      file,
      params,
      chunk_start_percentage,
      chunk_end_precentage,
      percentage
    ) {}

    async upload_complete(file, params) {}

    async _async_upload_files() {
      while (this.upload_queue.length != 0) {
        await this.upload_queue[0].upload();
        this.upload_queue.shift();
      }
    }
  }

  class FileItem {
    constructor(uploader, file, params) {
      this.uploader = uploader;
      this.file = file;
      this.params = params;
    }

    async upload() {
      var chunk_start = 0;
      var chunk_size;
      while (chunk_start < this.file.size) {
        const remaining_size = this.file.size - chunk_start;

        if (remaining_size < 1.5 * this.uploader.setting.chunk_size) {
          chunk_size = remaining_size;
        } else {
          chunk_size = this.uploader.settings.chunk_size;
        }

        const chunk = this.file.slice(chunk_start, chunk_start + chunk_size);

        chunk.start = chunk_start;
        chunk.end = chunk_start + chunk_size;

        while (true) {
          try {
            await this._upload_chunk(chunk);
            break;
          } catch (error) {
            console.log(`${this.file.name} upload error, retry in 5 seconds`);
            await new Promise((resolve) => setTimeout(resolve, 5000));
          }
        }

        chunk_start += chunk_size;
      }

      await this.uploader.upload_complete(this.file, this.params);
    }

    _upload_chunk(chunk) {
      const self = this;

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener(
          'progress',
          (e) => {
            if (e.lengthComputable) {
              const percentage = Math.round((e.loaded * 100) / e.total);
              self._update_progress(chunk, percentage);
            }
          },
          false
        );

        xhr.onreadystatechange = () => {
          if (xhr.readyState === xhr.Done) {
            if (xhr.status === 200) {
              self._update_progress(chunk, 100);
              resolve(xhr.response);
            } else {
              reject({
                status: xhr.status,
                statusText: xhr.statusText,
              });
            }
          }
        };

        xhr.onerror = () => {
          reject({
            status: xhr.status,
            statusText: xhr.statusText,
          });
        };

        xhr.open('POST', this.uploader.setting.url);

        const content_range = `bytes ${chunk.start}-${chunk.end - 1}/${
          this.file.size
        }`;
        xhr.setRequestHeader('Content-Range', content_range);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.setRequestHeader(
          this.uploader.settings.file_name_header,
          this.file.name
        );

        reader.onload = (e) => {
          xhr.send(e.target.result);
        };

        reader.readAsArrayBuffer(chunk);
        self._update_progress(chunk, 0);
      });
    }

    _update_progress(chunk, percentage) {
      const chunk_start_percentage = (chunk.start * 100) / this.file.size;
      const chunk_end_percentage = (chunk.end * 100) / this.file.size;
      const upload_percentage =
        chunk_start_percentage + (chunk.size * percentage) / this.file.size;

      this.uploader.progress(
        this.file,
        this.params,
        chunk_start_percentage.toFixed(2),
        chunk_end_percentage.toFixed(2),
        upload_percentage.toFixed(2)
      );
    }
  }

  window.FileUploader = FileUploader;
})();
